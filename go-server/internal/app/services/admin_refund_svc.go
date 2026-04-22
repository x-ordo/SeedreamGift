package services

import (
	"fmt"
	"time"
	"seedream-gift-server/internal/domain"
	"seedream-gift-server/pkg/apperror"
	"seedream-gift-server/pkg/pagination"

	"gorm.io/gorm"
)

// 관리자 환불 서비스 (admin_refund_svc.go)
// H-6: ApproveRefund는 트랜잭션 내에서 환불 상태, 주문 상태, 바우처 재고를 원자적으로 처리합니다.

// AdminRefundService는 관리자의 환불 관리 기능을 처리합니다.
type AdminRefundService struct {
	db             *gorm.DB
	cashReceiptSvc *CashReceiptService
	ledgerSvc      *LedgerService
}

// SetLedgerService는 복식부기 원장 서비스를 주입합니다.
func (s *AdminRefundService) SetLedgerService(ls *LedgerService) {
	s.ledgerSvc = ls
}

// NewAdminRefundService는 AdminRefundService를 초기화합니다.
// cashReceiptSvc는 선택적 의존성으로, 가변 인자로 받아 기존 호출부 변경 없이 주입할 수 있습니다.
func NewAdminRefundService(db *gorm.DB, cashReceiptSvc ...*CashReceiptService) *AdminRefundService {
	svc := &AdminRefundService{db: db}
	if len(cashReceiptSvc) > 0 {
		svc.cashReceiptSvc = cashReceiptSvc[0]
	}
	return svc
}

func (s *AdminRefundService) GetAllRefunds(params pagination.QueryParams) (pagination.PaginatedResponse[domain.Refund], error) {
	var items []domain.Refund
	var total int64
	s.db.Model(&domain.Refund{}).Count(&total)
	offset := (params.Page - 1) * params.Limit
	err := s.db.Preload("Order").Preload("Order.User").Order("CreatedAt DESC").Offset(offset).Limit(params.Limit).Find(&items).Error
	return pagination.CreatePaginatedResponse(items, total, params.Page, params.Limit), err
}

func (s *AdminRefundService) GetRefund(id int) (*domain.Refund, error) {
	var refund domain.Refund
	err := s.db.Preload("Order").Preload("Order.User").First(&refund, id).Error
	return &refund, err
}

func (s *AdminRefundService) ApproveRefund(id int, adminID int) error {
	// H-6: OrderId 포함 전체 Refund 조회 (주문/바우처 연계 처리 필요)
	var refund domain.Refund
	if err := s.db.Set("gorm:query_option", "WITH (UPDLOCK)").
		Select("Id", "Status", "OrderId", "Amount").First(&refund, id).Error; err != nil {
		return apperror.NotFoundf("refund %d not found", id)
	}
	if err := domain.ValidateRefundApproval(refund.Status); err != nil {
		return err
	}

	now := time.Now()
	err := s.db.Transaction(func(tx *gorm.DB) error {
		// 이중 환불 방지: 동일 주문에 이미 승인된 환불이 있으면 거부
		var existingApproved domain.Refund
		if err := tx.Select("Id").Where("OrderId = ? AND Status = 'APPROVED'", refund.OrderID).First(&existingApproved).Error; err == nil {
			return apperror.Conflict("이미 승인된 환불이 존재합니다")
		}

		// 환불 금액이 주문 총액을 초과하지 않는지 검증
		var order domain.Order
		if err := tx.Select("Id", "TotalAmount", "Status").First(&order, refund.OrderID).Error; err != nil {
			return apperror.NotFound("주문을 찾을 수 없습니다")
		}
		// 낙장불입: PIN 전달 완료(DELIVERED/COMPLETED) 주문은 환불 불가
		if order.Status == "DELIVERED" || order.Status == "COMPLETED" {
			return apperror.Validation("배송 완료된 주문은 환불할 수 없습니다 (PIN이 이미 전달됨)")
		}
		if refund.Amount.Decimal.GreaterThan(order.TotalAmount.Decimal) {
			return apperror.Validation("환불 금액이 주문 금액을 초과할 수 없습니다")
		}

		// 1. 환불 상태를 APPROVED로 변경
		if err := tx.Model(&domain.Refund{}).Where("Id = ?", id).Updates(map[string]any{
			"Status":      "APPROVED",
			"ProcessedBy": adminID,
			"ProcessedAt": now,
		}).Error; err != nil {
			return apperror.Internal("환불 상태 업데이트 실패", err)
		}

		// 2. 연관 주문 상태를 REFUNDED로 변경
		if err := tx.Model(&domain.Order{}).Where("Id = ?", refund.OrderID).
			Update("Status", "REFUNDED").Error; err != nil {
			return apperror.Internal("주문 상태 업데이트 실패", err)
		}

		// 3. STOCK 바우처: AVAILABLE로 복원 (재판매 가능)
		if err := tx.Model(&domain.VoucherCode{}).
			Where("OrderId = ? AND Status = 'SOLD' AND Source != 'API'", refund.OrderID).
			Updates(map[string]any{
				"Status":  "AVAILABLE",
				"SoldAt":  nil,
				"OrderId": nil,
			}).Error; err != nil {
			return apperror.Internal("바우처 재고 복원 실패", err)
		}
		// API 발급 바우처: 외부에서 이미 발급됨 → EXPIRED + PIN 삭제 (재사용 불가)
		if err := tx.Model(&domain.VoucherCode{}).
			Where("OrderId = ? AND Status = 'SOLD' AND Source = 'API'", refund.OrderID).
			Updates(map[string]any{
				"Status":       "EXPIRED",
				"PinCode":      "",
				"SecurityCode": nil,
				"GiftNumber":   nil,
			}).Error; err != nil {
			return apperror.Internal("API 바우처 무효화 실패", err)
		}

		// 4. 복식부기 원장 역분개: DEBIT(CUSTOMER) + CREDIT(REVENUE)
		if s.ledgerSvc != nil {
			if err := s.ledgerSvc.RecordRefund(tx, id, refund.OrderID, refund.Amount.Decimal); err != nil {
				return fmt.Errorf("원장 기록 실패 (환불): %w", err)
			}
		}

		// 5. 선물이 연결된 주문이면 Gift 상태도 업데이트
		tx.Model(&domain.Gift{}).
			Where("OrderId = ? AND Status IN ?", refund.OrderID, []string{"SENT", "CLAIMED"}).
			Update("Status", "REFUNDED")

		// TODO: Call PG refund API (s.paymentProvider.RefundPayment)
		// 현재는 PG사 환불 API 호출이 구현되지 않아 수동 처리 필요

		return nil
	})
	if err != nil {
		return err
	}

	// 현금영수증 취소 (실패해도 환불은 계속 진행)
	if s.cashReceiptSvc != nil {
		go s.cashReceiptSvc.CancelByOrder(refund.OrderID, "주문 환불")
	}

	return nil
}

func (s *AdminRefundService) RejectRefund(id int, adminID int) error {
	var refund domain.Refund
	if err := s.db.Select("Status").First(&refund, id).Error; err != nil {
		return apperror.NotFoundf("refund %d not found", id)
	}
	if err := domain.ValidateRefundApproval(refund.Status); err != nil {
		return err
	}
	now := time.Now()
	return s.db.Model(&domain.Refund{}).Where("Id = ?", id).Updates(map[string]any{
		"Status":      "REJECTED",
		"ProcessedBy": adminID,
		"ProcessedAt": now,
	}).Error
}
