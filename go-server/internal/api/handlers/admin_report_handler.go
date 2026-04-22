package handlers

import (
	"strconv"
	"seedream-gift-server/internal/app/services"
	"seedream-gift-server/pkg/logger"
	"seedream-gift-server/pkg/response"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

type AdminReportHandler struct {
	service *services.AdminReportService
}

func NewAdminReportHandler(service *services.AdminReportService) *AdminReportHandler {
	return &AdminReportHandler{service: service}
}

func (h *AdminReportHandler) GetBankTransactionReport(c *gin.Context) {
	startDate := c.Query("startDate")
	endDate := c.Query("endDate")
	res, err := h.service.GetBankTransactionReport(startDate, endDate)
	if err != nil {
		logger.Log.Error("admin get bank transaction report failed", zap.Error(err), zap.String("handler", "GetBankTransactionReport"))
		response.InternalServerError(c, "서버 오류가 발생했습니다")
		return
	}
	response.Success(c, res)
}

func (h *AdminReportHandler) GetTradeInPayoutReport(c *gin.Context) {
	startDate := c.Query("startDate")
	endDate := c.Query("endDate")
	res, err := h.service.GetTradeInPayoutReport(startDate, endDate)
	if err != nil {
		logger.Log.Error("admin get trade-in payout report failed", zap.Error(err), zap.String("handler", "GetTradeInPayoutReport"))
		response.InternalServerError(c, "서버 오류가 발생했습니다")
		return
	}
	response.Success(c, res)
}

// GetDailySalesReport godoc
// @Summary 일별 매출 보고서
// @Tags Admin - Reports
// @Security BearerAuth
// @Param startDate query string true "시작일 (YYYY-MM-DD)"
// @Param endDate query string true "종료일 (YYYY-MM-DD)"
// @Success 200 {object} APIResponse
// @Router /admin/reports/daily-sales [get]
func (h *AdminReportHandler) GetDailySalesReport(c *gin.Context) {
	startDate := c.Query("startDate")
	endDate := c.Query("endDate")
	if startDate == "" || endDate == "" {
		response.BadRequest(c, "startDate and endDate are required")
		return
	}
	res, err := h.service.GetDailySalesReport(startDate, endDate)
	if err != nil {
		logger.Log.Error("admin get daily sales report failed", zap.Error(err), zap.String("handler", "GetDailySalesReport"))
		response.BadRequest(c, err.Error())
		return
	}
	response.Success(c, res)
}

// GetBrandPerformance godoc
// @Summary 브랜드별 판매 성과
// @Tags Admin - Reports
// @Security BearerAuth
// @Param startDate query string true "시작일 (YYYY-MM-DD)"
// @Param endDate query string true "종료일 (YYYY-MM-DD)"
// @Success 200 {object} APIResponse
// @Router /admin/reports/brand-performance [get]
func (h *AdminReportHandler) GetBrandPerformance(c *gin.Context) {
	startDate := c.Query("startDate")
	endDate := c.Query("endDate")
	if startDate == "" || endDate == "" {
		response.BadRequest(c, "startDate and endDate are required")
		return
	}
	res, err := h.service.GetBrandPerformance(startDate, endDate)
	if err != nil {
		logger.Log.Error("admin get brand performance failed", zap.Error(err), zap.String("handler", "GetBrandPerformance"))
		response.BadRequest(c, err.Error())
		return
	}
	response.Success(c, res)
}

// GetProfitReport godoc
// @Summary 수익 보고서
// @Tags Admin - Reports
// @Security BearerAuth
// @Param startDate query string true "시작일 (YYYY-MM-DD)"
// @Param endDate query string true "종료일 (YYYY-MM-DD)"
// @Success 200 {object} APIResponse
// @Router /admin/reports/profit [get]
func (h *AdminReportHandler) GetProfitReport(c *gin.Context) {
	startDate := c.Query("startDate")
	endDate := c.Query("endDate")
	if startDate == "" || endDate == "" {
		response.BadRequest(c, "startDate and endDate are required")
		return
	}
	res, err := h.service.GetProfitReport(startDate, endDate)
	if err != nil {
		logger.Log.Error("admin get profit report failed", zap.Error(err), zap.String("handler", "GetProfitReport"))
		response.BadRequest(c, err.Error())
		return
	}
	response.Success(c, res)
}

// GetTopCustomers godoc
// @Summary 상위 고객 보고서
// @Tags Admin - Reports
// @Security BearerAuth
// @Param limit query int false "상위 N명" default(10)
// @Success 200 {object} APIResponse
// @Router /admin/reports/top-customers [get]
func (h *AdminReportHandler) GetTopCustomers(c *gin.Context) {
	limit, err := strconv.Atoi(c.DefaultQuery("limit", "10"))
	if err != nil || limit <= 0 {
		limit = 10
	}
	res, err := h.service.GetTopCustomers(limit)
	if err != nil {
		logger.Log.Error("admin get top customers failed", zap.Error(err), zap.String("handler", "GetTopCustomers"))
		response.InternalServerError(c, "서버 오류가 발생했습니다")
		return
	}
	response.Success(c, res)
}

func (h *AdminReportHandler) GetUserTransactionExport(c *gin.Context) {
	userId, ok := parseIDParam(c, "userId")
	if !ok {
		return
	}
	res, err := h.service.GetUserTransactionExport(userId)
	if err != nil {
		logger.Log.Error("admin get user transaction export failed", zap.Error(err), zap.String("handler", "GetUserTransactionExport"))
		response.InternalServerError(c, "서버 오류가 발생했습니다")
		return
	}
	response.Success(c, res)
}
