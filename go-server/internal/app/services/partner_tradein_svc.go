package services

import (
	"fmt"
	"time"
	"w-gift-server/internal/domain"
	"w-gift-server/pkg/apperror"
	"w-gift-server/pkg/crypto"
	"w-gift-server/pkg/pagination"

	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

// PartnerTradeInService는 파트너의 상품권 매입 신청 기능을 처리합니다.
// 파트너별 매입가 적용, 1일 한도 검증, PIN 중복 방지, 파트너 계좌 자동 입력 등을 담당합니다.
type PartnerTradeInService struct {
	db            *gorm.DB
	encryptionKey string
	config        ConfigProvider
}

// NewPartnerTradeInService는 새로운 PartnerTradeInService 인스턴스를 생성합니다.
func NewPartnerTradeInService(db *gorm.DB, encryptionKey string, config ConfigProvider) *PartnerTradeInService {
	return &PartnerTradeInService{
		db:            db,
		encryptionKey: encryptionKey,
		config:        config,
	}
}

// CreatePartnerTradeInInput은 파트너 매입 신청 시 전달받는 데이터 구조입니다.
type CreatePartnerTradeInInput struct {
	ProductID    int      `json:"productId" binding:"required"`
	PinCodes     []string `json:"pinCodes" binding:"required,min=1,max=20"`
	SecurityCode string   `json:"securityCode"`
	GiftNumber   string   `json:"giftNumber"`
}

// resolvePartnerPrice는 파트너의 상품별 구매가/매입가를 조회합니다.
// PartnerPrices 테이블에 설정이 있으면 해당 값을, 없으면 Product 기본값을 반환합니다.
func (s *PartnerTradeInService) resolvePartnerPrice(partnerID, productID int) (buyPrice, tradeInPrice decimal.Decimal, err error) {
	var pp domain.PartnerPrice
	if dbErr := s.db.
		Where("PartnerId = ? AND ProductId = ?", partnerID, productID).
		First(&pp).Error; dbErr == nil {
		return pp.BuyPrice.Decimal, pp.TradeInPrice.Decimal, nil
	}

	// 파트너 단가 미설정 → 상품 기본 단가 사용
	var product domain.Product
	if dbErr := s.db.Select("BuyPrice", "TradeInRate", "Price").First(&product, productID).Error; dbErr != nil {
		return decimal.Zero, decimal.Zero, apperror.NotFound("상품을 찾을 수 없습니다")
	}

	// 매입 지급액 = 액면가 × (100 - 매입수수료율) / 100 (사용자 매입과 동일한 공식)
	hundred := decimal.NewFromInt(100)
	tradeInPayout := product.Price.Decimal.Mul(hundred.Sub(product.TradeInRate.Decimal)).Div(hundred).Round(0)
	return product.BuyPrice.Decimal, tradeInPayout, nil
}

// CreatePartnerTradeIn은 파트너 매입 신청을 일괄 생성합니다.
// 1일 한도 검증, 상품 AllowTradeIn 확인, PIN 중복 검사, PIN 암호화, Source=PARTNER 설정을 처리합니다.
func (s *PartnerTradeInService) CreatePartnerTradeIn(partnerID int, input CreatePartnerTradeInInput) ([]domain.TradeIn, error) {
	// 1. 상품 조회 및 AllowTradeIn 확인
	var product domain.Product
	if err := s.db.Select("Id", "Name", "BrandCode", "Price", "TradeInRate", "AllowTradeIn", "DeletedAt").
		First(&product, input.ProductID).Error; err != nil {
		return nil, apperror.NotFound("상품을 찾을 수 없습니다")
	}
	if !product.AllowTradeIn {
		return nil, apperror.Validation("해당 상품은 매입 신청이 불가합니다")
	}

	// 2. 파트너 계좌 정보 조회
	var partner domain.User
	if err := s.db.Select("Id", "BankName", "BankCode", "AccountNumber", "AccountHolder").
		First(&partner, partnerID).Error; err != nil {
		return nil, apperror.Internal("파트너 정보 조회 실패", err)
	}

	// 3. 1일 매입 한도 검증
	dailyLimit := s.resolveDailyTradeInLimit(partnerID)
	nowKST := time.Now().In(kstLoc)
	todayStart := time.Date(nowKST.Year(), nowKST.Month(), nowKST.Day(), 0, 0, 0, 0, kstLoc)

	var todayCount int64
	s.db.Model(&domain.TradeIn{}).
		Where("UserId = ? AND Source = 'PARTNER' AND Status NOT IN ('REJECTED') AND CreatedAt >= ?", partnerID, todayStart).
		Count(&todayCount)

	if int(todayCount)+len(input.PinCodes) > dailyLimit {
		return nil, apperror.Validationf("1일 매입 신청 한도(%d개)를 초과합니다. 현재 오늘 신청: %d개", dailyLimit, todayCount)
	}

	// 4. PIN 코드별 중복 검사 및 매입 레코드 생성
	_, tradeInPrice, err := s.resolvePartnerPrice(partnerID, input.ProductID)
	if err != nil {
		return nil, err
	}

	// 상품 스냅샷 정보
	productName := product.Name
	productBrand := product.BrandCode
	productPrice := product.Price

	// 파트너 계좌 복호화 (저장 시 재암호화)
	var accountNum *string
	if partner.AccountNumber != nil && *partner.AccountNumber != "" {
		if decrypted, dErr := crypto.DecryptAuto(*partner.AccountNumber, s.encryptionKey); dErr == nil {
			accountNum = &decrypted
		} else {
			accountNum = partner.AccountNumber
		}
	}

	var created []domain.TradeIn

	txErr := s.db.Transaction(func(tx *gorm.DB) error {
		for _, pin := range input.PinCodes {
			if pin == "" {
				continue
			}

			// PIN 중복 검사 (SHA256 해시 기반) — TradeIn + VoucherCode 양쪽 확인
			pinHash := crypto.SHA256Hash(pin)
			var existing int64
			tx.Model(&domain.TradeIn{}).Where("PinHash = ?", pinHash).Count(&existing)
			if existing > 0 {
				return apperror.Conflict(fmt.Sprintf("이미 신청된 PIN 코드가 포함되어 있습니다: %s", maskPIN(pin)))
			}
			var voucherDup int64
			tx.Model(&domain.VoucherCode{}).Where("PinHash = ?", pinHash).Count(&voucherDup)
			if voucherDup > 0 {
				return apperror.Conflict(fmt.Sprintf("이미 등록된 상품권 PIN입니다: %s", maskPIN(pin)))
			}

			// PIN 암호화
			encryptedPin, err := crypto.Encrypt(pin, s.encryptionKey)
			if err != nil {
				return apperror.Internal("PIN 암호화 실패", err)
			}

			// 보안 코드 처리
			var encSecCode *string
			if input.SecurityCode != "" {
				enc, err := crypto.Encrypt(input.SecurityCode, s.encryptionKey)
				if err != nil {
					return apperror.Internal("보안 코드 암호화 실패", err)
				}
				encSecCode = &enc
			}

			// 선물번호 처리
			var giftNumber *string
			if input.GiftNumber != "" {
				giftNumber = &input.GiftNumber
			}

			appliedRate := product.TradeInRate
			tradeIn := domain.TradeIn{
				UserID:       partnerID,
				ProductID:    input.ProductID,
				ProductName:  &productName,
				ProductBrand: &productBrand,
				ProductPrice: &productPrice,
				Quantity:     1,
				PinCode:      &encryptedPin,
				PinHash:      &pinHash,
				SecurityCode: encSecCode,
				GiftNumber:   giftNumber,
				PayoutAmount: domain.NewNumericDecimal(tradeInPrice),
				AppliedRate:  &appliedRate,
				Status:       "REQUESTED",
				Source:       "PARTNER",
				// 파트너 계좌 정보 자동 입력
				BankName:      partner.BankName,
				AccountNum:    accountNum,
				AccountHolder: partner.AccountHolder,
			}

			if err := tx.Create(&tradeIn).Error; err != nil {
				return apperror.Internal("매입 신청 생성 실패", err)
			}

			// 보안: 반환 시 PIN은 마스킹
			if tradeIn.PinCode != nil {
				masked := maskPIN(pin)
				tradeIn.PinCode = &masked
			}

			created = append(created, tradeIn)
		}

		return nil
	})

	if txErr != nil {
		return nil, txErr
	}

	return created, nil
}

// GetMyTradeIns는 파트너의 매입 신청 목록을 페이지네이션하여 반환합니다.
// Source=PARTNER 조건으로 필터링합니다.
func (s *PartnerTradeInService) GetMyTradeIns(partnerID int, status string, params pagination.QueryParams) ([]domain.TradeIn, int64, error) {
	var items []domain.TradeIn
	var total int64

	db := s.db.Model(&domain.TradeIn{}).
		Where("UserId = ? AND Source = 'PARTNER'", partnerID)

	if status != "" {
		db = db.Where("Status = ?", status)
	}

	if err := db.Count(&total).Error; err != nil {
		return nil, 0, apperror.Internal("매입 신청 수 조회 실패", err)
	}

	offset := (params.Page - 1) * params.Limit
	err := db.
		Preload("Product", func(tx *gorm.DB) *gorm.DB {
			return tx.Select("Id", "Name", "BrandCode", "Price", "TradeInRate", "ImageUrl")
		}).
		Order("Id DESC").
		Offset(offset).
		Limit(params.Limit).
		Find(&items).Error

	// 보안: 목록에서는 PIN 코드를 마스킹 처리
	for i := range items {
		items[i].PinCode = nil
		items[i].SecurityCode = nil
	}

	return items, total, err
}

// GetTradeInDetail은 특정 매입 신청 건의 상세 정보를 반환합니다.
// 소유권(UserId)을 검증하며, Source=PARTNER 조건도 적용합니다.
func (s *PartnerTradeInService) GetTradeInDetail(partnerID, tradeInID int) (*domain.TradeIn, error) {
	var tradeIn domain.TradeIn
	err := s.db.
		Preload("Product", func(tx *gorm.DB) *gorm.DB {
			return tx.Select("Id", "Name", "BrandCode", "Price", "TradeInRate")
		}).
		Where("Id = ? AND UserId = ? AND Source = 'PARTNER'", tradeInID, partnerID).
		First(&tradeIn).Error

	if err != nil {
		return nil, apperror.NotFound("매입 신청 건을 찾을 수 없습니다")
	}

	// 보안: 상세 조회에서도 PIN 코드는 노출하지 않음
	tradeIn.PinCode = nil
	tradeIn.SecurityCode = nil

	return &tradeIn, nil
}

// resolveDailyTradeInLimit는 파트너의 1일 매입 신청 한도(수량)를 결정합니다.
// 우선순위: User.DailyPinLimit → SiteConfig.PARTNER_DAILY_BUY_LIMIT → 100
func (s *PartnerTradeInService) resolveDailyTradeInLimit(partnerID int) int {
	var user domain.User
	if err := s.db.Select("DailyPinLimit").First(&user, partnerID).Error; err == nil {
		if user.DailyPinLimit != nil && *user.DailyPinLimit > 0 {
			return *user.DailyPinLimit
		}
	}
	return s.config.GetConfigInt("PARTNER_DAILY_BUY_LIMIT", 100)
}

// maskPIN은 PIN 코드를 마스킹합니다. (앞 4자리 이후를 '*'로 대체)
func maskPIN(pin string) string {
	if len(pin) <= 4 {
		return pin
	}
	return pin[:4] + "****"
}
