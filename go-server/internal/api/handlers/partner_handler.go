package handlers

import (
	"w-gift-server/internal/app/services"
	"w-gift-server/pkg/pagination"
	"w-gift-server/pkg/response"

	"github.com/gin-gonic/gin"
)

// PartnerHandler는 파트너 대시보드 관련 HTTP 핸들러입니다.
type PartnerHandler struct {
	service *services.PartnerService
}

// NewPartnerHandler는 새로운 PartnerHandler 인스턴스를 생성합니다.
func NewPartnerHandler(service *services.PartnerService) *PartnerHandler {
	return &PartnerHandler{service: service}
}

// GetDashboard는 파트너 대시보드에 표시할 통계 데이터(판매 현황, 재고 등)를 조회합니다.
func (h *PartnerHandler) GetDashboard(c *gin.Context) {
	partnerID := c.GetInt("userId")
	stats, err := h.service.GetDashboard(partnerID)
	if err != nil {
		response.HandleError(c, err)
		return
	}
	response.Success(c, stats)
}

// GetAvailableProducts는 파트너가 PIN 번호를 등록하여 재고를 공급할 수 있는 상품 목록을 조회합니다.
func (h *PartnerHandler) GetAvailableProducts(c *gin.Context) {
	partnerID := c.GetInt("userId")
	var params pagination.QueryParams
	if err := c.ShouldBindQuery(&params); err != nil {
		response.BadRequest(c, "잘못된 쿼리 파라미터입니다")
		return
	}
	res, err := h.service.GetAvailableProducts(partnerID, params)
	if err != nil {
		response.HandleError(c, err)
		return
	}
	response.Success(c, res)
}

// GetMyVoucherStats는 파트너가 업로드한 바우처의 상품별 통계를 조회합니다.
func (h *PartnerHandler) GetMyVoucherStats(c *gin.Context) {
	partnerID := c.GetInt("userId")
	res, err := h.service.GetMyVoucherStats(partnerID)
	if err != nil {
		response.HandleError(c, err)
		return
	}
	response.Success(c, res)
}

// GetMyOrders는 파트너 상품이 포함된 주문 목록을 조회합니다.
func (h *PartnerHandler) GetMyOrders(c *gin.Context) {
	partnerID := c.GetInt("userId")
	var params pagination.QueryParams
	if err := c.ShouldBindQuery(&params); err != nil {
		response.BadRequest(c, "잘못된 조회 요청입니다")
		return
	}
	status := c.Query("status")
	res, err := h.service.GetMyOrders(partnerID, params, status)
	if err != nil {
		response.HandleError(c, err)
		return
	}
	response.Success(c, res)
}

// GetMyOrderDetail는 파트너 상품이 포함된 특정 주문 상세를 조회합니다.
func (h *PartnerHandler) GetMyOrderDetail(c *gin.Context) {
	partnerID := c.GetInt("userId")
	orderID, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	res, err := h.service.GetMyOrderDetail(partnerID, orderID)
	if err != nil {
		response.HandleError(c, err)
		return
	}
	response.Success(c, res)
}

// GetMyVouchers는 파트너 상품에 연결된 바우처 목록을 조회합니다.
func (h *PartnerHandler) GetMyVouchers(c *gin.Context) {
	partnerID := c.GetInt("userId")
	var params pagination.QueryParams
	if err := c.ShouldBindQuery(&params); err != nil {
		response.BadRequest(c, "잘못된 조회 요청입니다")
		return
	}
	status := c.Query("status")
	res, err := h.service.GetMyVouchers(partnerID, params, status)
	if err != nil {
		response.HandleError(c, err)
		return
	}
	response.Success(c, res)
}

// BulkUploadVouchers는 파트너가 특정 상품의 PIN 번호(바우처)를 대량으로 등록할 때 호출합니다.
func (h *PartnerHandler) BulkUploadVouchers(c *gin.Context) {
	partnerID := c.GetInt("userId")
	var body struct {
		ProductID int      `json:"productId" binding:"required"` // 등록할 상품 ID
		PinCodes  []string `json:"pinCodes" binding:"required"`  // PIN 번호 목록
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		response.BadRequest(c, "입력 데이터가 유효하지 않습니다")
		return
	}
	if err := h.service.BulkUploadVouchers(partnerID, body.ProductID, body.PinCodes); err != nil {
		response.HandleError(c, err)
		return
	}
	response.Success(c, gin.H{
		"message": "바우처 등록이 성공적으로 완료되었습니다",
		"count":   len(body.PinCodes),
	})
}

// GetVoucherInventory는 파트너 상품별 바우처 재고 요약을 조회합니다.
func (h *PartnerHandler) GetVoucherInventory(c *gin.Context) {
	partnerID := c.GetInt("userId")
	res, err := h.service.GetVoucherInventory(partnerID)
	if err != nil {
		response.HandleError(c, err)
		return
	}
	response.Success(c, res)
}

// GetPayouts는 파트너의 정산 내역을 조회합니다.
func (h *PartnerHandler) GetPayouts(c *gin.Context) {
	partnerID := c.GetInt("userId")
	var params pagination.QueryParams
	if err := c.ShouldBindQuery(&params); err != nil {
		response.BadRequest(c, "잘못된 조회 요청입니다")
		return
	}
	res, err := h.service.GetPayouts(partnerID, params)
	if err != nil {
		response.HandleError(c, err)
		return
	}
	response.Success(c, res)
}

// GetPayoutSummary는 파트너의 기간별 정산 요약을 조회합니다.
func (h *PartnerHandler) GetPayoutSummary(c *gin.Context) {
	partnerID := c.GetInt("userId")
	from := c.Query("from")
	to := c.Query("to")
	res, err := h.service.GetPayoutSummary(partnerID, from, to)
	if err != nil {
		response.HandleError(c, err)
		return
	}
	response.Success(c, res)
}

// GetProfile는 파트너 프로필 정보를 조회합니다.
func (h *PartnerHandler) GetProfile(c *gin.Context) {
	partnerID := c.GetInt("userId")
	res, err := h.service.GetProfile(partnerID)
	if err != nil {
		response.HandleError(c, err)
		return
	}
	response.Success(c, res)
}

// UpdateProfile는 파트너 프로필의 제한된 필드를 수정합니다.
func (h *PartnerHandler) UpdateProfile(c *gin.Context) {
	partnerID := c.GetInt("userId")
	var body map[string]any
	if err := c.ShouldBindJSON(&body); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	if err := h.service.UpdateProfile(partnerID, body); err != nil {
		response.HandleError(c, err)
		return
	}
	response.Success(c, gin.H{"message": "프로필이 업데이트되었습니다"})
}
