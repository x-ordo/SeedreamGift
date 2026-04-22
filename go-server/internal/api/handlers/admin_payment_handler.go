package handlers

import (
	"strconv"
	"time"

	"seedream-gift-server/internal/app/services"
	"seedream-gift-server/pkg/response"

	"github.com/gin-gonic/gin"
)

// parsePaymentFilters는 쿼리스트링을 PaymentQueryFilters로 변환합니다.
// 잘못된 날짜는 zero time으로 두어 WHERE 절에서 생략됩니다.
// 이 헬퍼는 Admin/Partner 두 핸들러가 공유합니다.
func parsePaymentFilters(c *gin.Context) services.PaymentQueryFilters {
	f := services.PaymentQueryFilters{
		Status: c.Query("status"),
		Method: c.Query("method"),
		Search: c.Query("search"),
	}
	if page, err := strconv.Atoi(c.DefaultQuery("page", "1")); err == nil && page > 0 {
		f.Page = page
	} else {
		f.Page = 1
	}
	if size, err := strconv.Atoi(c.DefaultQuery("pageSize", "20")); err == nil && size > 0 && size <= 100 {
		f.PageSize = size
	} else {
		f.PageSize = 20
	}
	if s := c.Query("from"); s != "" {
		if t, err := time.ParseInLocation("2006-01-02", s, kstLocation()); err == nil {
			f.From = t
		}
	}
	if s := c.Query("to"); s != "" {
		if t, err := time.ParseInLocation("2006-01-02", s, kstLocation()); err == nil {
			// 하루 끝까지 포함
			f.To = t.Add(24*time.Hour - time.Second)
		}
	}
	return f
}

// kstLocation은 KST 시간대를 반환합니다. admin_order_svc.go의 kstLoc와 동일 목적이나
// 패키지 경계를 넘지 않기 위해 핸들러 레이어에 독립 정의합니다.
func kstLocation() *time.Location {
	if loc, err := time.LoadLocation("Asia/Seoul"); err == nil {
		return loc
	}
	return time.FixedZone("KST", 9*60*60)
}

// AdminPaymentHandler는 어드민 결제 조회 HTTP 요청을 처리합니다.
type AdminPaymentHandler struct {
	svc *services.PaymentQueryService
}

// NewAdminPaymentHandler는 AdminPaymentHandler를 생성합니다.
func NewAdminPaymentHandler(svc *services.PaymentQueryService) *AdminPaymentHandler {
	return &AdminPaymentHandler{svc: svc}
}

// ListPayments godoc
// @Summary 어드민 결제현황 조회
// @Description 결제 상태별 리스트 및 상태별 요약을 반환합니다.
// @Tags AdminPayments
// @Produce json
// @Security BearerAuth
// @Param status query string false "PENDING|SUCCESS|FAILED|CANCELLED"
// @Param method query string false "CARD|VIRTUAL_ACCOUNT|BANK_TRANSFER"
// @Param from query string false "YYYY-MM-DD"
// @Param to query string false "YYYY-MM-DD"
// @Param search query string false "주문코드 또는 고객명 LIKE 검색"
// @Param page query int false "1-indexed, default 1"
// @Param pageSize query int false "default 20, max 100"
// @Success 200 {object} APIResponse
// @Router /admin/payments [get]
func (h *AdminPaymentHandler) ListPayments(c *gin.Context) {
	f := parsePaymentFilters(c)
	resp, err := h.svc.ListPayments(services.PaymentScopeAdmin, f)
	if err != nil {
		response.HandleError(c, err)
		return
	}
	response.Success(c, resp)
}
