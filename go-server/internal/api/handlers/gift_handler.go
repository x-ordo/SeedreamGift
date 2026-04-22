/*
Package handlers는 선물 관리를 위한 HTTP 요청/응답 핸들링 로직을 제공합니다.
수신된 선물 조회, 수신자 확인 및 선물 수령 처리를 담당합니다.
*/
package handlers

import (
	"seedream-gift-server/internal/app/services"
	"seedream-gift-server/pkg/logger"
	"seedream-gift-server/pkg/pagination"
	"seedream-gift-server/pkg/response"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

// GiftHandler는 선물 관련 HTTP 요청을 처리하는 핸들러입니다.
type GiftHandler struct {
	service *services.GiftService
}

// NewGiftHandler는 새로운 GiftHandler 인스턴스를 생성합니다.
func NewGiftHandler(service *services.GiftService) *GiftHandler {
	return &GiftHandler{service: service}
}

// GetReceivedGifts godoc
// @Summary 받은 선물 목록 조회
// @Tags Gifts
// @Produce json
// @Security BearerAuth
// @Param page query int false "페이지 번호" default(1)
// @Param limit query int false "페이지 크기" default(20)
// @Success 200 {object} APIResponse
// @Failure 400 {object} APIResponse
// @Failure 500 {object} APIResponse
// @Router /gifts/received [get]
// @Router /orders/my-gifts [get]
// GetReceivedGifts는 현재 사용자가 받은 선물 목록을 조회합니다.
func (h *GiftHandler) GetReceivedGifts(c *gin.Context) {
	var params pagination.QueryParams
	if err := c.ShouldBindQuery(&params); err != nil {
		response.BadRequest(c, "올바르지 않은 요청입니다")
		return
	}
	res, err := h.service.GetReceivedGifts(c.GetInt("userId"), params)
	if err != nil {
		logger.Log.Error("get received gifts failed", zap.Error(err), zap.String("handler", "GetReceivedGifts"))
		response.InternalServerError(c, "서버 오류가 발생했습니다")
		return
	}
	response.Success(c, res)
}

// CheckReceiver godoc
// @Summary 선물 수신자 확인
// @Tags Gifts
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param body body CheckReceiverRequest true "수신자 이메일"
// @Success 200 {object} APIResponse
// @Failure 400 {object} APIResponse
// @Router /gifts/check-receiver [post]
// CheckReceiver는 입력된 이메일이 유효한 선물 수신자인지 확인합니다.
func (h *GiftHandler) CheckReceiver(c *gin.Context) {
	var req CheckReceiverRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "올바른 이메일을 입력해주세요")
		return
	}
	result, err := h.service.CheckReceiver(req.Email, c.GetInt("userId"))
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.Success(c, result)
}

// SearchReceiver godoc
// @Summary 선물 수신자 검색
// @Tags Gifts
// @Produce json
// @Security BearerAuth
// @Param query query string true "이름 또는 이메일 검색어 (최소 3자)"
// @Success 200 {object} APIResponse
// @Failure 500 {object} APIResponse
// @Router /gifts/search [get]
// SearchReceiver는 이름 또는 이메일로 선물 수신자를 검색합니다.
func (h *GiftHandler) SearchReceiver(c *gin.Context) {
	query := c.Query("query")
	result, err := h.service.SearchReceiver(query)
	if err != nil {
		logger.Log.Error("search receiver failed", zap.Error(err), zap.String("handler", "SearchReceiver"))
		response.InternalServerError(c, "서버 오류가 발생했습니다")
		return
	}
	response.Success(c, result)
}

// ClaimGift godoc
// @Summary 선물 수령
// @Tags Gifts
// @Produce json
// @Security BearerAuth
// @Param id path int true "선물 ID"
// @Success 200 {object} APIResponse
// @Failure 400 {object} APIResponse
// @Failure 500 {object} APIResponse
// @Router /gifts/{id}/claim [post]
// ClaimGift는 수신된 선물을 확인하고 수령 처리합니다.
func (h *GiftHandler) ClaimGift(c *gin.Context) {
	gid, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	gift, err := h.service.ClaimGift(c.GetInt("userId"), gid)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.Success(c, gift)
}

// CheckReceiverRequest는 수신자 확인 요청 시 사용되는 구조체입니다.
type CheckReceiverRequest struct {
	Email string `json:"email" binding:"required,email" example:"user@example.com"`
}
