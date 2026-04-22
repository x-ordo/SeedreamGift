// Package services는 애플리케이션의 핵심 비즈니스 로직을 포함합니다.
// Trade-in Service는 상품 매입 신청 및 상태 관리 프로세스를 담당합니다.
package services

import (
	"fmt"
	"strings"
	"time"
	"w-gift-server/internal/app/interfaces"
	"w-gift-server/internal/config"
	"w-gift-server/internal/domain"
	"w-gift-server/pkg/apperror"
	"w-gift-server/pkg/crypto"
	"w-gift-server/pkg/logger"
	"w-gift-server/pkg/pagination"
	"w-gift-server/pkg/telegram"

	"github.com/shopspring/decimal"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

// TradeInService는 매입 관련 비즈니스 로직을 처리하는 서비스입니다.
type TradeInService struct {
	db           *gorm.DB
	cfg          *config.Config
	config       ConfigProvider // SiteConfig 동적 설정 (매입 한도 등)
	fraudChecker interfaces.FraudChecker
}

func (s *TradeInService) SetConfigProvider(cp ConfigProvider) {
	s.config = cp
}

// NewTradeInService는 새로운 TradeInService 인스턴스를 생성합니다.
func NewTradeInService(db *gorm.DB, cfg *config.Config) *TradeInService {
	return &TradeInService{db: db, cfg: cfg}
}

// SetFraudChecker는 사기 조회 서비스를 주입합니다 (setter injection).
func (s *TradeInService) SetFraudChecker(fc interfaces.FraudChecker) {
	s.fraudChecker = fc
}

// CreateTradeInInput은 매입 신청 시 필요한 입력 정보 구조체입니다.
// 배송 기반(실물 발송) 매입이 기본이며, PIN 기반 매입도 선택적으로 지원합니다.
// 계좌 정보는 사용자의 KYC 인증 계좌에서 자동으로 가져옵니다.
type CreateTradeInInput struct {
	ProductID int `json:"productId" binding:"required"`
	Quantity  int `json:"quantity" binding:"required,min=1"`
	// PIN 기반 매입 (선택) — 비어 있으면 배송 기반으로 처리
	PinCode      string `json:"pinCode"`
	SecurityCode string `json:"securityCode"`
	GiftNumber   string `json:"giftNumber"`
	// 계좌 정보 (선택) — 비어 있으면 사용자의 KYC 인증 계좌 사용
	BankName      string `json:"bankName"`
	AccountNum    string `json:"accountNum"`
	AccountHolder string `json:"accountHolder"`
	// 배송 기반 매입 필드
	SenderName     string `json:"senderName"`
	SenderPhone    string `json:"senderPhone"`
	SenderEmail    string `json:"senderEmail"`
	ShippingMethod string `json:"shippingMethod"`
	ShippingDate   string `json:"shippingDate"`
	ArrivalDate    string `json:"arrivalDate"`
	Message        string `json:"message"`
}

// SubmitTradeIn은 사용자의 상품 매입(Trade-in) 신청을 처리합니다.
// 이 서비스는 실물 배송 방식과 PIN 번호 입력 방식을 모두 지원합니다.
// 매입가는 상품의 정가와 현재 설정된 매입 이율(TradeInRate)을 바탕으로 계산됩니다.
func (s *TradeInService) SubmitTradeIn(userID int, input CreateTradeInInput) (*domain.TradeIn, error) {
	// KYC + 계좌 인증 필수
	var tradeInUser domain.User
	if err := s.db.Select("Id", "KycStatus", "BankVerifiedAt").First(&tradeInUser, userID).Error; err != nil {
		return nil, apperror.NotFound("사용자를 찾을 수 없습니다")
	}
	if tradeInUser.KycStatus != "VERIFIED" {
		return nil, apperror.Validation("본인 인증(KYC)을 완료해야 상품권을 판매할 수 있습니다.")
	}
	if tradeInUser.BankVerifiedAt == nil {
		return nil, apperror.Validation("계좌 인증(1원 인증)을 완료해야 상품권을 판매할 수 있습니다.")
	}

	// 사기 조회 (fail-closed: 실패 시 FRAUD_HOLD 적용)
	var fraudResult *interfaces.FraudCheckResult
	if s.fraudChecker != nil {
		var fcErr error
		fraudResult, fcErr = s.fraudChecker.Check(userID, "TRADEIN")
		if fcErr != nil {
			logger.Log.Error("매입 사기 조회 실패 (fail-closed) → FRAUD_HOLD 적용",
				zap.Error(fcErr), zap.Int("userId", userID))
			fraudResult = &interfaces.FraudCheckResult{IsFlagged: true}
		}
	}

	// 1. 매입 대상 상품 정보 조회 및 유효성 확인
	var product domain.Product
	if err := s.db.First(&product, input.ProductID).Error; err != nil {
		return nil, apperror.NotFound("매입 대상 상품을 찾을 수 없습니다")
	}

	if !product.AllowTradeIn {
		return nil, apperror.Validation("이 상품은 현재 매입을 진행하지 않습니다")
	}
	if product.TradeInRate.Decimal.LessThanOrEqual(decimal.Zero) {
		return nil, apperror.Validation("이 상품은 현재 매입을 진행하지 않습니다")
	}

	// 1-c. 일일/월간 매입 한도 체크 (SiteConfig에서 동적 조회, 기본: 500만원/일, 3000만원/월)
	dailyTradeInLimit := 5000000.0
	monthlyTradeInLimit := 30000000.0
	if s.config != nil {
		dailyTradeInLimit = s.config.GetConfigFloat("LIMIT_TRADEIN_PER_DAY", 5000000)
		monthlyTradeInLimit = s.config.GetConfigFloat("LIMIT_TRADEIN_PER_MONTH", 30000000)
	}
	nowKST := time.Now().In(kstLoc)
	todayUTC := time.Date(nowKST.Year(), nowKST.Month(), nowKST.Day(), 0, 0, 0, 0, kstLoc).UTC()
	monthUTC := time.Date(nowKST.Year(), nowKST.Month(), 1, 0, 0, 0, 0, kstLoc).UTC()

	var tradeInUsage struct {
		DailyUsed   string
		MonthlyUsed string
	}
	s.db.Model(&domain.TradeIn{}).
		Where("UserId = ? AND Status IN ('REQUESTED','RECEIVED','VERIFIED','PAID') AND CreatedAt >= ?", userID, monthUTC).
		Select(`
			CAST(COALESCE(SUM(CASE WHEN CreatedAt >= ? THEN PayoutAmount ELSE 0 END), 0) AS VARCHAR(30)) as DailyUsed,
			CAST(COALESCE(SUM(PayoutAmount), 0) AS VARCHAR(30)) as MonthlyUsed
		`, todayUTC).
		Scan(&tradeInUsage)

	estimatedPayout := product.Price.Decimal.
		Mul(decimal.NewFromInt(100).Sub(product.TradeInRate.Decimal)).
		Div(decimal.NewFromInt(100)).
		Mul(decimal.NewFromInt(int64(input.Quantity)))

	dailyUsed, _ := decimal.NewFromString(tradeInUsage.DailyUsed)
	if dailyUsed.Add(estimatedPayout).GreaterThan(decimal.NewFromFloat(dailyTradeInLimit)) {
		return nil, apperror.Validationf("일일 매입 한도(%s원)를 초과했습니다. 내일 다시 시도해주세요.", formatTradeInAmount(dailyTradeInLimit))
	}
	monthlyUsed, _ := decimal.NewFromString(tradeInUsage.MonthlyUsed)
	if monthlyUsed.Add(estimatedPayout).GreaterThan(decimal.NewFromFloat(monthlyTradeInLimit)) {
		return nil, apperror.Validationf("월간 매입 한도(%s원)를 초과했습니다. 다음 달에 다시 시도해주세요.", formatTradeInAmount(monthlyTradeInLimit))
	}

	// 2. 최종 매입 지급액 계산: 액면가 × (1 - 매입수수료율/100) × 수량
	// tradeInRate는 수수료율 (예: 10 = 10% 수수료 → 고객에게 90% 지급)
	payout := domain.NewNumericDecimal(estimatedPayout.Round(0))

	tradeInStatus := "REQUESTED"
	var adminNote *string
	if fraudResult != nil && fraudResult.IsFlagged {
		tradeInStatus = "FRAUD_HOLD"
		note := fmt.Sprintf("FRAUD_HOLD: %s [sources: %s]",
			fraudResult.Reason, strings.Join(fraudResult.FlagSources, ", "))
		adminNote = &note
	}

	tradeIn := &domain.TradeIn{
		UserID:       userID,
		ProductID:    input.ProductID,
		ProductName:  &product.Name,
		ProductBrand: &product.BrandCode,
		ProductPrice: &product.Price,
		Quantity:     input.Quantity,
		PayoutAmount: payout,
		AppliedRate:  &product.TradeInRate,
		Status:       tradeInStatus,
		AdminNote:    adminNote,
	}

	// 트랜잭션으로 PIN 중복 검사 + INSERT를 원자적으로 처리하여 레이스 컨디션 방지
	if err := s.db.Transaction(func(tx *gorm.DB) error {
		// 3. PIN 기반 매입 처리 (입력값이 있는 경우)
		if input.PinCode != "" {
			pinHash := crypto.SHA256Hash(input.PinCode)

			// 매입 테이블 중복 확인
			var tradeInDup int64
			tx.Model(&domain.TradeIn{}).Where("PinHash = ?", pinHash).Count(&tradeInDup)
			if tradeInDup > 0 {
				return apperror.Conflict("이미 접수된 PIN 코드입니다. 중복 신청은 불가능합니다.")
			}

			// 바우처 테이블 중복 확인 (이미 판매된 상품권 PIN)
			var voucherDup int64
			tx.Model(&domain.VoucherCode{}).Where("PinHash = ?", pinHash).Count(&voucherDup)
			if voucherDup > 0 {
				return apperror.Conflict("이 PIN은 이미 등록된 상품권입니다. 매입할 수 없습니다.")
			}

			// PIN 번호 등 민감 정보 암호화 저장
			encryptedPin, err := crypto.Encrypt(input.PinCode, s.cfg.EncryptionKey)
			if err != nil {
				return apperror.Internal("PIN 코드 암호화 실패", err)
			}
			tradeIn.PinCode = &encryptedPin
			tradeIn.PinHash = &pinHash

			if input.SecurityCode != "" {
				encryptedSecurityCode, err := crypto.Encrypt(input.SecurityCode, s.cfg.EncryptionKey)
				if err != nil {
					return apperror.Internal("보안 코드 암호화 실패", err)
				}
				tradeIn.SecurityCode = &encryptedSecurityCode
			}

			if input.GiftNumber != "" {
				encryptedGiftNumber, err := crypto.Encrypt(input.GiftNumber, s.cfg.EncryptionKey)
				if err != nil {
					return apperror.Internal("발행 번호 암호화 실패", err)
				}
				tradeIn.GiftNumber = &encryptedGiftNumber
			}
		}

		// 4. 환급 계좌 정보 설정
		bankName := input.BankName
		accountNum := input.AccountNum
		accountHolder := input.AccountHolder

		// 별도 입력이 없는 경우 사용자의 KYC 인증 계좌 정보를 자동으로 불러옴
		if bankName == "" || accountNum == "" {
			var user domain.User
			if err := tx.Select("Id", "BankName", "AccountNumber", "AccountHolder", "BankVerifiedAt").
				First(&user, userID).Error; err != nil {
				return apperror.Internal("사용자 계좌 정보 조회 중 오류가 발생했습니다", err)
			}
			if user.BankName == nil || user.AccountNumber == nil {
				return apperror.Validation("등록된 환급 계좌가 없습니다. 계좌 인증을 먼저 진행해 주세요.")
			}
			if bankName == "" {
				bankName = *user.BankName
			}
			if accountNum == "" {
				accountNum = *user.AccountNumber
			} // 이미 암호화된 상태
			if accountHolder == "" && user.AccountHolder != nil {
				accountHolder = *user.AccountHolder
			}
		} else {
			// 직접 입력한 계좌 번호는 암호화하여 저장
			encryptedAccountNum, err := crypto.Encrypt(accountNum, s.cfg.EncryptionKey)
			if err != nil {
				return apperror.Internal("계좌 번호 암호화 실패", err)
			}
			accountNum = encryptedAccountNum
		}

		tradeIn.BankName = &bankName
		tradeIn.AccountNum = &accountNum
		tradeIn.AccountHolder = &accountHolder

		// 5. 배송 관련 추가 정보 설정 (실물 배송 방식인 경우)
		if input.SenderName != "" {
			tradeIn.SenderName = &input.SenderName
		}
		if input.SenderPhone != "" {
			tradeIn.SenderPhone = &input.SenderPhone
		}
		if input.SenderEmail != "" {
			tradeIn.SenderEmail = &input.SenderEmail
		}
		if input.ShippingMethod != "" {
			tradeIn.ShippingMethod = &input.ShippingMethod
		}
		if input.ShippingDate != "" {
			if t, err := time.Parse("2006-01-02", input.ShippingDate); err == nil {
				tradeIn.ShippingDate = &t
			}
		}
		if input.ArrivalDate != "" {
			if t, err := time.Parse("2006-01-02", input.ArrivalDate); err == nil {
				tradeIn.ArrivalDate = &t
			}
		}
		if input.Message != "" {
			tradeIn.Message = &input.Message
		}

		// 6. 매입 신청 레코드 생성
		return tx.Create(tradeIn).Error
	}); err != nil {
		return nil, err
	}

	// FRAUD_HOLD 시 텔레그램 알림
	if tradeIn.Status == "FRAUD_HOLD" && fraudResult != nil {
		go telegram.SendAlert("", "", fmt.Sprintf(
			"🚨 <b>FRAUD_HOLD 매입 발생</b>\n"+
				"<b>매입 ID:</b> %d\n"+
				"<b>상품:</b> %s\n"+
				"<b>금액:</b> %s원\n"+
				"<b>사유:</b> %s\n"+
				"<b>출처:</b> %s",
			tradeIn.ID,
			product.Name,
			payout.String(),
			fraudResult.Reason,
			strings.Join(fraudResult.FlagSources, ", "),
		))
	}

	return tradeIn, nil
}

// GetMyTradeIns는 특정 사용자의 매입 신청 내역을 페이지네이션하여 조회합니다.
func (s *TradeInService) GetMyTradeIns(userID int, params pagination.QueryParams) (pagination.PaginatedResponse[domain.TradeIn], error) {
	var items []domain.TradeIn
	var total int64

	db := s.db.Model(&domain.TradeIn{}).Where("UserId = ?", userID)
	if err := db.Count(&total).Error; err != nil {
		return pagination.PaginatedResponse[domain.TradeIn]{}, apperror.Internal("매입 수 조회 실패", err)
	}

	offset := (params.Page - 1) * params.Limit
	err := db.
		Select("Id", "UserId", "ProductId", "ProductName", "ProductBrand", "ProductPrice", "Quantity", "PayoutAmount", "Status", "CreatedAt", "UpdatedAt").
		Order("Id DESC").Offset(offset).Limit(params.Limit).Find(&items).Error

	return pagination.CreatePaginatedResponse(items, total, params.Page, params.Limit), err
}

// GetTradeInByID는 ID를 사용하여 특정 사용자의 상세 매입 신청 정보를 조회합니다.
func (s *TradeInService) GetTradeInByID(userID int, id int) (*domain.TradeIn, error) {
	var tradeIn domain.TradeIn
	if err := s.db.Where("Id = ? AND UserId = ?", id, userID).First(&tradeIn).Error; err != nil {
		return nil, err
	}
	// 보안을 위해 민감한 필드 마스킹 처리 — 복호화 후 마스킹
	if tradeIn.PinCode != nil {
		plain, err := crypto.Decrypt(*tradeIn.PinCode, s.cfg.EncryptionKey)
		if err == nil && len(plain) >= 4 {
			masked := strings.Repeat("*", len(plain)-4) + plain[len(plain)-4:]
			tradeIn.PinCode = &masked
		} else {
			hidden := "[비공개]"
			tradeIn.PinCode = &hidden
		}
	}
	return &tradeIn, nil
}

func formatTradeInAmount(amount float64) string {
	s := fmt.Sprintf("%.0f", amount)
	n := len(s)
	if n <= 3 {
		return s
	}
	var result []byte
	for i, c := range s {
		if i > 0 && (n-i)%3 == 0 {
			result = append(result, ',')
		}
		result = append(result, byte(c))
	}
	return string(result)
}
