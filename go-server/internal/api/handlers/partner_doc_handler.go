package handlers

import (
	"w-gift-server/internal/app/services"
	"w-gift-server/pkg/pagination"
	"w-gift-server/pkg/response"

	"github.com/gin-gonic/gin"
)

// PartnerDocHandler는 파트너가 자신의 문서를 조회·다운로드하는 HTTP 핸들러입니다.
// 파트너는 읽기 전용 접근만 허용되며, 문서 소유권이 자동으로 검증됩니다.
type PartnerDocHandler struct {
	service *services.PartnerDocService
}

// NewPartnerDocHandler는 새로운 PartnerDocHandler 인스턴스를 생성합니다.
func NewPartnerDocHandler(service *services.PartnerDocService) *PartnerDocHandler {
	return &PartnerDocHandler{service: service}
}

// GetMyDocuments는 로그인한 파트너의 문서 목록을 페이지네이션하여 반환합니다.
func (h *PartnerDocHandler) GetMyDocuments(c *gin.Context) {
	partnerID := c.GetInt("userId")

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

// DownloadMyDocument는 파트너가 자신의 특정 문서를 다운로드합니다.
// 소유권 확인 후 파일을 첨부 응답으로 반환합니다.
func (h *PartnerDocHandler) DownloadMyDocument(c *gin.Context) {
	partnerID := c.GetInt("userId")

	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}

	filePath, fileName, err := h.service.GetDocumentForPartner(id, partnerID)
	if err != nil {
		response.HandleError(c, err)
		return
	}
	c.FileAttachment(filePath, fileName)
}
