// Package services는 애플리케이션의 핵심 비즈니스 로직을 포함합니다.
// CashReceiptService는 현금영수증 자동 발급, 사후 신청, 취소, 재시도 등 현금영수증 전체 라이프사이클을 담당합니다.
package services

import (
	"fmt"
	"strings"
	"time"
	"seedream-gift-server/internal/app/interfaces"
	"seedream-gift-server/internal/domain"
	"seedream-gift-server/pkg/apperror"
	"seedream-gift-server/pkg/crypto"
	"seedream-gift-server/pkg/logger"

	"go.uber.org/zap"
	"gorm.io/gorm"
)

// cashEquivalentMethods는 현금영수증 발급 대상 결제 수단 집합입니다.
var cashEquivalentMethods = map[string]bool{
	"VIRTUAL_ACCOUNT": true,
	"BANK_TRANSFER":   true,
	"CASH_CARD":       true,
}

// selfIssueIdentity는 자진발급 시 사용하는 국세청 지정 번호입니다.
const selfIssueIdentity = "0100001234"

// maxRetryCount는 실패 재시도 최대 횟수입니다.
const maxRetryCount = 5

// retryWindow는 FAILED 상태의 재시도 가능 시간 범위입니다.
const retryWindow = 72 * time.Hour

// syncWindow는 PENDING 상태의 동기화 가능 시간 범위입니다.
const syncWindow = 7 * 24 * time.Hour

// CashReceiptService는 현금영수증 발급/취소/조회의 비즈니스 로직을 제공합니다.
type CashReceiptService struct {
	db            *gorm.DB
	provider      interfaces.ICashReceiptProvider
	encryptionKey string
}

// NewCashReceiptService는 CashReceiptService를 초기화합니다.
func NewCashReceiptService(db *gorm.DB, provider interfaces.ICashReceiptProvider, encKey string) *CashReceiptService {
	return &CashReceiptService{
		db:            db,
		provider:      provider,
		encryptionKey: encKey,
	}
}

// RequestCashReceiptInput은 사후 현금영수증 신청 요청 데이터입니다.
type RequestCashReceiptInput struct {
	OrderID        int    `json:"orderId" binding:"required"`
	Type           string `json:"type" binding:"required,oneof=INCOME_DEDUCTION EXPENSE_PROOF"`
	IdentityType   string `json:"identityType" binding:"required,oneof=PHONE BUSINESS_NO CARD_NO"`
	IdentityNumber string `json:"identityNumber" binding:"required"`
}

// ── 헬퍼 함수 ──

// isCashEquivalent는 결제 수단이 현금영수증 발급 대상인지 확인합니다.
// 대상: VIRTUAL_ACCOUNT (가상계좌), BANK_TRANSFER (계좌이체), CASH_CARD (현금카드)
func isCashEquivalent(method string) bool {
	return cashEquivalentMethods[method]
}

// splitAmount는 총 금액에서 공급가액(supply)과 부가세(tax)를 분리합니다.
// 부가세 = round(total / 11), 공급가액 = total - tax
func splitAmount(total int64) (supply, tax int64) {
	tax = total / 11
	supply = total - tax
	return supply, tax
}

// mapReceiptType은 주문의 CashReceiptType을 팝빌 TradeUsage 문자열로 변환합니다.
// PERSONAL → INCOME_DEDUCTION(소득공제용), BUSINESS → EXPENSE_PROOF(지출증빙용)
func mapReceiptType(orderType string) string {
	switch orderType {
	case "PERSONAL":
		return "INCOME_DEDUCTION"
	case "BUSINESS":
		return "EXPENSE_PROOF"
	default:
		return "INCOME_DEDUCTION"
	}
}

// mapTradeUsage는 현금영수증 유형을 팝빌 TradeUsage 문자열로 변환합니다.
func mapTradeUsage(receiptType string) string {
	if receiptType == "EXPENSE_PROOF" {
		return "지출증빙용"
	}
	return "소득공제용"
}

// mapTradeOpt는 식별번호 유형을 팝빌 TradeOpt 코드로 변환합니다.
// PHONE → "01", BUSINESS_NO → "02", CARD_NO → "03"
func mapTradeOpt(identityType string) string {
	switch identityType {
	case "PHONE":
		return "01"
	case "BUSINESS_NO":
		return "02"
	case "CARD_NO":
		return "03"
	default:
		return "01"
	}
}

// maskIdentity는 식별번호를 마스킹합니다.
// 예: "01012345678" → "010****5678"
func maskIdentity(num string) string {
	n := len(num)
	if n <= 4 {
		return num
	}
	if n <= 7 {
		return num[:3] + strings.Repeat("*", n-3)
	}
	return num[:3] + strings.Repeat("*", n-7) + num[n-4:]
}

// generateMgtKey는 팝빌 문서 관리번호를 생성합니다.
// 형식: CR-YYYYMMDD-{5자리 주문ID}-{2자리 시퀀스} (최대 24자)
func (s *CashReceiptService) generateMgtKey(orderID int, seq int) string {
	date := time.Now().Format("20060102")
	return fmt.Sprintf("CR-%s-%05d-%02d", date, orderID, seq)
}

// nextMgtKey는 해당 주문에 대한 다음 사용 가능한 관리번호를 반환합니다.
func (s *CashReceiptService) nextMgtKey(orderID int) string {
	var count int64
	s.db.Model(&domain.CashReceipt{}).Where("OrderId = ?", orderID).Count(&count)
	return s.generateMgtKey(orderID, int(count)+1)
}

// ── 핵심 발급 메서드 ──

// AutoIssue는 결제 확정 시 현금영수증을 자동 발급합니다.
// 현금성 결제 수단(가상계좌/계좌이체/현금카드)에 대해서만 동작합니다.
// 발급 실패는 결제 확정을 막지 않으므로 오류를 로그에 남기고 nil을 반환합니다.
func (s *CashReceiptService) AutoIssue(orderID int) error {
	var order domain.Order
	if err := s.db.First(&order, orderID).Error; err != nil {
		logger.Log.Warn("AutoIssue: 주문 조회 실패", zap.Int("orderID", orderID), zap.Error(err))
		return nil
	}

	// 현금성 결제 수단이 아니면 발급 불필요
	if order.PaymentMethod == nil || !isCashEquivalent(*order.PaymentMethod) {
		return nil
	}

	totalAmount := order.TotalAmount.IntPart()
	supply, tax := splitAmount(totalAmount)

	var receiptType string
	var identityNum string
	var identityType string
	var isAutoIssued bool

	if order.CashReceiptType != nil && *order.CashReceiptType != "" &&
		order.CashReceiptNumber != nil && *order.CashReceiptNumber != "" {
		// 고객이 현금영수증 정보를 제공한 경우
		receiptType = mapReceiptType(*order.CashReceiptType)
		identityNum = *order.CashReceiptNumber
		identityType = "PHONE" // 기본값: 휴대폰 번호
		isAutoIssued = false
	} else {
		// 자진발급
		receiptType = "INCOME_DEDUCTION"
		identityNum = selfIssueIdentity
		identityType = "PHONE"
		isAutoIssued = true
	}

	mgtKey := s.nextMgtKey(orderID)

	// PENDING 상태로 레코드 먼저 생성
	encIdentity, encErr := crypto.Encrypt(identityNum, s.encryptionKey)
	if encErr != nil {
		logger.Log.Error("AutoIssue: 식별번호 암호화 실패", zap.Error(encErr))
		encIdentity = ""
	}

	receipt := &domain.CashReceipt{
		OrderID:        orderID,
		UserID:         order.UserID,
		Type:           receiptType,
		IdentityType:   identityType,
		IdentityNumber: encIdentity,
		MaskedIdentity: maskIdentity(identityNum),
		SupplyAmount:   domain.NewNumericDecimalFromInt(supply),
		TaxAmount:      domain.NewNumericDecimalFromInt(tax),
		TotalAmount:    domain.NewNumericDecimalFromInt(totalAmount),
		MgtKey:         mgtKey,
		Status:         "PENDING",
		IsAutoIssued:   isAutoIssued,
	}

	if err := s.db.Create(receipt).Error; err != nil {
		logger.Log.Error("AutoIssue: 현금영수증 레코드 생성 실패", zap.Int("orderID", orderID), zap.Error(err))
		return nil
	}

	// 팝빌 API 호출
	resp, err := s.provider.Issue(interfaces.CashReceiptIssueRequest{
		MgtKey:       mgtKey,
		TradeType:    "승인거래",
		IdentityNum:  identityNum,
		ItemName:     fmt.Sprintf("주문 #%d", orderID),
		SupplyAmount: supply,
		TaxAmount:    tax,
		TotalAmount:  totalAmount,
		TradeUsage:   mapTradeUsage(receiptType),
		TradeOpt:     mapTradeOpt(identityType),
	})

	now := time.Now()
	if err != nil || !resp.Success {
		reason := "provider 오류"
		if err != nil {
			reason = err.Error()
		}
		s.db.Model(receipt).Updates(map[string]any{
			"Status":     "FAILED",
			"FailReason": reason,
		})
		logger.Log.Warn("AutoIssue: 현금영수증 발급 실패 (결제는 정상 처리됨)",
			zap.Int("orderID", orderID), zap.String("reason", reason))
		return nil
	}

	s.db.Model(receipt).Updates(map[string]any{
		"Status":     "ISSUED",
		"ConfirmNum": resp.ConfirmNum,
		"TradeDate":  resp.TradeDate,
		"IssuedAt":   now,
	})

	return nil
}

// RequestAfterPurchase는 구매 후 사후 현금영수증 신청을 처리합니다.
// 결제 후 90일 이내, 현금성 결제 수단, 완료된 주문에 대해서만 신청 가능합니다.
// 자진발급 건이 있는 경우 UpdateTransaction으로 식별번호를 변경합니다.
func (s *CashReceiptService) RequestAfterPurchase(userID int, input RequestCashReceiptInput) (*domain.CashReceipt, error) {
	var order domain.Order
	if err := s.db.First(&order, input.OrderID).Error; err != nil {
		return nil, apperror.NotFound("주문을 찾을 수 없습니다")
	}

	// 소유자 검증
	if order.UserID != userID {
		return nil, apperror.Forbidden("해당 주문에 대한 현금영수증 신청 권한이 없습니다")
	}

	// 현금성 결제 수단 검증
	if order.PaymentMethod == nil || !isCashEquivalent(*order.PaymentMethod) {
		return nil, apperror.Validation("현금영수증은 가상계좌, 계좌이체, 현금카드 결제 건에만 신청 가능합니다")
	}

	// 주문 상태 검증 (PAID, DELIVERED, COMPLETED)
	validStatuses := map[string]bool{"PAID": true, "DELIVERED": true, "COMPLETED": true}
	if !validStatuses[order.Status] {
		return nil, apperror.Validationf("현금영수증 신청은 결제 완료 상태의 주문에만 가능합니다 (현재: %s)", order.Status)
	}

	// 90일 이내 검증
	if time.Since(order.CreatedAt) > 90*24*time.Hour {
		return nil, apperror.Validation("현금영수증 신청 기한(90일)이 초과되었습니다")
	}

	// 기존 현금영수증 조회
	var existing domain.CashReceipt
	existErr := s.db.Where("OrderId = ? AND Status IN ('PENDING','ISSUED')", input.OrderID).
		First(&existing).Error

	encIdentity, err := crypto.Encrypt(input.IdentityNumber, s.encryptionKey)
	if err != nil {
		return nil, apperror.Internal("식별번호 암호화 실패", err)
	}
	masked := maskIdentity(input.IdentityNumber)

	if existErr == nil {
		// 기존 발급 건이 있음
		if existing.IsAutoIssued {
			// 자진발급 건 → UpdateTransaction으로 식별번호 변경
			tradeUsage := mapTradeUsage(input.Type)
			if err := s.provider.UpdateTransaction(existing.MgtKey, input.IdentityNumber, tradeUsage); err != nil {
				return nil, apperror.Internal("현금영수증 수정 실패", err)
			}
			now := time.Now()
			s.db.Model(&existing).Updates(map[string]any{
				"Type":           input.Type,
				"IdentityType":   input.IdentityType,
				"IdentityNumber": encIdentity,
				"MaskedIdentity": masked,
				"IsAutoIssued":   false,
				"IssuedAt":       now,
			})
			existing.Type = input.Type
			existing.IdentityType = input.IdentityType
			existing.MaskedIdentity = masked
			existing.IsAutoIssued = false
			return &existing, nil
		}
		// 자진발급이 아닌 이미 발급된 건 → 중복 신청 거부
		return nil, apperror.Conflict("이미 현금영수증이 발급된 주문입니다")
	}

	// 기존 건 없음 → 신규 발급
	totalAmount := order.TotalAmount.IntPart()
	supply, taxAmt := splitAmount(totalAmount)
	mgtKey := s.nextMgtKey(input.OrderID)

	receipt := &domain.CashReceipt{
		OrderID:        input.OrderID,
		UserID:         userID,
		Type:           input.Type,
		IdentityType:   input.IdentityType,
		IdentityNumber: encIdentity,
		MaskedIdentity: masked,
		SupplyAmount:   domain.NewNumericDecimalFromInt(supply),
		TaxAmount:      domain.NewNumericDecimalFromInt(taxAmt),
		TotalAmount:    domain.NewNumericDecimalFromInt(totalAmount),
		MgtKey:         mgtKey,
		Status:         "PENDING",
		IsAutoIssued:   false,
	}

	if err := s.db.Create(receipt).Error; err != nil {
		return nil, apperror.Internal("현금영수증 레코드 생성 실패", err)
	}

	resp, err := s.provider.Issue(interfaces.CashReceiptIssueRequest{
		MgtKey:       mgtKey,
		TradeType:    "승인거래",
		IdentityNum:  input.IdentityNumber,
		ItemName:     fmt.Sprintf("주문 #%d", input.OrderID),
		SupplyAmount: supply,
		TaxAmount:    taxAmt,
		TotalAmount:  totalAmount,
		TradeUsage:   mapTradeUsage(input.Type),
		TradeOpt:     mapTradeOpt(input.IdentityType),
	})

	if err != nil || !resp.Success {
		reason := "provider 오류"
		if err != nil {
			reason = err.Error()
		}
		s.db.Model(receipt).Updates(map[string]any{
			"Status":     "FAILED",
			"FailReason": reason,
		})
		return nil, apperror.Internal("현금영수증 발급 실패: "+reason, err)
	}

	now := time.Now()
	s.db.Model(receipt).Updates(map[string]any{
		"Status":     "ISSUED",
		"ConfirmNum": resp.ConfirmNum,
		"TradeDate":  resp.TradeDate,
		"IssuedAt":   now,
	})
	receipt.Status = "ISSUED"
	receipt.ConfirmNum = &resp.ConfirmNum
	receipt.TradeDate = &resp.TradeDate
	receipt.IssuedAt = &now

	return receipt, nil
}

// CancelByOrder는 환불 처리 시 해당 주문의 현금영수증을 취소합니다.
// 취소 실패는 환불을 막지 않으므로 오류를 로그에 남기고 nil을 반환합니다.
func (s *CashReceiptService) CancelByOrder(orderID int, reason string) error {
	var receipt domain.CashReceipt
	if err := s.db.Where("OrderId = ? AND Status = 'ISSUED'", orderID).First(&receipt).Error; err != nil {
		// 발급된 현금영수증이 없으면 취소 불필요
		return nil
	}

	if receipt.ConfirmNum == nil || receipt.TradeDate == nil {
		logger.Log.Warn("CancelByOrder: 승인번호 또는 거래일자 없음",
			zap.Int("receiptID", receipt.ID))
		return nil
	}

	totalAmount := receipt.TotalAmount.IntPart()
	supply := receipt.SupplyAmount.IntPart()
	taxAmt := receipt.TaxAmount.IntPart()

	cancelMgtKey := s.nextMgtKey(orderID)
	resp, err := s.provider.Cancel(interfaces.CashReceiptCancelRequest{
		MgtKey:        cancelMgtKey,
		OrgConfirmNum: *receipt.ConfirmNum,
		OrgTradeDate:  *receipt.TradeDate,
		SupplyAmount:  supply,
		TaxAmount:     taxAmt,
		TotalAmount:   totalAmount,
		CancelReason:  reason,
	})

	if err != nil || !resp.Success {
		errMsg := "provider 오류"
		if err != nil {
			errMsg = err.Error()
		}
		logger.Log.Warn("CancelByOrder: 현금영수증 취소 실패 (환불은 정상 처리됨)",
			zap.Int("orderID", orderID), zap.String("reason", errMsg))
		return nil
	}

	now := time.Now()
	// 원본 현금영수증 상태를 CANCELLED로 변경
	s.db.Model(&receipt).Updates(map[string]any{
		"Status":      "CANCELLED",
		"CancelledAt": now,
	})

	// 취소 레코드 생성
	originalID := receipt.ID
	cancelReceipt := &domain.CashReceipt{
		OrderID:            orderID,
		UserID:             receipt.UserID,
		Type:               receipt.Type,
		IdentityType:       receipt.IdentityType,
		IdentityNumber:     receipt.IdentityNumber,
		MaskedIdentity:     receipt.MaskedIdentity,
		SupplyAmount:       domain.NewNumericDecimalFromInt(-supply),
		TaxAmount:          domain.NewNumericDecimalFromInt(-taxAmt),
		TotalAmount:        domain.NewNumericDecimalFromInt(-totalAmount),
		MgtKey:             cancelMgtKey,
		ConfirmNum:         &resp.ConfirmNum,
		TradeDate:          &resp.TradeDate,
		Status:             "ISSUED",
		CancelledReceiptID: &originalID,
		IssuedAt:           &now,
	}
	if err := s.db.Create(cancelReceipt).Error; err != nil {
		logger.Log.Error("CancelByOrder: 취소 레코드 생성 실패",
			zap.Int("orderID", orderID), zap.Error(err))
	}

	return nil
}

// ── 사용자 조회 메서드 ──

// GetMyReceipts는 사용자의 현금영수증 목록을 페이지네이션하여 반환합니다.
func (s *CashReceiptService) GetMyReceipts(userID int, page, limit int) ([]domain.CashReceipt, int64, error) {
	var receipts []domain.CashReceipt
	var total int64

	query := s.db.Model(&domain.CashReceipt{}).Where("UserId = ?", userID)
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, apperror.Internal("현금영수증 수 조회 실패", err)
	}

	offset := (page - 1) * limit
	err := query.Order("Id DESC").Offset(offset).Limit(limit).Find(&receipts).Error
	if err != nil {
		return nil, 0, apperror.Internal("현금영수증 목록 조회 실패", err)
	}

	return receipts, total, nil
}

// GetByID는 사용자의 특정 현금영수증 상세 정보를 반환합니다.
func (s *CashReceiptService) GetByID(userID, receiptID int) (*domain.CashReceipt, error) {
	var receipt domain.CashReceipt
	if err := s.db.First(&receipt, receiptID).Error; err != nil {
		return nil, apperror.NotFound("현금영수증을 찾을 수 없습니다")
	}
	if receipt.UserID != userID {
		return nil, apperror.Forbidden("해당 현금영수증에 대한 접근 권한이 없습니다")
	}
	return &receipt, nil
}

// ── 크론 메서드 ──

// RetryFailedReceipts는 FAILED 상태의 현금영수증을 재시도합니다.
// 72시간 이내, 최대 5회 미만인 건을 대상으로 합니다.
func (s *CashReceiptService) RetryFailedReceipts() {
	var receipts []domain.CashReceipt
	cutoff := time.Now().Add(-retryWindow)
	s.db.Where("Status = 'FAILED' AND RetryCount < ? AND CreatedAt > ?", maxRetryCount, cutoff).
		Find(&receipts)

	for _, r := range receipts {
		identityNum, err := crypto.DecryptAuto(r.IdentityNumber, s.encryptionKey)
		if err != nil {
			logger.Log.Error("RetryFailedReceipts: 식별번호 복호화 실패",
				zap.Int("receiptID", r.ID), zap.Error(err))
			s.db.Model(&r).UpdateColumn("RetryCount", gorm.Expr("RetryCount + 1"))
			continue
		}

		supply := r.SupplyAmount.IntPart()
		taxAmt := r.TaxAmount.IntPart()
		totalAmount := r.TotalAmount.IntPart()

		resp, err := s.provider.Issue(interfaces.CashReceiptIssueRequest{
			MgtKey:       r.MgtKey,
			TradeType:    "승인거래",
			IdentityNum:  identityNum,
			ItemName:     fmt.Sprintf("주문 #%d", r.OrderID),
			SupplyAmount: supply,
			TaxAmount:    taxAmt,
			TotalAmount:  totalAmount,
			TradeUsage:   mapTradeUsage(r.Type),
			TradeOpt:     mapTradeOpt(r.IdentityType),
		})

		if err != nil || !resp.Success {
			errMsg := "provider 오류"
			if err != nil {
				errMsg = err.Error()
			}
			s.db.Model(&r).Updates(map[string]any{
				"RetryCount": gorm.Expr("RetryCount + 1"),
				"FailReason": errMsg,
			})
			logger.Log.Warn("RetryFailedReceipts: 재시도 실패",
				zap.Int("receiptID", r.ID), zap.String("reason", errMsg))
			continue
		}

		now := time.Now()
		s.db.Model(&r).Updates(map[string]any{
			"Status":     "ISSUED",
			"ConfirmNum": resp.ConfirmNum,
			"TradeDate":  resp.TradeDate,
			"IssuedAt":   now,
			"RetryCount": gorm.Expr("RetryCount + 1"),
		})
		logger.Log.Info("RetryFailedReceipts: 재시도 성공", zap.Int("receiptID", r.ID))
	}
}

// SyncPendingReceipts는 PENDING 상태의 현금영수증을 팝빌에서 조회하여 상태를 동기화합니다.
// 7일 이내의 건을 대상으로 합니다.
func (s *CashReceiptService) SyncPendingReceipts() {
	var receipts []domain.CashReceipt
	cutoff := time.Now().Add(-syncWindow)
	s.db.Where("Status = 'PENDING' AND CreatedAt > ?", cutoff).Find(&receipts)

	for _, r := range receipts {
		info, err := s.provider.GetInfo(r.MgtKey)
		if err != nil {
			logger.Log.Warn("SyncPendingReceipts: GetInfo 실패",
				zap.Int("receiptID", r.ID), zap.Error(err))
			continue
		}

		// StateCode 2 = 정상 발급 완료
		if info.StateCode == 2 {
			now := time.Now()
			s.db.Model(&r).Updates(map[string]any{
				"Status":     "ISSUED",
				"ConfirmNum": info.ConfirmNum,
				"TradeDate":  info.TradeDate,
				"IssuedAt":   now,
			})
		}
	}
}

// ── 관리자 메서드 ──

// AdminGetAll은 관리자용 현금영수증 전체 목록을 페이지네이션하여 반환합니다.
func (s *CashReceiptService) AdminGetAll(page, limit int, status string) ([]domain.CashReceipt, int64, error) {
	var receipts []domain.CashReceipt
	var total int64

	query := s.db.Model(&domain.CashReceipt{})
	if status != "" {
		query = query.Where("Status = ?", status)
	}

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, apperror.Internal("현금영수증 수 조회 실패", err)
	}

	offset := (page - 1) * limit
	err := query.Order("Id DESC").Offset(offset).Limit(limit).Find(&receipts).Error
	if err != nil {
		return nil, 0, apperror.Internal("현금영수증 목록 조회 실패", err)
	}

	return receipts, total, nil
}

// AdminGetByID는 관리자용 특정 현금영수증 상세 정보를 반환합니다.
func (s *CashReceiptService) AdminGetByID(id int) (*domain.CashReceipt, error) {
	var receipt domain.CashReceipt
	if err := s.db.Preload("Order").Preload("User").First(&receipt, id).Error; err != nil {
		return nil, apperror.NotFound("현금영수증을 찾을 수 없습니다")
	}
	return &receipt, nil
}

// AdminCancel은 관리자가 특정 현금영수증을 취소합니다.
func (s *CashReceiptService) AdminCancel(receiptID int, reason string) error {
	var receipt domain.CashReceipt
	if err := s.db.First(&receipt, receiptID).Error; err != nil {
		return apperror.NotFound("현금영수증을 찾을 수 없습니다")
	}

	if receipt.Status != "ISSUED" {
		return apperror.Validationf("ISSUED 상태의 현금영수증만 취소할 수 있습니다 (현재: %s)", receipt.Status)
	}

	if receipt.ConfirmNum == nil || receipt.TradeDate == nil {
		return apperror.Validation("승인번호 또는 거래일자 정보가 없어 취소할 수 없습니다")
	}

	totalAmount := receipt.TotalAmount.IntPart()
	supply := receipt.SupplyAmount.IntPart()
	taxAmt := receipt.TaxAmount.IntPart()

	cancelMgtKey := s.nextMgtKey(receipt.OrderID)
	resp, err := s.provider.Cancel(interfaces.CashReceiptCancelRequest{
		MgtKey:        cancelMgtKey,
		OrgConfirmNum: *receipt.ConfirmNum,
		OrgTradeDate:  *receipt.TradeDate,
		SupplyAmount:  supply,
		TaxAmount:     taxAmt,
		TotalAmount:   totalAmount,
		CancelReason:  reason,
	})

	if err != nil || !resp.Success {
		reason := "provider 오류"
		if err != nil {
			reason = err.Error()
		}
		return apperror.Internal("현금영수증 취소 실패: "+reason, err)
	}

	now := time.Now()
	s.db.Model(&receipt).Updates(map[string]any{
		"Status":      "CANCELLED",
		"CancelledAt": now,
	})

	originalID := receipt.ID
	cancelReceipt := &domain.CashReceipt{
		OrderID:            receipt.OrderID,
		UserID:             receipt.UserID,
		Type:               receipt.Type,
		IdentityType:       receipt.IdentityType,
		IdentityNumber:     receipt.IdentityNumber,
		MaskedIdentity:     receipt.MaskedIdentity,
		SupplyAmount:       domain.NewNumericDecimalFromInt(-supply),
		TaxAmount:          domain.NewNumericDecimalFromInt(-taxAmt),
		TotalAmount:        domain.NewNumericDecimalFromInt(-totalAmount),
		MgtKey:             cancelMgtKey,
		ConfirmNum:         &resp.ConfirmNum,
		TradeDate:          &resp.TradeDate,
		Status:             "ISSUED",
		CancelledReceiptID: &originalID,
		IssuedAt:           &now,
	}
	if err := s.db.Create(cancelReceipt).Error; err != nil {
		return apperror.Internal("취소 레코드 생성 실패", err)
	}

	return nil
}

// AdminReissue는 관리자가 FAILED 상태의 현금영수증을 재발급합니다.
func (s *CashReceiptService) AdminReissue(receiptID int) error {
	var receipt domain.CashReceipt
	if err := s.db.First(&receipt, receiptID).Error; err != nil {
		return apperror.NotFound("현금영수증을 찾을 수 없습니다")
	}

	if receipt.Status != "FAILED" {
		return apperror.Validationf("FAILED 상태의 현금영수증만 재발급할 수 있습니다 (현재: %s)", receipt.Status)
	}

	identityNum, err := crypto.DecryptAuto(receipt.IdentityNumber, s.encryptionKey)
	if err != nil {
		return apperror.Internal("식별번호 복호화 실패", err)
	}

	supply := receipt.SupplyAmount.IntPart()
	taxAmt := receipt.TaxAmount.IntPart()
	totalAmount := receipt.TotalAmount.IntPart()

	resp, err := s.provider.Issue(interfaces.CashReceiptIssueRequest{
		MgtKey:       receipt.MgtKey,
		TradeType:    "승인거래",
		IdentityNum:  identityNum,
		ItemName:     fmt.Sprintf("주문 #%d", receipt.OrderID),
		SupplyAmount: supply,
		TaxAmount:    taxAmt,
		TotalAmount:  totalAmount,
		TradeUsage:   mapTradeUsage(receipt.Type),
		TradeOpt:     mapTradeOpt(receipt.IdentityType),
	})

	if err != nil || !resp.Success {
		errMsg := "provider 오류"
		if err != nil {
			errMsg = err.Error()
		}
		s.db.Model(&receipt).Updates(map[string]any{
			"RetryCount": gorm.Expr("RetryCount + 1"),
			"FailReason": errMsg,
		})
		return apperror.Internal("현금영수증 재발급 실패: "+errMsg, err)
	}

	now := time.Now()
	s.db.Model(&receipt).Updates(map[string]any{
		"Status":     "ISSUED",
		"ConfirmNum": resp.ConfirmNum,
		"TradeDate":  resp.TradeDate,
		"IssuedAt":   now,
		"RetryCount": gorm.Expr("RetryCount + 1"),
	})

	return nil
}
