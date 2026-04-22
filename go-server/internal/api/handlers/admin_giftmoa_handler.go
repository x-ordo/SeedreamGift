package handlers

import (
	"w-gift-server/internal/app/services"
	"w-gift-server/pkg/logger"
	"w-gift-server/pkg/response"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

// AdminGiftMoaHandler는 Gift MOA 외부 API에 대한 관리자 핸들러입니다.
type AdminGiftMoaHandler struct {
	service *services.GiftMoaAdminService
}

func NewAdminGiftMoaHandler(service *services.GiftMoaAdminService) *AdminGiftMoaHandler {
	return &AdminGiftMoaHandler{service: service}
}

// ListIssuances는 발행 이력을 조회합니다.
// GET /admin/giftmoa/issuances?sDate=20260101&eDate=20260329
func (h *AdminGiftMoaHandler) ListIssuances(c *gin.Context) {
	sDate := c.Query("sDate")
	eDate := c.Query("eDate")
	if sDate == "" || eDate == "" {
		response.BadRequest(c, "sDate, eDate 파라미터가 필요합니다 (YYYYMMDD)")
		return
	}

	records, err := h.service.IssuanceList(c.Request.Context(), sDate, eDate)
	if err != nil {
		response.Error(c, 500, err.Error())
		return
	}
	response.Success(c, records)
}

// GetIssuanceDetail은 발행 회차의 개별 PIN 목록을 조회합니다.
// GET /admin/giftmoa/issuances/:publishCnt
func (h *AdminGiftMoaHandler) GetIssuanceDetail(c *gin.Context) {
	publishCnt := c.Param("publishCnt")
	if publishCnt == "" {
		response.BadRequest(c, "publishCnt 파라미터가 필요합니다")
		return
	}

	vouchers, err := h.service.IssuanceDetail(c.Request.Context(), publishCnt)
	if err != nil {
		response.Error(c, 500, err.Error())
		return
	}
	response.Success(c, vouchers)
}

// QueryGiftByCode는 상품권 코드로 정보를 조회합니다.
// POST /admin/giftmoa/gift/info
func (h *AdminGiftMoaHandler) QueryGiftByCode(c *gin.Context) {
	var req struct {
		GiftCode string `json:"giftCode" binding:"required"`
		GiftPw   string `json:"giftPw" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "giftCode, giftPw가 필요합니다")
		return
	}

	info, err := h.service.GiftInfoByCode(c.Request.Context(), req.GiftCode, req.GiftPw)
	if err != nil {
		response.Error(c, 500, err.Error())
		return
	}
	response.Success(c, info)
}

// QueryGiftByURLParam은 암호화 URL로 상품권 정보를 조회합니다.
// POST /admin/giftmoa/gift/info-enc
func (h *AdminGiftMoaHandler) QueryGiftByURLParam(c *gin.Context) {
	var req struct {
		URLParam string `json:"urlParam" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "urlParam이 필요합니다")
		return
	}

	info, err := h.service.GiftInfoByURLParam(c.Request.Context(), req.URLParam)
	if err != nil {
		response.Error(c, 500, err.Error())
		return
	}
	response.Success(c, info)
}

// RefundGift는 상품권을 환불 처리합니다.
// POST /admin/giftmoa/gift/refund
func (h *AdminGiftMoaHandler) RefundGift(c *gin.Context) {
	var req struct {
		GiftCode   string `json:"giftCode" binding:"required"`
		GiftPw     string `json:"giftPw" binding:"required"`
		RefundName string `json:"refundName" binding:"required"`
		RefundTel  string `json:"refundTel" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "giftCode, giftPw, refundName, refundTel이 필요합니다")
		return
	}

	adminID := c.GetInt("userId")
	logger.Log.Warn("AUDIT: admin GiftMoa 환불 요청",
		zap.Int("adminId", adminID),
		zap.String("giftCode", req.GiftCode),
		zap.String("refundName", req.RefundName),
		zap.String("refundTel", req.RefundTel),
	)

	if err := h.service.GiftRefund(c.Request.Context(), req.GiftCode, req.GiftPw, req.RefundName, req.RefundTel); err != nil {
		response.Error(c, 500, err.Error())
		return
	}

	logger.Log.Warn("AUDIT: admin GiftMoa 환불 완료",
		zap.Int("adminId", adminID),
		zap.String("giftCode", req.GiftCode),
	)
	response.Success(c, gin.H{"message": "환불 처리 완료"})
}

// UseGift는 상품권을 사용 처리합니다.
// POST /admin/giftmoa/gift/use
func (h *AdminGiftMoaHandler) UseGift(c *gin.Context) {
	var req struct {
		GiftCode string `json:"giftCode" binding:"required"`
		GiftPw   string `json:"giftPw" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "giftCode, giftPw가 필요합니다")
		return
	}

	adminID := c.GetInt("userId")
	logger.Log.Warn("AUDIT: admin GiftMoa 사용처리 요청",
		zap.Int("adminId", adminID),
		zap.String("giftCode", req.GiftCode),
	)

	if err := h.service.GiftUse(c.Request.Context(), req.GiftCode, req.GiftPw); err != nil {
		response.Error(c, 500, err.Error())
		return
	}

	logger.Log.Warn("AUDIT: admin GiftMoa 사용처리 완료",
		zap.Int("adminId", adminID),
		zap.String("giftCode", req.GiftCode),
	)
	response.Success(c, gin.H{"message": "사용 처리 완료"})
}
