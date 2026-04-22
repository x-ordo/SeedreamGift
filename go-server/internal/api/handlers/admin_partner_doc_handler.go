package handlers

import (
	"net/http"
	"w-gift-server/internal/app/services"
	"w-gift-server/pkg/pagination"
	"w-gift-server/pkg/response"

	"github.com/gin-gonic/gin"
)

// AdminPartnerDocHandler는 관리자의 파트너 문서 관리 HTTP 요청을 처리합니다.
type AdminPartnerDocHandler struct {
	service *services.PartnerDocService
}

// NewAdminPartnerDocHandler는 새로운 AdminPartnerDocHandler 인스턴스를 생성합니다.
func NewAdminPartnerDocHandler(service *services.PartnerDocService) *AdminPartnerDocHandler {
	return &AdminPartnerDocHandler{service: service}
}

// GetDocuments는 특정 파트너의 문서 목록을 페이지네이션하여 반환합니다.
// 쿼리 파라미터 partnerId 는 필수입니다.
func (h *AdminPartnerDocHandler) GetDocuments(c *gin.Context) {
	pid := c.Query("partnerId")
	if pid == "" {
		response.BadRequest(c, "partnerId 파라미터가 필요합니다")
		return
	}
	partnerID, ok := parseIntQuery(pid)
	if !ok || partnerID <= 0 {
		response.BadRequest(c, "유효하지 않은 partnerId 입니다")
		return
	}

	var params pagination.QueryParams
	if err := c.ShouldBindQuery(&params); err != nil {
		response.BadRequest(c, "잘못된 쿼리 파라미터입니다")
		return
	}

	result, err := h.service.GetDocumentsByPartner(partnerID, params)
	if err != nil {
		response.HandleError(c, err)
		return
	}
	response.Success(c, result)
}

// UploadDocument는 파트너 문서 파일을 업로드합니다.
// multipart/form-data: file (필수), partnerId (필수), category (필수), note (선택).
func (h *AdminPartnerDocHandler) UploadDocument(c *gin.Context) {
	// 요청 본문 크기 제한 (10MB)
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 10<<20)

	file, header, err := c.Request.FormFile("file")
	if err != nil {
		response.BadRequest(c, "파일이 필요합니다")
		return
	}
	defer file.Close()

	pid := c.PostForm("partnerId")
	if pid == "" {
		response.BadRequest(c, "partnerId 가 필요합니다")
		return
	}
	partnerID, ok := parseIntQuery(pid)
	if !ok || partnerID <= 0 {
		response.BadRequest(c, "유효하지 않은 partnerId 입니다")
		return
	}

	category := c.PostForm("category")
	adminID := c.GetInt("userId")

	var notePtr *string
	if note := c.PostForm("note"); note != "" {
		notePtr = &note
	}

	doc, err := h.service.UploadDocument(partnerID, adminID, file, header, category, notePtr)
	if err != nil {
		response.HandleError(c, err)
		return
	}
	response.Created(c, doc)
}

// DownloadDocument는 관리자가 파트너 문서를 다운로드합니다.
func (h *AdminPartnerDocHandler) DownloadDocument(c *gin.Context) {
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}

	filePath, fileName, err := h.service.GetDocumentFilePath(id)
	if err != nil {
		response.HandleError(c, err)
		return
	}
	c.FileAttachment(filePath, fileName)
}

// DeleteDocument는 파트너 문서를 삭제합니다.
func (h *AdminPartnerDocHandler) DeleteDocument(c *gin.Context) {
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}

	if err := h.service.DeleteDocument(id); err != nil {
		response.HandleError(c, err)
		return
	}
	response.Success(c, gin.H{"message": "문서가 삭제되었습니다"})
}
