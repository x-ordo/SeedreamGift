package handlers

import (
	"w-gift-server/internal/app/services"
	"w-gift-server/internal/domain"
	"w-gift-server/pkg/logger"
	"w-gift-server/pkg/notification"
	"w-gift-server/pkg/pagination"
	"w-gift-server/pkg/response"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

type AdminTradeInHandler struct {
	service *services.AdminTradeInService
	notif   *notification.Service
	db      *gorm.DB
}

func NewAdminTradeInHandler(service *services.AdminTradeInService, notif *notification.Service, db *gorm.DB) *AdminTradeInHandler {
	return &AdminTradeInHandler{service: service, notif: notif, db: db}
}

func (h *AdminTradeInHandler) GetTradeIns(c *gin.Context) {
	var params pagination.QueryParams
	if err := c.ShouldBindQuery(&params); err != nil {
		response.BadRequest(c, "잘못된 조회 요청입니다")
		return
	}
	status := c.Query("status")
	res, err := h.service.GetTradeIns(params, status)
	if err != nil {
		response.HandleError(c, err)
		return
	}
	response.Success(c, res)
}

func (h *AdminTradeInHandler) GetTradeIn(c *gin.Context) {
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	res, err := h.service.GetTradeIn(id)
	if err != nil {
		response.HandleError(c, err)
		return
	}
	response.Success(c, res)
}

func (h *AdminTradeInHandler) UpdateTradeInStatus(c *gin.Context) {
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	var body struct {
		Status    string `json:"status" binding:"required"`
		AdminNote string `json:"adminNote"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	if err := h.service.UpdateTradeInStatus(id, body.Status, body.AdminNote); err != nil {
		response.HandleError(c, err)
		return
	}

	// PAID 상태로 변경 시 매입 정산 완료 알림 발송
	if body.Status == "PAID" && h.notif != nil {
		go func() {
			var tradeIn domain.TradeIn
			if err := h.db.Preload("User").First(&tradeIn, id).Error; err != nil {
				logger.Log.Warn("매입 정산 알림용 조회 실패", zap.Int("tradeInId", id), zap.Error(err))
				return
			}
			userEmail := tradeIn.User.Email
			if userEmail == "" {
				logger.Log.Warn("매입 정산 알림 스킵: 이메일 없음", zap.Int("tradeInId", id))
				return
			}
			userName := ""
			userPhone := ""
			if tradeIn.User.Name != nil {
				userName = *tradeIn.User.Name
			}
			if tradeIn.User.Phone != nil {
				userPhone = *tradeIn.User.Phone
			}
			productName := ""
			if tradeIn.ProductName != nil {
				productName = *tradeIn.ProductName
			}
			h.notif.TradeInPaid(notification.TradeInInfo{
				UserName:     userName,
				UserEmail:    userEmail,
				UserPhone:    userPhone,
				ProductName:  productName,
				Quantity:     tradeIn.Quantity,
				PayoutAmount: int(tradeIn.PayoutAmount.IntPart()),
			})
		}()
	}

	response.Success(c, gin.H{"message": "매입 상태가 변경되었습니다"})
}

// ReceiveTradeIn godoc
// @Summary 매입 택배 수령 처리
// @Tags Admin - Trade-ins
// @Security BearerAuth
// @Param id path int true "매입 ID"
// @Success 200 {object} APIResponse
// @Router /admin/trade-ins/{id}/receive [patch]
func (h *AdminTradeInHandler) ReceiveTradeIn(c *gin.Context) {
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	var body struct {
		TrackingNumber string `json:"trackingNumber" binding:"required"`
		Carrier        string `json:"carrier" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	if err := h.service.ReceiveTradeIn(id, body.TrackingNumber, body.Carrier); err != nil {
		response.HandleError(c, err)
		return
	}
	response.Success(c, gin.H{"message": "매입 택배가 수령 처리되었습니다"})
}
