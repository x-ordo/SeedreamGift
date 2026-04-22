package handlers

import (
	"strconv"
	"seedream-gift-server/internal/app/services"
	"seedream-gift-server/internal/domain"
	"seedream-gift-server/pkg/pagination"
	"seedream-gift-server/pkg/response"

	"github.com/gin-gonic/gin"
)

type AdminVoucherHandler struct {
	service *services.AdminVoucherService
}

func NewAdminVoucherHandler(service *services.AdminVoucherService) *AdminVoucherHandler {
	return &AdminVoucherHandler{service: service}
}

func (h *AdminVoucherHandler) GetVouchers(c *gin.Context) {
	var params pagination.QueryParams
	if err := c.ShouldBindQuery(&params); err != nil {
		response.BadRequest(c, "잘못된 조회 요청입니다")
		return
	}
	status := c.Query("status")
	productID, err := strconv.Atoi(c.Query("productId"))
	if err != nil {
		productID = 0
	}
	res, err := h.service.GetVoucherList(params, status, productID)
	if err != nil {
		response.HandleError(c, err)
		return
	}
	response.Success(c, res)
}

func (h *AdminVoucherHandler) GetVoucherDetail(c *gin.Context) {
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	res, err := h.service.GetVoucherDetail(id)
	if err != nil {
		response.HandleError(c, err)
		return
	}
	response.Success(c, res)
}

func (h *AdminVoucherHandler) UpdateVoucher(c *gin.Context) {
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	var body struct {
		Status       *string `json:"status"`
		SecurityCode *string `json:"securityCode"`
		GiftNumber   *string `json:"giftNumber"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	updates := make(map[string]any)
	if body.Status != nil {
		updates["Status"] = *body.Status
	}
	if body.SecurityCode != nil {
		updates["SecurityCode"] = *body.SecurityCode
	}
	if body.GiftNumber != nil {
		updates["GiftNumber"] = *body.GiftNumber
	}
	if len(updates) == 0 {
		response.BadRequest(c, "수정할 항목이 없습니다")
		return
	}
	if err := h.service.UpdateVoucher(id, updates); err != nil {
		response.HandleError(c, err)
		return
	}
	response.Success(c, gin.H{"message": "바우처가 수정되었습니다"})
}

func (h *AdminVoucherHandler) DeleteVoucher(c *gin.Context) {
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	if err := h.service.DeleteVoucher(id); err != nil {
		response.HandleError(c, err)
		return
	}
	response.Success(c, gin.H{"message": "바우처가 삭제되었습니다"})
}

func (h *AdminVoucherHandler) GetVoucherStock(c *gin.Context) {
	productID, ok := parseIDParam(c, "productId")
	if !ok {
		return
	}
	res, err := h.service.GetStockCount(productID)
	if err != nil {
		response.HandleError(c, err)
		return
	}
	response.Success(c, res)
}

// GetExpiringVouchers godoc
// @Summary 만료 임박 바우처 목록 조회
// @Tags Admin - Vouchers
// @Security BearerAuth
// @Param days query int false "만료 기준 일수" default(30)
// @Success 200 {object} APIResponse
// @Router /admin/vouchers/expiring [get]
func (h *AdminVoucherHandler) GetExpiringVouchers(c *gin.Context) {
	days, err := strconv.Atoi(c.DefaultQuery("days", "30"))
	if err != nil || days <= 0 {
		days = 30
	}
	vouchers, err := h.service.GetExpiringVouchers(days)
	if err != nil {
		response.HandleError(c, err)
		return
	}
	response.Success(c, vouchers)
}

func (h *AdminVoucherHandler) GetVoucherInventory(c *gin.Context) {
	res, err := h.service.GetVoucherInventory()
	if err != nil {
		response.HandleError(c, err)
		return
	}
	response.Success(c, res)
}

// bulkVoucherUploadRequest는 프론트엔드가 전송하는 바우처 일괄 업로드 요청 구조체입니다.
// pinCodes: 단순 PIN 코드 문자열 배열, vouchers: 상세 정보 포함 객체 배열 (둘 중 하나 또는 모두 사용 가능)
type bulkVoucherUploadRequest struct {
	ProductID int      `json:"productId" binding:"required"`
	PinCodes  []string `json:"pinCodes"`
	Vouchers  []struct {
		Pin          string `json:"pin"`
		GiftNumber   string `json:"giftNumber"`
		SecurityCode string `json:"securityCode"`
	} `json:"vouchers"`
}

func (h *AdminVoucherHandler) BulkVoucherUpload(c *gin.Context) {
	var body bulkVoucherUploadRequest
	if err := c.ShouldBindJSON(&body); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	// 요청 구조체를 도메인 슬라이스로 변환
	var vouchers []domain.VoucherCode

	// pinCodes 배열 처리: 단순 PIN 코드 문자열
	for _, pin := range body.PinCodes {
		if pin == "" {
			continue
		}
		vouchers = append(vouchers, domain.VoucherCode{
			ProductID: body.ProductID,
			PinCode:   pin,
			Status:    "AVAILABLE",
		})
	}

	// vouchers 배열 처리: 상세 정보 포함 객체
	for _, v := range body.Vouchers {
		if v.Pin == "" {
			continue
		}
		vc := domain.VoucherCode{
			ProductID: body.ProductID,
			PinCode:   v.Pin,
			Status:    "AVAILABLE",
		}
		if v.GiftNumber != "" {
			vc.GiftNumber = &v.GiftNumber
		}
		if v.SecurityCode != "" {
			vc.SecurityCode = &v.SecurityCode
		}
		vouchers = append(vouchers, vc)
	}

	if len(vouchers) == 0 {
		response.BadRequest(c, "업로드할 바우처가 없습니다")
		return
	}

	if err := h.service.BulkUploadVouchers(vouchers); err != nil {
		response.HandleError(c, err)
		return
	}
	response.Success(c, gin.H{"message": "일괄 업로드가 완료되었습니다", "count": len(vouchers)})
}
