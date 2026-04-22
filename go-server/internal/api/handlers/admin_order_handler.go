package handlers

import (
	"strconv"

	"w-gift-server/internal/app/services"
	"w-gift-server/pkg/email"
	"w-gift-server/pkg/logger"
	"w-gift-server/pkg/notification"
	"w-gift-server/pkg/pagination"
	"w-gift-server/pkg/response"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

type AdminOrderHandler struct {
	service  *services.AdminOrderService
	notif    *notification.Service
	eventSvc *services.OrderEventService
}

func NewAdminOrderHandler(service *services.AdminOrderService, notif *notification.Service) *AdminOrderHandler {
	return &AdminOrderHandler{service: service, notif: notif}
}

// SetOrderEventService는 주문 이벤트 서비스를 주입합니다 (setter injection).
func (h *AdminOrderHandler) SetOrderEventService(svc *services.OrderEventService) {
	h.eventSvc = svc
}

// GetOrderEvents는 주문의 이벤트 이력을 반환합니다.
// GET /api/v1/admin/orders/:id/events
func (h *AdminOrderHandler) GetOrderEvents(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "잘못된 주문 ID")
		return
	}
	if h.eventSvc == nil {
		response.InternalServerError(c, "이벤트 서비스가 초기화되지 않았습니다")
		return
	}
	events, err := h.eventSvc.GetOrderHistory(id)
	if err != nil {
		response.InternalServerError(c, "이벤트 이력 조회 실패")
		return
	}
	response.Success(c, events)
}

func (h *AdminOrderHandler) GetOrders(c *gin.Context) {
	var params pagination.QueryParams
	if err := c.ShouldBindQuery(&params); err != nil {
		response.BadRequest(c, "잘못된 조회 요청입니다")
		return
	}
	status := c.Query("status")
	orders, err := h.service.GetOrders(params, status)
	if err != nil {
		response.HandleError(c, err)
		return
	}
	response.Success(c, orders)
}

func (h *AdminOrderHandler) GetOrderDetail(c *gin.Context) {
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	res, err := h.service.GetOrderDetail(id)
	if err != nil {
		response.HandleError(c, err)
		return
	}
	response.Success(c, res)
}

func (h *AdminOrderHandler) UpdateOrderStatus(c *gin.Context) {
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	var body struct {
		Status string `json:"status" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	if err := h.service.UpdateOrderStatus(id, body.Status); err != nil {
		response.HandleError(c, err)
		return
	}

	// 상태 변경 후 이메일 발송 (비동기)
	go h.sendStatusEmail(id, body.Status)

	response.Success(c, gin.H{"message": "주문 상태가 변경되었습니다"})
}

func (h *AdminOrderHandler) BatchUpdateStatus(c *gin.Context) {
	var body struct {
		IDs    []int  `json:"ids" binding:"required"`
		Status string `json:"status" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	if len(body.IDs) == 0 {
		response.BadRequest(c, "주문 ID 목록이 비어 있습니다")
		return
	}
	count, err := h.service.BatchUpdateOrderStatus(body.IDs, body.Status)
	if err != nil {
		response.HandleError(c, err)
		return
	}

	// 배치 상태 변경 후 각 주문에 이메일 발송 (비동기, 세마포어로 동시 고루틴 수 제한)
	const maxEmailWorkers = 10
	sem := make(chan struct{}, maxEmailWorkers)
	for _, orderID := range body.IDs {
		sem <- struct{}{}
		go func(id int) {
			defer func() { <-sem }()
			h.sendStatusEmail(id, body.Status)
		}(orderID)
	}

	response.Success(c, gin.H{"message": "일괄 처리가 완료되었습니다", "updatedCount": count, "totalRequested": len(body.IDs)})
}

func (h *AdminOrderHandler) AutoDeliver(c *gin.Context) {
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	if err := h.service.AutoDeliver(id); err != nil {
		response.HandleError(c, err)
		return
	}

	// 자동 배송 완료 → PIN 발급 이메일
	go h.sendStatusEmail(id, "DELIVERED")

	response.Success(c, gin.H{"message": "자동 배송이 완료되었습니다"})
}

func (h *AdminOrderHandler) UpdateNote(c *gin.Context) {
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	var body struct {
		AdminNote string `json:"adminNote"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	if err := h.service.UpdateOrderNote(id, body.AdminNote); err != nil {
		response.HandleError(c, err)
		return
	}
	response.Success(c, gin.H{"message": "주문 메모가 업데이트되었습니다"})
}

// sendStatusNotification fetches order detail and sends notifications via all channels.
func (h *AdminOrderHandler) sendStatusEmail(orderID int, status string) {
	if h.notif == nil {
		return
	}

	order, err := h.service.GetOrderDetail(orderID)
	if err != nil {
		logger.Log.Error("notification: failed to get order detail", zap.Int("orderId", orderID), zap.Error(err))
		return
	}

	userEmail := order.User.Email
	if userEmail == "" {
		return
	}
	userName := userEmail
	if order.User.Name != nil {
		userName = *order.User.Name
	}
	userPhone := ""
	if order.User.Phone != nil {
		userPhone = *order.User.Phone
	}
	orderCode := ""
	if order.OrderCode != nil {
		orderCode = *order.OrderCode
	}

	switch status {
	case "PAID":
		var items []email.ReceiptItem
		for _, oi := range order.OrderItems {
			name := oi.Product.Name
			items = append(items, email.ReceiptItem{
				ProductName: name,
				Quantity:    oi.Quantity,
				UnitPrice:   int(oi.Price.InexactFloat64()),
				Subtotal:    int(oi.Price.InexactFloat64()) * oi.Quantity,
			})
		}
		pm := ""
		if order.PaymentMethod != nil {
			pm = *order.PaymentMethod
		}
		h.notif.PaymentConfirmed(notification.OrderInfo{
			OrderCode:     orderCode,
			UserName:      userName,
			UserEmail:     userEmail,
			UserPhone:     userPhone,
			TotalAmount:   int(order.TotalAmount.InexactFloat64()),
			Items:         items,
			PaymentMethod: pm,
		})

	case "DELIVERED":
		var pins []notification.PinItem
		for _, vc := range order.VoucherCodes {
			masked := vc.PinCode
			if len(masked) > 4 {
				masked = masked[:4] + "-****-****"
			}
			pins = append(pins, notification.PinItem{
				ProductName: vc.Product.Name,
				PinCode:     masked,
			})
		}
		h.notif.DeliveryComplete(orderCode, userName, userEmail, userPhone, pins)

	case "CANCELLED":
		h.notif.OrderCancelled(notification.OrderInfo{
			OrderCode:   orderCode,
			UserName:    userName,
			UserEmail:   userEmail,
			UserPhone:   userPhone,
			TotalAmount: int(order.TotalAmount.InexactFloat64()),
		})
	}
}
