/*
Package handlers는 비즈니스 문의(파트너 제휴/입점) 관련 HTTP 요청/응답 핸들링 로직을 제공합니다.
공개 핸들러(BusinessInquiryHandler)는 비로그인 사용자의 문의 제출을 처리하고,
관리자 핸들러(AdminBusinessInquiryHandler)는 인증된 관리자의 문의 관리 기능을 제공합니다.
*/
package handlers

import (
	"seedream-gift-server/internal/app/services"
	"seedream-gift-server/internal/domain"
	"seedream-gift-server/pkg/pagination"
	"seedream-gift-server/pkg/response"

	"github.com/gin-gonic/gin"
)

// ============================================================
// 공개 핸들러 (비로그인)
// ============================================================

// BusinessInquiryHandler는 공개 비즈니스 문의 접수 요청을 처리하는 핸들러입니다.
type BusinessInquiryHandler struct {
	service *services.BusinessInquiryService
}

// NewBusinessInquiryHandler는 새로운 BusinessInquiryHandler 인스턴스를 생성합니다.
func NewBusinessInquiryHandler(service *services.BusinessInquiryService) *BusinessInquiryHandler {
	return &BusinessInquiryHandler{service: service}
}

// Submit은 비즈니스 문의를 접수합니다.
// 비로그인 공개 엔드포인트로, 제출된 문의는 DB에 저장되고 관리자에게 이메일로 알림이 발송됩니다.
func (h *BusinessInquiryHandler) Submit(c *gin.Context) {
	var inquiry domain.BusinessInquiry
	if err := c.ShouldBindJSON(&inquiry); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	// 보안/감사 추적을 위해 제출자 IP 기록
	inquiry.IPAddress = c.ClientIP()

	if err := h.service.Submit(&inquiry); err != nil {
		response.HandleError(c, err)
		return
	}

	response.Created(c, gin.H{"message": "문의가 정상적으로 접수되었습니다"})
}

// ============================================================
// 관리자 핸들러
// ============================================================

// AdminBusinessInquiryHandler는 관리자의 비즈니스 문의 관리 요청을 처리하는 핸들러입니다.
type AdminBusinessInquiryHandler struct {
	service *services.BusinessInquiryService
}

// NewAdminBusinessInquiryHandler는 새로운 AdminBusinessInquiryHandler 인스턴스를 생성합니다.
func NewAdminBusinessInquiryHandler(service *services.BusinessInquiryService) *AdminBusinessInquiryHandler {
	return &AdminBusinessInquiryHandler{service: service}
}

// GetAll은 페이지네이션이 적용된 비즈니스 문의 목록을 조회합니다.
func (h *AdminBusinessInquiryHandler) GetAll(c *gin.Context) {
	var params pagination.QueryParams
	if err := c.ShouldBindQuery(&params); err != nil {
		response.BadRequest(c, "잘못된 조회 요청입니다")
		return
	}

	result, err := h.service.GetAll(params)
	if err != nil {
		response.HandleError(c, err)
		return
	}

	response.Success(c, result)
}

// GetDetail은 ID로 단일 비즈니스 문의 상세 정보를 조회합니다.
func (h *AdminBusinessInquiryHandler) GetDetail(c *gin.Context) {
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}

	inquiry, err := h.service.GetByID(id)
	if err != nil {
		response.HandleError(c, err)
		return
	}

	response.Success(c, inquiry)
}

// UpdateStatus는 비즈니스 문의의 처리 상태를 변경합니다.
// 요청 본문: {"status": "READ"} (NEW/READ/REPLIED)
func (h *AdminBusinessInquiryHandler) UpdateStatus(c *gin.Context) {
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}

	var body struct {
		Status string `json:"status" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		response.BadRequest(c, "status 필드가 필요합니다")
		return
	}

	if err := h.service.UpdateStatus(id, body.Status); err != nil {
		response.HandleError(c, err)
		return
	}

	response.Success(c, gin.H{"message": "상태가 변경되었습니다"})
}

// Delete는 비즈니스 문의를 삭제합니다.
func (h *AdminBusinessInquiryHandler) Delete(c *gin.Context) {
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}

	if err := h.service.Delete(id); err != nil {
		response.HandleError(c, err)
		return
	}

	response.Success(c, gin.H{"message": "문의가 삭제되었습니다"})
}
