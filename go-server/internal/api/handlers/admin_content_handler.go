package handlers

import (
	"seedream-gift-server/internal/app/services"
	"seedream-gift-server/internal/domain"
	"seedream-gift-server/pkg/logger"
	"seedream-gift-server/pkg/pagination"
	"seedream-gift-server/pkg/response"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

type AdminContentHandler struct {
	service *services.AdminContentService
}

func NewAdminContentHandler(service *services.AdminContentService) *AdminContentHandler {
	return &AdminContentHandler{service: service}
}

// ── Notices ──

func (h *AdminContentHandler) GetAllNotices(c *gin.Context) {
	var params pagination.QueryParams
	c.ShouldBindQuery(&params)
	res, err := h.service.GetAllNotices(params)
	if err != nil {
		logger.Log.Error("admin get all notices failed", zap.Error(err), zap.String("handler", "GetAllNotices"))
		response.InternalServerError(c, "서버 오류가 발생했습니다")
		return
	}
	response.Success(c, res)
}

func (h *AdminContentHandler) GetNotice(c *gin.Context) {
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	res, err := h.service.GetNotice(id)
	if err != nil {
		response.NotFound(c, "공지사항을 찾을 수 없습니다")
		return
	}
	response.Success(c, res)
}

func (h *AdminContentHandler) CreateNotice(c *gin.Context) {
	var n domain.Notice
	if err := c.ShouldBindJSON(&n); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	if err := h.service.CreateNotice(&n); err != nil {
		logger.Log.Error("admin create notice failed", zap.Error(err), zap.String("handler", "CreateNotice"))
		response.InternalServerError(c, "서버 오류가 발생했습니다")
		return
	}
	response.Created(c, n)
}

func (h *AdminContentHandler) UpdateNotice(c *gin.Context) {
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	var n domain.Notice
	if err := c.ShouldBindJSON(&n); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	if err := h.service.UpdateNotice(id, &n); err != nil {
		logger.Log.Error("admin update notice failed", zap.Error(err), zap.String("handler", "UpdateNotice"))
		response.InternalServerError(c, "서버 오류가 발생했습니다")
		return
	}
	response.Success(c, gin.H{"message": "공지사항이 수정되었습니다"})
}

func (h *AdminContentHandler) DeleteNotice(c *gin.Context) {
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	if err := h.service.DeleteNotice(id); err != nil {
		logger.Log.Error("admin delete notice failed", zap.Error(err), zap.String("handler", "DeleteNotice"))
		response.InternalServerError(c, "서버 오류가 발생했습니다")
		return
	}
	response.Success(c, gin.H{"message": "공지사항이 삭제되었습니다"})
}

// ── FAQs ──

func (h *AdminContentHandler) GetAllFaqs(c *gin.Context) {
	var params pagination.QueryParams
	c.ShouldBindQuery(&params)
	res, err := h.service.GetAllFaqs(params)
	if err != nil {
		logger.Log.Error("admin get all faqs failed", zap.Error(err), zap.String("handler", "GetAllFaqs"))
		response.InternalServerError(c, "서버 오류가 발생했습니다")
		return
	}
	response.Success(c, res)
}

func (h *AdminContentHandler) GetFaq(c *gin.Context) {
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	res, err := h.service.GetFaq(id)
	if err != nil {
		response.NotFound(c, "FAQ를 찾을 수 없습니다")
		return
	}
	response.Success(c, res)
}

func (h *AdminContentHandler) CreateFaq(c *gin.Context) {
	var f domain.Faq
	if err := c.ShouldBindJSON(&f); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	if err := h.service.CreateFaq(&f); err != nil {
		logger.Log.Error("admin create faq failed", zap.Error(err), zap.String("handler", "CreateFaq"))
		response.InternalServerError(c, "서버 오류가 발생했습니다")
		return
	}
	response.Created(c, f)
}

func (h *AdminContentHandler) UpdateFaq(c *gin.Context) {
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	var f domain.Faq
	if err := c.ShouldBindJSON(&f); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	if err := h.service.UpdateFaq(id, &f); err != nil {
		logger.Log.Error("admin update faq failed", zap.Error(err), zap.String("handler", "UpdateFaq"))
		response.InternalServerError(c, "서버 오류가 발생했습니다")
		return
	}
	response.Success(c, gin.H{"message": "FAQ가 수정되었습니다"})
}

func (h *AdminContentHandler) DeleteFaq(c *gin.Context) {
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	if err := h.service.DeleteFaq(id); err != nil {
		logger.Log.Error("admin delete faq failed", zap.Error(err), zap.String("handler", "DeleteFaq"))
		response.InternalServerError(c, "서버 오류가 발생했습니다")
		return
	}
	response.Success(c, gin.H{"message": "FAQ가 삭제되었습니다"})
}

// ── Events ──

func (h *AdminContentHandler) GetAllEvents(c *gin.Context) {
	var params pagination.QueryParams
	c.ShouldBindQuery(&params)
	res, err := h.service.GetAllEvents(params)
	if err != nil {
		logger.Log.Error("admin get all events failed", zap.Error(err), zap.String("handler", "GetAllEvents"))
		response.InternalServerError(c, "서버 오류가 발생했습니다")
		return
	}
	response.Success(c, res)
}

func (h *AdminContentHandler) GetEvent(c *gin.Context) {
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	res, err := h.service.GetEvent(id)
	if err != nil {
		response.NotFound(c, "이벤트를 찾을 수 없습니다")
		return
	}
	response.Success(c, res)
}

func (h *AdminContentHandler) CreateEvent(c *gin.Context) {
	var e domain.Event
	if err := c.ShouldBindJSON(&e); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	if err := h.service.CreateEvent(&e); err != nil {
		logger.Log.Error("admin create event failed", zap.Error(err), zap.String("handler", "CreateEvent"))
		response.InternalServerError(c, "서버 오류가 발생했습니다")
		return
	}
	response.Created(c, e)
}

func (h *AdminContentHandler) UpdateEvent(c *gin.Context) {
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	var e domain.Event
	if err := c.ShouldBindJSON(&e); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	if err := h.service.UpdateEvent(id, &e); err != nil {
		logger.Log.Error("admin update event failed", zap.Error(err), zap.String("handler", "UpdateEvent"))
		response.InternalServerError(c, "서버 오류가 발생했습니다")
		return
	}
	response.Success(c, gin.H{"message": "이벤트가 수정되었습니다"})
}

func (h *AdminContentHandler) DeleteEvent(c *gin.Context) {
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	if err := h.service.DeleteEvent(id); err != nil {
		logger.Log.Error("admin delete event failed", zap.Error(err), zap.String("handler", "DeleteEvent"))
		response.InternalServerError(c, "서버 오류가 발생했습니다")
		return
	}
	response.Success(c, gin.H{"message": "이벤트가 삭제되었습니다"})
}

// ── Inquiries ──

func (h *AdminContentHandler) GetAllInquiries(c *gin.Context) {
	var params pagination.QueryParams
	c.ShouldBindQuery(&params)
	res, err := h.service.GetAllInquiries(params)
	if err != nil {
		logger.Log.Error("admin get all inquiries failed", zap.Error(err), zap.String("handler", "GetAllInquiries"))
		response.InternalServerError(c, "서버 오류가 발생했습니다")
		return
	}
	response.Success(c, res)
}

func (h *AdminContentHandler) GetInquiry(c *gin.Context) {
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	res, err := h.service.GetInquiry(id)
	if err != nil {
		response.NotFound(c, "문의를 찾을 수 없습니다")
		return
	}
	response.Success(c, res)
}

func (h *AdminContentHandler) AnswerInquiry(c *gin.Context) {
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	var body struct {
		Answer string `json:"answer" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	adminID := c.GetInt("userId")
	if err := h.service.AnswerInquiry(id, adminID, body.Answer); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.Success(c, gin.H{"message": "문의가 답변되었습니다"})
}

func (h *AdminContentHandler) CloseInquiry(c *gin.Context) {
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	if err := h.service.CloseInquiry(id); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.Success(c, gin.H{"message": "문의가 종결되었습니다"})
}

func (h *AdminContentHandler) DeleteInquiry(c *gin.Context) {
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	if err := h.service.DeleteInquiryAdmin(id); err != nil {
		logger.Log.Error("admin delete inquiry failed", zap.Error(err), zap.String("handler", "DeleteInquiry"))
		response.InternalServerError(c, "서버 오류가 발생했습니다")
		return
	}
	response.Success(c, gin.H{"message": "문의가 삭제되었습니다"})
}

// ── Policies ──

func (h *AdminContentHandler) GetAllPolicies(c *gin.Context) {
	var params pagination.QueryParams
	c.ShouldBindQuery(&params)
	res, err := h.service.GetAllPolicies(params)
	if err != nil {
		logger.Log.Error("admin get all policies failed", zap.Error(err))
		response.InternalServerError(c, "서버 오류가 발생했습니다")
		return
	}
	response.Success(c, res)
}

func (h *AdminContentHandler) GetPolicy(c *gin.Context) {
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	res, err := h.service.GetPolicy(id)
	if err != nil {
		response.NotFound(c, "약관을 찾을 수 없습니다")
		return
	}
	response.Success(c, res)
}

func (h *AdminContentHandler) CreatePolicy(c *gin.Context) {
	var p domain.Policy
	if err := c.ShouldBindJSON(&p); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	if err := h.service.CreatePolicy(&p); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.Created(c, p)
}

func (h *AdminContentHandler) UpdatePolicy(c *gin.Context) {
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	var p domain.Policy
	if err := c.ShouldBindJSON(&p); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	if err := h.service.UpdatePolicy(id, &p); err != nil {
		response.InternalServerError(c, "서버 오류가 발생했습니다")
		return
	}
	response.Success(c, gin.H{"message": "약관이 수정되었습니다"})
}

func (h *AdminContentHandler) SetCurrentPolicy(c *gin.Context) {
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	if err := h.service.SetCurrentPolicy(id); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.Success(c, gin.H{"message": "현재 약관으로 설정되었습니다"})
}

func (h *AdminContentHandler) DeletePolicy(c *gin.Context) {
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	if err := h.service.DeletePolicy(id); err != nil {
		response.InternalServerError(c, "서버 오류가 발생했습니다")
		return
	}
	response.Success(c, gin.H{"message": "약관이 삭제되었습니다"})
}

// GetCurrentPolicyPublic은 공개 API — 특정 유형의 현재 정책을 반환합니다.
func (h *AdminContentHandler) GetCurrentPolicyPublic(c *gin.Context) {
	policyType := c.Param("type")
	if policyType == "" {
		response.BadRequest(c, "정책 유형이 필요합니다")
		return
	}
	res, err := h.service.GetCurrentPolicy(policyType)
	if err != nil {
		response.NotFound(c, "해당 유형의 정책을 찾을 수 없습니다")
		return
	}
	response.Success(c, res)
}
