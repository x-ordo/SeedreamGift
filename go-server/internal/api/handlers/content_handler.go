/*
Package handlers는 콘텐츠 관리를 위한 HTTP 요청/응답 핸들링 로직을 제공합니다.
배너, 공지사항, FAQ 등 애플리케이션의 정적 및 동적 콘텐츠를 제공합니다.

주요 역할:
- 마케팅 콘텐츠(배너) 및 정보성 콘텐츠(공지사항, FAQ) 조회 및 전달
- 고성능 전달을 고려한 콘텐츠 관련 쿼리 처리
- Go 백엔드의 동적 콘텐츠 요구사항 지원
*/
package handlers

import (
	"strconv"
	"seedream-gift-server/internal/app/services"
	"seedream-gift-server/pkg/logger"
	"seedream-gift-server/pkg/pagination"
	"seedream-gift-server/pkg/response"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

// ContentHandler는 콘텐츠 관련 HTTP 요청을 처리하는 핸들러입니다.
type ContentHandler struct {
	service *services.ContentService
}

// NewContentHandler는 새로운 ContentHandler 인스턴스를 생성합니다.
func NewContentHandler(service *services.ContentService) *ContentHandler {
	return &ContentHandler{service: service}
}

// GetNotices godoc
// @Summary 공지사항 목록 조회
// @Tags Notices
// @Produce json
// @Param page query int false "페이지 번호" default(1)
// @Param limit query int false "페이지당 항목 수" default(20)
// @Success 200 {object} APIResponse
// @Failure 500 {object} APIResponse
// @Router /notices [get]
// GetNotices는 공지사항 목록을 페이징하여 조회합니다.
func (h *ContentHandler) GetNotices(c *gin.Context) {
	var params pagination.QueryParams
	c.ShouldBindQuery(&params)
	items, err := h.service.GetNotices(params)
	if err != nil {
		logger.Log.Error("get notices failed", zap.Error(err), zap.String("handler", "GetNotices"))
		response.InternalServerError(c, "서버 오류가 발생했습니다")
		return
	}
	response.Success(c, items)
}

// GetNotice godoc
// @Summary 공지사항 단건 조회
// @Tags Notices
// @Produce json
// @Param id path int true "공지사항 ID"
// @Success 200 {object} APIResponse
// @Failure 404 {object} APIResponse
// @Router /notices/{id} [get]
// GetNotice는 특정 ID의 공지사항 상세 내용을 조회합니다.
func (h *ContentHandler) GetNotice(c *gin.Context) {
	// M-5: strconv.Atoi 오류를 무시하지 않고 parseIDParam 헬퍼로 유효성 검사
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	item, err := h.service.GetNoticeByID(id)
	if err != nil {
		response.NotFound(c, "공지사항을 찾을 수 없습니다")
		return
	}
	response.Success(c, item)
}

// IncrementNoticeView godoc
// @Summary 공지사항 조회수 증가
// @Tags Notices
// @Produce json
// @Param id path int true "공지사항 ID"
// @Success 200 {object} APIResponse
// @Failure 500 {object} APIResponse
// @Router /notices/{id}/view [patch]
// IncrementNoticeView는 특정 공지사항의 조회수를 1 증가시킵니다.
func (h *ContentHandler) IncrementNoticeView(c *gin.Context) {
	// M-5: strconv.Atoi 오류를 무시하지 않고 parseIDParam 헬퍼로 유효성 검사
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	if err := h.service.IncrementNoticeView(id); err != nil {
		logger.Log.Error("increment notice view failed", zap.Error(err), zap.String("handler", "IncrementNoticeView"))
		response.InternalServerError(c, "서버 오류가 발생했습니다")
		return
	}
	response.Success(c, "조회수가 증가되었습니다")
}

// GetActiveNotices godoc
// @Summary 활성 공지사항 목록 조회
// @Tags Notices
// @Produce json
// @Param limit query int false "조회 개수" default(5)
// @Success 200 {object} APIResponse
// @Failure 500 {object} APIResponse
// @Router /notices/active [get]
// GetActiveNotices는 현재 게시 중인 활성 공지사항 목록을 조회합니다.
func (h *ContentHandler) GetActiveNotices(c *gin.Context) {
	// M-5: 파싱 실패 시 기본값(30) 사용 — 쿼리 파라미터이므로 오류 시 안전한 기본값으로 대체
	limit, err := strconv.Atoi(c.DefaultQuery("limit", "30"))
	if err != nil || limit <= 0 {
		limit = 30
	}
	items, err := h.service.GetActiveNotices(limit)
	if err != nil {
		logger.Log.Error("get active notices failed", zap.Error(err), zap.String("handler", "GetActiveNotices"))
		response.InternalServerError(c, "서버 오류가 발생했습니다")
		return
	}
	response.Success(c, items)
}

// GetFaqs godoc
// @Summary FAQ 목록 조회
// @Tags FAQs
// @Produce json
// @Param page query int false "페이지 번호" default(1)
// @Param limit query int false "페이지당 항목 수" default(20)
// @Param category query string false "카테고리 필터"
// @Success 200 {object} APIResponse
// @Failure 500 {object} APIResponse
// @Router /faqs [get]
// GetFaqs는 자주 묻는 질문(FAQ) 목록을 조회합니다.
func (h *ContentHandler) GetFaqs(c *gin.Context) {
	var params pagination.QueryParams
	c.ShouldBindQuery(&params)
	category := c.Query("category")
	items, err := h.service.GetFaqs(params, category)
	if err != nil {
		logger.Log.Error("get faqs failed", zap.Error(err), zap.String("handler", "GetFaqs"))
		response.InternalServerError(c, "서버 오류가 발생했습니다")
		return
	}
	response.Success(c, items)
}

// GetActiveFaqs godoc
// @Summary 활성 FAQ 목록 조회
// @Tags FAQs
// @Produce json
// @Param category query string false "카테고리 필터"
// @Success 200 {object} APIResponse
// @Failure 500 {object} APIResponse
// @Router /faqs/active [get]
// GetActiveFaqs는 현재 활성화된 FAQ 목록을 조회합니다.
func (h *ContentHandler) GetActiveFaqs(c *gin.Context) {
	category := c.Query("category")
	items, err := h.service.GetActiveFaqs(category)
	if err != nil {
		logger.Log.Error("get active faqs failed", zap.Error(err), zap.String("handler", "GetActiveFaqs"))
		response.InternalServerError(c, "서버 오류가 발생했습니다")
		return
	}
	response.Success(c, items)
}

// GetFaqCategories godoc
// @Summary FAQ 카테고리 목록 조회
// @Tags FAQs
// @Produce json
// @Success 200 {object} APIResponse
// @Failure 500 {object} APIResponse
// @Router /faqs/categories [get]
// GetFaqCategories는 FAQ 카테고리 목록을 조회합니다.
func (h *ContentHandler) GetFaqCategories(c *gin.Context) {
	items, err := h.service.GetFaqCategories()
	if err != nil {
		logger.Log.Error("get faq categories failed", zap.Error(err), zap.String("handler", "GetFaqCategories"))
		response.InternalServerError(c, "서버 오류가 발생했습니다")
		return
	}
	response.Success(c, items)
}

// GetFaq godoc
// @Summary FAQ 단건 조회
// @Tags FAQs
// @Produce json
// @Param id path int true "FAQ ID"
// @Success 200 {object} APIResponse
// @Failure 404 {object} APIResponse
// @Router /faqs/{id} [get]
// GetFaq는 특정 ID의 FAQ 상세 내용을 조회합니다.
func (h *ContentHandler) GetFaq(c *gin.Context) {
	// M-5: strconv.Atoi 오류를 무시하지 않고 parseIDParam 헬퍼로 유효성 검사
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	item, err := h.service.GetFaqByID(id)
	if err != nil {
		response.NotFound(c, "FAQ를 찾을 수 없습니다")
		return
	}
	response.Success(c, item)
}

// IncrementFaqHelpful godoc
// @Summary FAQ 도움됨 수 증가
// @Tags FAQs
// @Produce json
// @Param id path int true "FAQ ID"
// @Success 200 {object} APIResponse
// @Failure 500 {object} APIResponse
// @Router /faqs/{id}/helpful [patch]
// IncrementFaqHelpful은 특정 FAQ의 '도움됨' 추천 수를 1 증가시킵니다.
func (h *ContentHandler) IncrementFaqHelpful(c *gin.Context) {
	// M-5: strconv.Atoi 오류를 무시하지 않고 parseIDParam 헬퍼로 유효성 검사
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	if err := h.service.IncrementFaqHelpful(id); err != nil {
		logger.Log.Error("increment faq helpful failed", zap.Error(err), zap.String("handler", "IncrementFaqHelpful"))
		response.InternalServerError(c, "서버 오류가 발생했습니다")
		return
	}
	response.Success(c, "도움됨이 반영되었습니다")
}

// GetEvents godoc
// @Summary 이벤트 목록 조회
// @Tags Events
// @Produce json
// @Param page query int false "페이지 번호" default(1)
// @Param limit query int false "페이지당 항목 수" default(20)
// @Success 200 {object} APIResponse
// @Failure 500 {object} APIResponse
// @Router /events [get]
// GetEvents는 이벤트 목록을 페이징하여 조회합니다.
func (h *ContentHandler) GetEvents(c *gin.Context) {
	var params pagination.QueryParams
	c.ShouldBindQuery(&params)
	items, err := h.service.GetEvents(params)
	if err != nil {
		logger.Log.Error("get events failed", zap.Error(err), zap.String("handler", "GetEvents"))
		response.InternalServerError(c, "서버 오류가 발생했습니다")
		return
	}
	response.Success(c, items)
}

// GetActiveEvents godoc
// @Summary 활성 이벤트 목록 조회
// @Tags Events
// @Produce json
// @Param status query string false "이벤트 상태 필터"
// @Success 200 {object} APIResponse
// @Failure 500 {object} APIResponse
// @Router /events/active [get]
// GetActiveEvents는 현재 진행 중인 활성 이벤트 목록을 조회합니다.
func (h *ContentHandler) GetActiveEvents(c *gin.Context) {
	status := c.Query("status")
	items, err := h.service.GetActiveEvents(status)
	if err != nil {
		logger.Log.Error("get active events failed", zap.Error(err), zap.String("handler", "GetActiveEvents"))
		response.InternalServerError(c, "서버 오류가 발생했습니다")
		return
	}
	response.Success(c, items)
}

// GetFeaturedEvents godoc
// @Summary 추천 이벤트 목록 조회
// @Tags Events
// @Produce json
// @Success 200 {object} APIResponse
// @Failure 500 {object} APIResponse
// @Router /events/featured [get]
// GetFeaturedEvents는 메인 화면 등에 노출될 추천 이벤트 목록을 조회합니다.
func (h *ContentHandler) GetFeaturedEvents(c *gin.Context) {
	items, err := h.service.GetFeaturedEvents()
	if err != nil {
		logger.Log.Error("get featured events failed", zap.Error(err), zap.String("handler", "GetFeaturedEvents"))
		response.InternalServerError(c, "서버 오류가 발생했습니다")
		return
	}
	response.Success(c, items)
}

// GetEvent godoc
// @Summary 이벤트 단건 조회
// @Tags Events
// @Produce json
// @Param id path int true "이벤트 ID"
// @Success 200 {object} APIResponse
// @Failure 404 {object} APIResponse
// @Router /events/{id} [get]
// GetEvent는 특정 ID의 이벤트 상세 내용을 조회합니다.
func (h *ContentHandler) GetEvent(c *gin.Context) {
	// M-5: strconv.Atoi 오류를 무시하지 않고 parseIDParam 헬퍼로 유효성 검사
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	item, err := h.service.GetEventByID(id)
	if err != nil {
		response.NotFound(c, "이벤트를 찾을 수 없습니다")
		return
	}
	response.Success(c, item)
}

// IncrementEventView godoc
// @Summary 이벤트 조회수 증가
// @Tags Events
// @Produce json
// @Param id path int true "이벤트 ID"
// @Success 200 {object} APIResponse
// @Failure 500 {object} APIResponse
// @Router /events/{id}/view [patch]
// IncrementEventView는 특정 이벤트의 조회수를 1 증가시킵니다.
func (h *ContentHandler) IncrementEventView(c *gin.Context) {
	// M-5: strconv.Atoi 오류를 무시하지 않고 parseIDParam 헬퍼로 유효성 검사
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	if err := h.service.IncrementEventView(id); err != nil {
		logger.Log.Error("increment event view failed", zap.Error(err), zap.String("handler", "IncrementEventView"))
		response.InternalServerError(c, "서버 오류가 발생했습니다")
		return
	}
	response.Success(c, "조회수가 증가되었습니다")
}

// ========================================
// Inquiries
// ========================================

// GetMyInquiries godoc
// @Summary 내 문의 목록 조회
// @Tags Inquiries
// @Produce json
// @Param page query int false "페이지 번호" default(1)
// @Param limit query int false "페이지당 항목 수" default(20)
// @Security BearerAuth
// @Success 200 {object} APIResponse
// @Failure 401 {object} APIResponse
// @Failure 500 {object} APIResponse
// @Router /inquiries [get]
// GetMyInquiries는 현재 사용자가 작성한 1:1 문의 목록을 조회합니다.
func (h *ContentHandler) GetMyInquiries(c *gin.Context) {
	userId := c.GetInt("userId")
	var params pagination.QueryParams
	c.ShouldBindQuery(&params)
	items, err := h.service.GetMyInquiries(userId, params)
	if err != nil {
		logger.Log.Error("get my inquiries failed", zap.Error(err), zap.String("handler", "GetMyInquiries"))
		response.InternalServerError(c, "서버 오류가 발생했습니다")
		return
	}
	response.Success(c, items)
}

// CreateInquiry godoc
// @Summary 문의 등록
// @Tags Inquiries
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param body body object true "문의 내용 (category, subject, content 필수)"
// @Success 201 {object} APIResponse
// @Failure 400 {object} APIResponse
// @Failure 401 {object} APIResponse
// @Failure 500 {object} APIResponse
// @Router /inquiries [post]
// CreateInquiry는 새로운 1:1 문의를 등록합니다.
func (h *ContentHandler) CreateInquiry(c *gin.Context) {
	userId := c.GetInt("userId")
	var body struct {
		Category string `json:"category" binding:"required"`
		Subject  string `json:"subject" binding:"required"`
		Content  string `json:"content" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	if err := h.service.CreateInquiry(userId, body.Category, body.Subject, body.Content); err != nil {
		logger.Log.Error("create inquiry failed", zap.Error(err), zap.String("handler", "CreateInquiry"))
		response.InternalServerError(c, "서버 오류가 발생했습니다")
		return
	}
	response.Created(c, "문의가 등록되었습니다")
}

// UpdateInquiry godoc
// @Summary 문의 수정
// @Tags Inquiries
// @Accept json
// @Produce json
// @Param id path int true "문의 ID"
// @Security BearerAuth
// @Param body body object true "수정할 문의 내용"
// @Success 200 {object} APIResponse
// @Failure 400 {object} APIResponse
// @Failure 401 {object} APIResponse
// @Failure 500 {object} APIResponse
// @Router /inquiries/{id} [patch]
// UpdateInquiry는 작성한 문의 내용을 수정합니다.
func (h *ContentHandler) UpdateInquiry(c *gin.Context) {
	userId := c.GetInt("userId")
	// M-5: strconv.Atoi 오류를 무시하지 않고 parseIDParam 헬퍼로 유효성 검사
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	var body map[string]any
	if err := c.ShouldBindJSON(&body); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	if err := h.service.UpdateInquiry(userId, id, body); err != nil {
		logger.Log.Error("update inquiry failed", zap.Error(err), zap.String("handler", "UpdateInquiry"))
		response.InternalServerError(c, "서버 오류가 발생했습니다")
		return
	}
	response.Success(c, "문의가 수정되었습니다")
}

// DeleteInquiry godoc
// @Summary 문의 삭제
// @Tags Inquiries
// @Produce json
// @Param id path int true "문의 ID"
// @Security BearerAuth
// @Success 200 {object} APIResponse
// @Failure 401 {object} APIResponse
// @Failure 500 {object} APIResponse
// @Router /inquiries/{id} [delete]
// DeleteInquiry는 작성한 문의를 삭제합니다.
func (h *ContentHandler) DeleteInquiry(c *gin.Context) {
	userId := c.GetInt("userId")
	// M-5: strconv.Atoi 오류를 무시하지 않고 parseIDParam 헬퍼로 유효성 검사
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	if err := h.service.DeleteInquiry(userId, id); err != nil {
		logger.Log.Error("delete inquiry failed", zap.Error(err), zap.String("handler", "DeleteInquiry"))
		response.InternalServerError(c, "서버 오류가 발생했습니다")
		return
	}
	response.Success(c, "문의가 삭제되었습니다")
}
