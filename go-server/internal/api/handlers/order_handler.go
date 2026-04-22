/*
Package handlers는 주문 관리를 위한 HTTP 요청/응답 핸들링 로직을 제공합니다.
*/
package handlers

import (
	"fmt"
	"net/http"
	"seedream-gift-server/internal/app/services"
	"seedream-gift-server/pkg/notification"
	"seedream-gift-server/pkg/pagination"
	"seedream-gift-server/pkg/response"
	"seedream-gift-server/pkg/telegram"

	"github.com/gin-gonic/gin"
)

// OrderHandler는 주문 관련 HTTP 요청을 처리하는 핸들러입니다.
type OrderHandler struct {
	service *services.OrderService
	notif   *notification.Service
}

// NewOrderHandler는 새로운 OrderHandler 인스턴스를 생성합니다.
func NewOrderHandler(service *services.OrderService, notif *notification.Service) *OrderHandler {
	return &OrderHandler{service: service, notif: notif}
}

func (h *OrderHandler) CreateOrder(c *gin.Context) {
	userId := c.GetInt("userId")
	var input services.CreateOrderInput
	if err := c.ShouldBindJSON(&input); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	order, err := h.service.CreateOrder(c.Request.Context(), userId, input)
	if err != nil {
		response.HandleError(c, err)
		return
	}

	if order.Status == "FRAUD_HOLD" {
		go telegram.SendAlert(telegram.GetGlobalToken(), telegram.GetGlobalChatID(),
			fmt.Sprintf("🚨 <b>사기의심 거래 보류</b>\n━━━━━━━━━━━━━━━\n유형: 주문 #%d\n사용자 ID: %d\n금액: %s원\n━━━━━━━━━━━━━━━\n관리자 패널에서 확인해주세요.",
				order.ID, order.UserID, order.TotalAmount.String()))
		response.Created(c, gin.H{"message": "주문이 검토 중입니다", "orderId": order.ID})
		return
	}

	orderCode := ""
	if order.OrderCode != nil {
		orderCode = *order.OrderCode
	}

	// 통합 알림 (이메일 + 카카오 + 텔레그램)
	if h.notif != nil {
		email := c.GetString("email")
		userName := c.GetString("name")
		userPhone := c.GetString("phone")
		if userName == "" {
			userName = email
		}
		if email != "" {
			go h.notif.OrderCreated(notification.OrderInfo{
				OrderCode:   orderCode,
				UserName:    userName,
				UserEmail:   email,
				UserPhone:   userPhone,
				TotalAmount: int(order.TotalAmount.InexactFloat64()),
			})
		}
	}

	// 주문에 포함된 상품의 장바구니 항목 삭제
	userID := c.GetInt("userId")
	productIDs := make([]int, len(input.Items))
	for i, item := range input.Items {
		productIDs[i] = item.ProductID
	}
	go func() {
		h.service.ClearCartItems(userID, productIDs)
	}()

	response.Created(c, order)
}

func (h *OrderHandler) GetMyOrders(c *gin.Context) {
	userId := c.GetInt("userId")
	var params pagination.QueryParams
	if err := c.ShouldBindQuery(&params); err != nil {
		response.BadRequest(c, "잘못된 조회 요청입니다")
		return
	}
	orders, err := h.service.GetMyOrders(userId, params)
	if err != nil {
		response.HandleError(c, err)
		return
	}
	response.Success(c, orders)
}

func (h *OrderHandler) GetOrderDetail(c *gin.Context) {
	userId := c.GetInt("userId")
	role := c.GetString("role")
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	order, err := h.service.GetOrderDetail(id, userId, role)
	if err != nil {
		response.HandleError(c, err)
		return
	}
	response.Success(c, order)
}

func (h *OrderHandler) GetMyExport(c *gin.Context) {
	c.JSON(http.StatusNotImplemented, gin.H{"error": "미구현 기능입니다"})
}

func (h *OrderHandler) GetMyBankSubmission(c *gin.Context) {
	c.JSON(http.StatusNotImplemented, gin.H{"error": "미구현 기능입니다"})
}

func (h *OrderHandler) CancelOrder(c *gin.Context) {
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	userID := c.GetInt("userId")
	if err := h.service.CancelOrder(id, userID); err != nil {
		response.HandleError(c, err)
		return
	}

	// 취소 알림
	if h.notif != nil {
		email := c.GetString("email")
		userName := c.GetString("name")
		if userName == "" {
			userName = email
		}
		if email != "" {
			go h.notif.OrderCancelled(notification.OrderInfo{
				UserEmail: email,
				UserName:  userName,
			})
		}
	}

	response.Success(c, gin.H{"message": "주문이 취소되었습니다."})
}

type PaymentConfirmRequest struct {
	OrderID    int    `json:"orderId" binding:"required"`
	PaymentKey string `json:"paymentKey" binding:"required"`
}

func (h *OrderHandler) ConfirmPayment(c *gin.Context) {
	var req PaymentConfirmRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	userID := c.GetInt("userId")
	if err := h.service.ProcessPayment(req.OrderID, userID, req.PaymentKey); err != nil {
		response.HandleError(c, err)
		return
	}
	response.Success(c, gin.H{"message": "결제가 확인되어 주문이 처리되었습니다"})
}
