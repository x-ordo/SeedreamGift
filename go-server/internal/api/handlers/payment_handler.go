/*
Package handlers는 결제 처리를 위한 HTTP 요청/응답 핸들링 로직을 제공합니다.
결제 시작, 검증 및 웹훅 처리를 담당합니다.
*/
package handlers

import (
	"encoding/json"
	"io"
	"strconv"
	"seedream-gift-server/internal/app/services"
	"seedream-gift-server/pkg/logger"
	"seedream-gift-server/pkg/response"

	"github.com/gin-gonic/gin"
)

// PaymentHandler는 결제 관련 HTTP 요청을 처리하는 핸들러입니다.
type PaymentHandler struct {
	service *services.PaymentService
}

// NewPaymentHandler는 새로운 PaymentHandler 인스턴스를 생성합니다.
func NewPaymentHandler(service *services.PaymentService) *PaymentHandler {
	return &PaymentHandler{service: service}
}

// InitiatePayment godoc
// @Summary 결제 시작 요청
// @Description 새로운 주문에 대해 결제 프로세스를 시작합니다. PG사 결제 페이지로 리다이렉트하기 위한 정보를 생성합니다.
// @Tags Payments
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param body body services.PaymentInitiateRequest true "결제 요청 정보"
// @Success 200 {object} APIResponse
// @Failure 400 {object} APIResponse
// @Failure 500 {object} APIResponse
// @Router /payments/initiate [post]
// InitiatePayment는 새로운 결제 프로세스를 시작합니다.
func (h *PaymentHandler) InitiatePayment(c *gin.Context) {
	var req services.PaymentInitiateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	userID := c.GetInt("userId")
	res, err := h.service.InitiatePayment(userID, req)
	if err != nil {
		response.HandleError(c, err)
		return
	}

	response.Success(c, res)
}

// VerifyPayment godoc
// @Summary 결제 검증 및 승인
// @Description 사용자가 결제를 완료한 후, PG사(토스 등)를 통해 최종 결제 승인 처리를 수행합니다.
// @Tags Payments
// @Produce json
// @Security BearerAuth
// @Param paymentKey query string true "결제 고유 키"
// @Param orderId query int true "주문 번호"
// @Success 200 {object} APIResponse
// @Failure 400 {object} APIResponse
// @Router /payments/verify [get]
// VerifyPayment는 완료된 결제의 유효성을 PG사를 통해 검증하고 주문 상태를 업데이트합니다.
func (h *PaymentHandler) VerifyPayment(c *gin.Context) {
	paymentKey := c.Query("paymentKey")
	orderIDStr := c.Query("orderId")
	orderID, err := strconv.Atoi(orderIDStr)
	if err != nil || orderID <= 0 || paymentKey == "" {
		response.BadRequest(c, "paymentKey와 orderId(양수)가 필요합니다")
		return
	}

	userID := c.GetInt("userId")
	res, err := h.service.VerifyPayment(userID, paymentKey, orderID)
	if err != nil {
		response.HandleError(c, err)
		return
	}

	response.Success(c, res)
}

// Webhook은 PG사로부터 전송되는 비동기 결제 상태 변경 알림을 처리합니다.
// 가상계좌 입금 확인이나 결제 취소 등의 이벤트를 수신합니다.
func (h *PaymentHandler) Webhook(c *gin.Context) {
	// 원본 바디를 서명 검증용으로 보존
	rawBody, err := io.ReadAll(c.Request.Body)
	if err != nil {
		response.BadRequest(c, "요청 본문을 읽을 수 없습니다")
		return
	}

	var payload map[string]any
	if err := json.Unmarshal(rawBody, &payload); err != nil {
		response.BadRequest(c, "잘못된 JSON 형식입니다")
		return
	}

	// PG사 서명 검증 (X-Webhook-Signature 헤더)
	signatureHeader := c.GetHeader("X-Webhook-Signature")
	webhookSecret := c.GetString("webhookSecret")
	if webhookSecret == "" {
		logger.Log.Error("웹훅 시크릿 미설정 — 웹훅 거부")
		response.Unauthorized(c, "웹훅 설정이 완료되지 않았습니다")
		return
	}

	if err := h.service.HandleWebhook(payload, signatureHeader, rawBody, webhookSecret); err != nil {
		response.HandleError(c, err)
		return
	}

	response.Success(c, gin.H{"received": true})
}
