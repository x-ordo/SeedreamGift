// Package handlers는 HTTP 요청 및 응답 처리 로직을 제공합니다.
package handlers

import (
	"fmt"
	"w-gift-server/internal/app/services"
	"w-gift-server/pkg/notification"
	"w-gift-server/pkg/pagination"
	"w-gift-server/pkg/response"
	"w-gift-server/pkg/telegram"

	"github.com/gin-gonic/gin"
)

type TradeInHandler struct {
	service *services.TradeInService
	notif   *notification.Service
}

func NewTradeInHandler(service *services.TradeInService, notif *notification.Service) *TradeInHandler {
	return &TradeInHandler{service: service, notif: notif}
}

func (h *TradeInHandler) SubmitTradeIn(c *gin.Context) {
	userId := c.GetInt("userId")
	var input services.CreateTradeInInput
	if err := c.ShouldBindJSON(&input); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	tradeIn, err := h.service.SubmitTradeIn(userId, input)
	if err != nil {
		response.HandleError(c, err)
		return
	}

	if tradeIn.Status == "FRAUD_HOLD" {
		go telegram.SendAlert(telegram.GetGlobalToken(), telegram.GetGlobalChatID(),
			fmt.Sprintf("🚨 <b>사기의심 매입 보류</b>\n━━━━━━━━━━━━━━━\n유형: 매입 #%d\n사용자 ID: %d\n금액: %s원\n━━━━━━━━━━━━━━━\n관리자 패널에서 확인해주세요.",
				tradeIn.ID, tradeIn.UserID, tradeIn.PayoutAmount.String()))
		response.Created(c, gin.H{"message": "매입 신청이 검토 중입니다", "tradeInId": tradeIn.ID})
		return
	}

	// 통합 알림 (이메일 + 카카오 + 텔레그램)
	if h.notif != nil {
		userName := c.GetString("name")
		if tradeIn.SenderName != nil && *tradeIn.SenderName != "" {
			userName = *tradeIn.SenderName
		}
		userEmail := c.GetString("email")
		if tradeIn.SenderEmail != nil && *tradeIn.SenderEmail != "" {
			userEmail = *tradeIn.SenderEmail
		}
		userPhone := ""
		if tradeIn.SenderPhone != nil {
			userPhone = *tradeIn.SenderPhone
		}
		productName := ""
		if tradeIn.ProductName != nil {
			productName = *tradeIn.ProductName
		}
		if userEmail != "" {
			go h.notif.TradeInSubmitted(notification.TradeInInfo{
				UserName:     userName,
				UserEmail:    userEmail,
				UserPhone:    userPhone,
				ProductName:  productName,
				Quantity:     tradeIn.Quantity,
				PayoutAmount: int(tradeIn.PayoutAmount.InexactFloat64()),
			})
		}
	}

	response.Created(c, tradeIn)
}

func (h *TradeInHandler) GetMyTradeIns(c *gin.Context) {
	userId := c.GetInt("userId")
	var params pagination.QueryParams
	if err := c.ShouldBindQuery(&params); err != nil {
		response.BadRequest(c, "잘못된 조회 요청입니다")
		return
	}

	tradeIns, err := h.service.GetMyTradeIns(userId, params)
	if err != nil {
		response.HandleError(c, err)
		return
	}

	response.Success(c, tradeIns)
}

func (h *TradeInHandler) GetTradeIn(c *gin.Context) {
	userId := c.GetInt("userId")
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	tradeIn, err := h.service.GetTradeInByID(userId, id)
	if err != nil {
		response.HandleError(c, err)
		return
	}
	response.Success(c, tradeIn)
}
