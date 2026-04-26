package services

import (
	"context"
	"fmt"
	"strings"
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
	cancelSvc      *CancelService // VA 수동환불용 (Seedream RefundDeposited 호출)
}

// SetLedgerService는 복식부기 원장 서비스를 주입합니다.
func (s *AdminRefundService) SetLedgerService(ls *LedgerService) {
	s.ledgerSvc = ls
}

// SetCancelService 는 Seedream Cancel/Refund API 호출용 서비스를 주입합니다.
// 미주입 상태에서는 SeedreamRefund 호출 시 명시적 에러를 반환.
func (s *AdminRefundService) SetCancelService(cs *CancelService) {
	s.cancelSvc = cs
}

// AdminSeedreamRefundInput 은 관리자 VA 수동환불 입력입니다.
// CancelService.Refund 와 다르게 UserID 는 주문에서 자동 해석 (admin 권한이라 owner check 우회).
type AdminSeedreamRefundInput struct {
	BankCode     string // 9개 화이트리스트 (BankCodesCancel)
	AccountNo    string // 6~20자 숫자/하이픈
	CancelReason string // 5~50 rune
}

// SeedreamRefund 는 환불 row 가 가리키는 VA 주문에 대해 Seedream RefundDeposited 를 호출하고,
// 성공 시 ApproveRefund 와 동등한 후처리(상태 전이/원장 기록/현금영수증 취소)를 수행합니다.
//
// 전제:
//   - Refund.Status 는 REQUESTED 여야 함 (이미 APPROVED 면 cap. 진입 불가).
//   - Order.PaymentMethod 가 'VIRTUAL_ACCOUNT*' 이어야 함 (그 외는 기존 ApproveRefund 사용).
//
// 동작 순서:
//  1. Refund + Order 로드, 입력/상태 검증.
//  2. cancelSvc.Refund 동기 호출 — Seedream API 가 200 또는 ErrCancelAlreadyDone 이면 진행.
//  3. ApproveRefund 와 동일한 트랜잭션 후처리.
func (s *AdminRefundService) SeedreamRefund(ctx context.Context, refundID, adminID int, in AdminSeedreamRefundInput) error {
	if s.cancelSvc == nil {
		return apperror.Internal("CancelService 미주입 — SeedreamRefund 사용 불가", nil)
	}

	var refund domain.Refund
	if err := s.db.Preload("Order").First(&refund, refundID).Error; err != nil {
		return apperror.NotFoundf("refund %d not found", refundID)
	}
	if err := domain.ValidateRefundApproval(refund.Status); err != nil {
		return err
	}
	if refund.Order.OrderCode == nil || *refund.Order.OrderCode == "" {
		return apperror.Validation("주문에 OrderCode 가 없어 Seedream 환불 불가")
	}
	pm := ""
	if refund.Order.PaymentMethod != nil {
		pm = *refund.Order.PaymentMethod
	}
	if !strings.HasPrefix(pm, "VIRTUAL_ACCOUNT") {
		return apperror.Validationf("VA 주문이 아닙니다 (PaymentMethod=%q) — 일반 ApproveRefund 사용", pm)
	}

	// 1) Seedream API 동기 호출 (입력 validation 은 CancelService 가 수행)
	result, cancelErr := s.cancelSvc.Refund(ctx, SeedreamRefundInput{
		OrderCode:    *refund.Order.OrderCode,
		CancelReason: in.CancelReason,
		BankCode:     in.BankCode,
		AccountNo:    in.AccountNo,
		UserID:       refund.Order.UserID, // admin 우회: 실제 주문 소유자 ID 그대로 전달
	})
	if cancelErr != nil {
		return fmt.Errorf("seedream refund 호출 실패: %w", cancelErr)
	}

	now := time.Now()
	adminNote := "Seedream RefundDeposited 성공"
	if result != nil && result.AlreadyDone {
		adminNote = "Seedream 측 이미 환불 처리됨 (idempotent)"
	}

	// 2) ApproveRefund 와 동등한 트랜잭션 후처리
	err := s.db.Transaction(func(tx *gorm.DB) error {
		var existingApproved domain.Refund
		if err := tx.Select("Id").Where("OrderId = ? AND Status = 'APPROVED'", refund.OrderID).First(&existingApproved).Error; err == nil {
			return apperror.Conflict("이미 승인된 환불이 존재합니다")
		}

		if err := tx.Model(&domain.Refund{}).Where("Id = ?", refundID).Updates(map[string]any{
			"Status":      "APPROVED",
			"ProcessedBy": adminID,
			"ProcessedAt": now,
			"AdminNote":   adminNote,
		}).Error; err != nil {
			return err
		}

		if err := tx.Model(&domain.Order{}).Where("Id = ?", refund.OrderID).Updates(map[string]any{
			"Status":    "REFUNDED",
			"AdminNote": fmt.Sprintf("ADMIN_VA_REFUND by adminId=%d: %s", adminID, in.CancelReason),
		}).Error; err != nil {
			return err
		}

		if s.ledgerSvc != nil {
			if err := s.ledgerSvc.RecordRefund(tx, refundID, refund.OrderID, refund.Amount.Decimal); err != nil {
				return fmt.Errorf("원장 기록 실패 (Seedream 환불): %w", err)
			}
		}

		tx.Model(&domain.Gift{}).
			Where("OrderId = ? AND Status IN ?", refund.OrderID, []string{"SENT", "CLAIMED"}).
			Update("Status", "REFUNDED")

		return nil
	})
	if err != nil {
		return err
	}

	if s.cashReceiptSvc != nil {
		go s.cashReceiptSvc.CancelByOrder(refund.OrderID, "VA 수동환불")
	}
	return nil
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
