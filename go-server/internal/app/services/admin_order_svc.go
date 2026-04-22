package services

import (
	"fmt"
	"time"
	"w-gift-server/internal/domain"
	"w-gift-server/internal/infra/repository"
	"w-gift-server/pkg/apperror"
	"w-gift-server/pkg/pagination"

	"gorm.io/gorm"
)

// kstLoc is the cached KST timezone to avoid repeated calls to time.LoadLocation.
var kstLoc = func() *time.Location {
	loc, err := time.LoadLocation("Asia/Seoul")
	if err != nil {
		return time.FixedZone("KST", 9*60*60)
	}
	return loc
}()

// AdminOrderService는 관리자의 주문 관리 기능을 처리합니다.
type AdminOrderService struct {
	db        *gorm.DB
	orderRepo *repository.BaseRepository[domain.Order]
}

func NewAdminOrderService(db *gorm.DB) *AdminOrderService {
	return &AdminOrderService{
		db:        db,
		orderRepo: repository.NewBaseRepository[domain.Order](db),
	}
}

func (s *AdminOrderService) GetOrders(params pagination.QueryParams, status string) (pagination.PaginatedResponse[domain.Order], error) {
	where := make(map[string]any)
	if status != "" {
		where["Status"] = status
	}
	return s.orderRepo.FindAll(params, where)
}

func (s *AdminOrderService) GetOrderDetail(id int) (*domain.Order, error) {
	var order domain.Order
	if err := s.db.Preload("OrderItems.Product").
		Preload("VoucherCodes.Product").
		Preload("User", func(db *gorm.DB) *gorm.DB {
			return db.Select("Id", "Email", "Name", "Phone", "Role", "KycStatus")
		}).
		First(&order, id).Error; err != nil {
		return nil, err
	}
	return &order, nil
}

func (s *AdminOrderService) UpdateOrderStatus(id int, status string) error {
	var order domain.Order
	if err := s.db.Select("Status").First(&order, id).Error; err != nil {
		return apperror.NotFoundf("order %d not found", id)
	}
	if err := domain.ValidateOrderTransition(order.Status, status); err != nil {
		return apperror.Validation(err.Error())
	}
	return s.db.Model(&domain.Order{}).Where("Id = ?", id).Update("Status", status).Error
}

// BatchUpdateOrderStatus는 여러 주문의 상태를 일괄 변경합니다.
// 단일 SELECT로 모든 주문을 조회하고, 유효한 전환만 필터링한 뒤 단일 UPDATE로 처리합니다.
// 성공한 건수를 반환합니다.
func (s *AdminOrderService) BatchUpdateOrderStatus(ids []int, status string) (int, error) {
	if len(ids) == 0 {
		return 0, nil
	}

	return func() (int, error) {
		var successCount int
		err := s.db.Transaction(func(tx *gorm.DB) error {
			// 단일 SELECT로 모든 주문 조회
			var orders []domain.Order
			if err := tx.Select("Id", "Status").Where("Id IN ?", ids).Find(&orders).Error; err != nil {
				return err
			}

			// 유효한 전환인 주문 ID만 필터링
			validIDs := make([]int, 0, len(orders))
			for _, order := range orders {
				if err := domain.ValidateOrderTransition(order.Status, status); err == nil {
					validIDs = append(validIDs, order.ID)
				}
			}

			if len(validIDs) == 0 {
				return nil
			}

			// 단일 UPDATE로 유효한 주문들의 상태 변경
			if err := tx.Model(&domain.Order{}).Where("Id IN ?", validIDs).Update("Status", status).Error; err != nil {
				return err
			}
			successCount = len(validIDs)
			return nil
		})
		return successCount, err
	}()
}

// AutoDeliver는 결제 완료된 주문에 대해 바우처 PIN을 자동 배정하고 배송 완료 처리합니다.
// 전체 과정이 하나의 트랜잭션으로 실행됩니다.
func (s *AdminOrderService) AutoDeliver(orderID int) error {
	return s.db.Transaction(func(tx *gorm.DB) error {
		// 1. 주문 조회 (with items)
		var order domain.Order
		if err := tx.Preload("OrderItems").First(&order, orderID).Error; err != nil {
			return apperror.NotFoundf("order %d not found", orderID)
		}

		// 2. 상태 검증 (PAID만 가능)
		if order.Status != "PAID" {
			return apperror.Validationf("order %d is not in PAID status (current: %s)", orderID, order.Status)
		}

		// 3. 각 주문 항목별 바우처 배정
		now := time.Now()
		for _, item := range order.OrderItems {
			// 해당 상품의 AVAILABLE 바우처 조회
			var vouchers []domain.VoucherCode
			// ADMIN 공급분 우선 할당, 오래된 것부터 (주문 생성 시와 동일한 우선순위)
			if err := tx.Select("Id").
				Where("ProductId = ? AND Status = 'AVAILABLE'", item.ProductID).
				Order("CASE WHEN Source = 'ADMIN' OR Source IS NULL THEN 0 ELSE 1 END, CreatedAt ASC").
				Limit(item.Quantity).
				Find(&vouchers).Error; err != nil {
				return apperror.Internal(fmt.Sprintf("failed to find vouchers for product %d", item.ProductID), err)
			}
			if len(vouchers) < item.Quantity {
				return apperror.Validationf("insufficient vouchers for product %d: need %d, available %d",
					item.ProductID, item.Quantity, len(vouchers))
			}

			// 바우처 ID 수집 후 단일 UPDATE로 일괄 처리
			voucherIDs := make([]int, len(vouchers))
			for i, v := range vouchers {
				voucherIDs[i] = v.ID
			}
			if err := tx.Model(&domain.VoucherCode{}).Where("Id IN ?", voucherIDs).Updates(map[string]any{
				"OrderId": orderID,
				"Status":  "SOLD",
				"SoldAt":  now,
			}).Error; err != nil {
				return apperror.Internal(fmt.Sprintf("failed to assign vouchers for product %d", item.ProductID), err)
			}
		}

		// 4. 주문 상태를 DELIVERED로 변경
		if err := tx.Model(&domain.Order{}).Where("Id = ?", orderID).Updates(map[string]any{
			"Status":            "DELIVERED",
			"DigitalDeliveryAt": now,
		}).Error; err != nil {
			return apperror.Internal("failed to update order status", err)
		}

		return nil
	})
}

// UpdateOrderNote는 관리자 메모를 업데이트합니다.
func (s *AdminOrderService) UpdateOrderNote(orderID int, note string) error {
	result := s.db.Model(&domain.Order{}).Where("Id = ?", orderID).Update("AdminNote", note)
	if result.RowsAffected == 0 {
		return apperror.NotFoundf("order %d not found", orderID)
	}
	return result.Error
}
