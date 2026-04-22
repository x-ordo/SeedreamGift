package handlers

import (
	"net/http"
	"strconv"
	"strings"

	"w-gift-server/internal/app/services"
	"w-gift-server/internal/domain"
	"w-gift-server/pkg/response"

	"github.com/gin-gonic/gin"
)

// ContentAttachmentHandler는 콘텐츠 첨부 파일 업로드/조회/삭제/다운로드를 처리합니다.
type ContentAttachmentHandler struct {
	service *services.ContentAttachmentService
}

func NewContentAttachmentHandler(service *services.ContentAttachmentService) *ContentAttachmentHandler {
	return &ContentAttachmentHandler{service: service}
}

// GetAttachments는 특정 콘텐츠의 첨부 파일 목록을 반환합니다.
// GET /admin/attachments?targetType=NOTICE&targetId=1
func (h *ContentAttachmentHandler) GetAttachments(c *gin.Context) {
	targetType := strings.ToUpper(c.Query("targetType"))
	targetID, err := strconv.Atoi(c.Query("targetId"))
	if err != nil || targetType == "" {
		response.BadRequest(c, "targetType과 targetId가 필요합니다")
		return
	}
	items, err := h.service.GetAttachments(targetType, targetID)
	if err != nil {
		response.HandleError(c, err)
		return
	}
	response.Success(c, items)
}

// Upload는 첨부 파일을 업로드합니다.
// POST /admin/attachments (multipart: file, targetType, targetId)
func (h *ContentAttachmentHandler) Upload(c *gin.Context) {
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 10<<20)

	targetType := strings.ToUpper(c.PostForm("targetType"))
	targetID, err := strconv.Atoi(c.PostForm("targetId"))
	if err != nil || targetType == "" {
		response.BadRequest(c, "targetType과 targetId가 필요합니다")
		return
	}

	file, header, err := c.Request.FormFile("file")
	if err != nil {
		response.BadRequest(c, "파일이 필요합니다")
		return
	}
	defer file.Close()

	adminID := c.GetInt("userId")
	att, err := h.service.Upload(targetType, targetID, adminID, file, header)
	if err != nil {
		response.HandleError(c, err)
		return
	}
	response.Success(c, att)
}

// Download는 첨부 파일을 다운로드합니다. 이미지는 인라인으로 표시됩니다.
// GET /attachments/:id (공개) 또는 /admin/attachments/:id/download
func (h *ContentAttachmentHandler) Download(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "유효하지 않은 ID입니다")
		return
	}
	filePath, fileName, fileType, err := h.service.GetFilePath(id)
	if err != nil {
		response.HandleError(c, err)
		return
	}

	ext := "." + strings.ToLower(fileType)
	if domain.ImageFileTypes[ext] {
		// 이미지: 인라인 표시 (브라우저에서 직접 렌더링)
		c.Header("Content-Disposition", "inline")
		c.File(filePath)
	} else {
		// 기타 파일: 다운로드
		c.FileAttachment(filePath, fileName)
	}
}

// Delete는 첨부 파일을 삭제합니다.
// DELETE /admin/attachments/:id
func (h *ContentAttachmentHandler) Delete(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "유효하지 않은 ID입니다")
		return
	}
	if err := h.service.Delete(id); err != nil {
		response.HandleError(c, err)
		return
	}
	response.Success(c, gin.H{"message": "첨부 파일이 삭제되었습니다"})
}
