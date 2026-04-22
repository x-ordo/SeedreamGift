package handlers

import (
	"w-gift-server/internal/app/services"
	"w-gift-server/pkg/response"

	"github.com/gin-gonic/gin"
)

// PartnerBusinessInfoHandler는 파트너 사업자 정보 관련 HTTP 핸들러입니다.
type PartnerBusinessInfoHandler struct {
	service *services.PartnerBusinessInfoService
}

// NewPartnerBusinessInfoHandler는 새로운 PartnerBusinessInfoHandler 인스턴스를 생성합니다.
func NewPartnerBusinessInfoHandler(service *services.PartnerBusinessInfoService) *PartnerBusinessInfoHandler {
	return &PartnerBusinessInfoHandler{service: service}
}

// ── Partner endpoints (self-service) ──

// GetMyBusinessInfo는 현재 로그인한 파트너의 사업자 정보를 조회합니다.
func (h *PartnerBusinessInfoHandler) GetMyBusinessInfo(c *gin.Context) {
	partnerID := c.GetInt("userId")
	info, err := h.service.GetByPartnerID(partnerID)
	if err != nil {
		response.HandleError(c, err)
		return
	}
	response.Success(c, info)
}

// UpdateMyBusinessInfo는 현재 로그인한 파트너의 사업자 정보를 등록하거나 수정합니다.
func (h *PartnerBusinessInfoHandler) UpdateMyBusinessInfo(c *gin.Context) {
	partnerID := c.GetInt("userId")
	var input services.UpdateBusinessInfoInput
	if err := c.ShouldBindJSON(&input); err != nil {
		response.BadRequest(c, "입력 데이터가 유효하지 않습니다: "+err.Error())
		return
	}
	info, err := h.service.Upsert(partnerID, input)
	if err != nil {
		response.HandleError(c, err)
		return
	}
	response.Success(c, info)
}

// DeleteMyBusinessInfo는 현재 로그인한 파트너의 사업자 정보를 삭제합니다.
func (h *PartnerBusinessInfoHandler) DeleteMyBusinessInfo(c *gin.Context) {
	partnerID := c.GetInt("userId")
	if err := h.service.DeleteByPartnerID(partnerID); err != nil {
		response.HandleError(c, err)
		return
	}
	response.Success(c, gin.H{"message": "사업자 정보가 삭제되었습니다"})
}

// ── Admin endpoints ──

// AdminGetAll은 관리자용 파트너 사업자 정보 목록을 조회합니다.
// Query params: page, limit, status (PENDING|VERIFIED|REJECTED)
func (h *PartnerBusinessInfoHandler) AdminGetAll(c *gin.Context) {
	var params struct {
		Page   int    `form:"page"`
		Limit  int    `form:"limit"`
		Status string `form:"status"`
	}
	if err := c.ShouldBindQuery(&params); err != nil {
		response.BadRequest(c, "잘못된 쿼리 파라미터입니다")
		return
	}
	items, total, err := h.service.AdminGetAll(params.Page, params.Limit, params.Status)
	if err != nil {
		response.HandleError(c, err)
		return
	}
	response.Success(c, gin.H{
		"items": items,
		"total": total,
	})
}

// AdminGetByPartnerID는 특정 파트너의 사업자 정보를 조회합니다.
func (h *PartnerBusinessInfoHandler) AdminGetByPartnerID(c *gin.Context) {
	partnerID, ok := parseIDParam(c, "partnerId")
	if !ok {
		return
	}
	info, err := h.service.GetByPartnerID(partnerID)
	if err != nil {
		response.HandleError(c, err)
		return
	}
	response.Success(c, info)
}

// AdminVerify는 파트너 사업자 정보의 검증 상태를 설정합니다.
// Path param: id (PartnerBusinessInfo.Id)
// Body: { status: "VERIFIED"|"REJECTED", note: string }
func (h *PartnerBusinessInfoHandler) AdminVerify(c *gin.Context) {
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	adminID := c.GetInt("userId")

	var body struct {
		Status string `json:"status" binding:"required"`
		Note   string `json:"note"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		response.BadRequest(c, "입력 데이터가 유효하지 않습니다")
		return
	}

	if err := h.service.AdminVerify(id, body.Status, adminID, body.Note); err != nil {
		response.HandleError(c, err)
		return
	}
	response.Success(c, gin.H{"message": "검증 상태가 변경되었습니다"})
}

// AdminUpsert는 관리자가 특정 파트너의 사업자 정보를 대리 등록/수정합니다.
func (h *PartnerBusinessInfoHandler) AdminUpsert(c *gin.Context) {
	partnerID, ok := parseIDParam(c, "partnerId")
	if !ok {
		return
	}
	adminEmail := c.GetString("email")

	var input services.UpdateBusinessInfoInput
	if err := c.ShouldBindJSON(&input); err != nil {
		response.BadRequest(c, "입력 데이터가 유효하지 않습니다: "+err.Error())
		return
	}

	info, err := h.service.AdminUpsert(partnerID, input, adminEmail)
	if err != nil {
		response.HandleError(c, err)
		return
	}
	response.Success(c, info)
}

// AdminDelete는 관리자가 파트너 사업자 정보를 삭제합니다.
func (h *PartnerBusinessInfoHandler) AdminDelete(c *gin.Context) {
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	if err := h.service.AdminDelete(id); err != nil {
		response.HandleError(c, err)
		return
	}
	response.Success(c, gin.H{"message": "사업자 정보가 삭제되었습니다"})
}
