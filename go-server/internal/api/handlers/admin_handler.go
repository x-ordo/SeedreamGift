package handlers

import (
	"w-gift-server/internal/app/services"
	"w-gift-server/internal/domain"
	"w-gift-server/pkg/logger"
	"w-gift-server/pkg/response"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

// AdminHandler는 관리자 대시보드 통계, 사이트 설정, 보안 패턴 HTTP 핸들러입니다.
type AdminHandler struct {
	statsSvc   *services.AdminStatsService
	configSvc  *services.AdminConfigService
	patternSvc *services.PatternRuleService
}

// NewAdminHandler는 새로운 AdminHandler 인스턴스를 생성합니다.
func NewAdminHandler(statsSvc *services.AdminStatsService, configSvc *services.AdminConfigService, patternSvc *services.PatternRuleService) *AdminHandler {
	return &AdminHandler{statsSvc: statsSvc, configSvc: configSvc, patternSvc: patternSvc}
}

// GetSiteConfigByKey는 키를 사용하여 공개 사이트 설정을 조회합니다.
func (h *AdminHandler) GetSiteConfigByKey(key string) (*domain.SiteConfig, error) {
	return h.configSvc.GetSiteConfigByKey(key)
}

// ── Stats ──

func (h *AdminHandler) GetStats(c *gin.Context) {
	stats, err := h.statsSvc.GetStats()
	if err != nil {
		logger.Log.Error("get stats failed", zap.Error(err), zap.String("handler", "GetStats"))
		response.InternalServerError(c, "서버 오류가 발생했습니다")
		return
	}
	response.Success(c, stats)
}

func (h *AdminHandler) GetStatsWithPeriod(c *gin.Context) {
	period := c.DefaultQuery("period", "all")
	stats, err := h.statsSvc.GetStatsWithPeriod(period)
	if err != nil {
		logger.Log.Error("get stats with period failed", zap.Error(err), zap.String("handler", "GetStatsWithPeriod"))
		response.InternalServerError(c, "서버 오류가 발생했습니다")
		return
	}
	response.Success(c, stats)
}

// ── Site Config ──

func (h *AdminHandler) GetSiteConfigs(c *gin.Context) {
	items, err := h.configSvc.GetSiteConfigs()
	if err != nil {
		logger.Log.Error("get site configs failed", zap.Error(err), zap.String("handler", "GetSiteConfigs"))
		response.InternalServerError(c, "서버 오류가 발생했습니다")
		return
	}
	response.Success(c, items)
}

func (h *AdminHandler) GetSiteConfig(c *gin.Context) {
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	cfg, err := h.configSvc.GetSiteConfigByID(id)
	if err != nil {
		response.NotFound(c, "설정을 찾을 수 없습니다")
		return
	}
	response.Success(c, cfg)
}

func (h *AdminHandler) CreateSiteConfig(c *gin.Context) {
	var req CreateSiteConfigRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "key, value, type are required")
		return
	}
	cfg := domain.SiteConfig{
		Key:         req.Key,
		Value:       req.Value,
		Type:        req.Type,
		Description: req.Description,
	}
	if err := h.configSvc.CreateSiteConfig(&cfg); err != nil {
		logger.Log.Error("create site config failed", zap.Error(err), zap.String("handler", "CreateSiteConfig"))
		response.InternalServerError(c, "서버 오류가 발생했습니다")
		return
	}
	response.Created(c, cfg)
}

func (h *AdminHandler) UpdateSiteConfig(c *gin.Context) {
	key := c.Param("key")
	var body UpdateSiteConfigRequest
	if err := c.ShouldBindJSON(&body); err != nil {
		response.BadRequest(c, "value is required")
		return
	}
	if err := h.configSvc.UpdateSiteConfig(key, body.Value); err != nil {
		logger.Log.Error("update site config failed", zap.Error(err), zap.String("handler", "UpdateSiteConfig"))
		response.InternalServerError(c, "서버 오류가 발생했습니다")
		return
	}
	response.Success(c, gin.H{"message": "설정이 업데이트되었습니다"})
}

func (h *AdminHandler) DeleteSiteConfig(c *gin.Context) {
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	if err := h.configSvc.DeleteSiteConfig(id); err != nil {
		logger.Log.Error("delete site config failed", zap.Error(err), zap.String("handler", "DeleteSiteConfig"))
		response.InternalServerError(c, "서버 오류가 발생했습니다")
		return
	}
	response.Success(c, gin.H{"message": "설정이 삭제되었습니다"})
}

// ── Pattern Rules ──

func (h *AdminHandler) GetPatternRules(c *gin.Context) {
	rules, err := h.patternSvc.GetPatternRules()
	if err != nil {
		logger.Log.Error("get pattern rules failed", zap.Error(err))
		response.InternalServerError(c, "서버 오류가 발생했습니다")
		return
	}
	response.Success(c, rules)
}

func (h *AdminHandler) TogglePatternRule(c *gin.Context) {
	ruleID := c.Param("ruleId")
	if ruleID == "" {
		response.BadRequest(c, "ruleId is required")
		return
	}
	var req TogglePatternRuleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	if err := h.patternSvc.TogglePatternRule(ruleID, req.Enabled); err != nil {
		response.NotFound(c, "규칙을 찾을 수 없습니다")
		return
	}
	response.Success(c, gin.H{"message": "규칙이 변경되었습니다", "ruleId": ruleID, "enabled": req.Enabled})
}

// ── Request types ──

type CreateSiteConfigRequest struct {
	Key         string  `json:"key" binding:"required"`
	Value       string  `json:"value" binding:"required"`
	Type        string  `json:"type" binding:"required"`
	Description *string `json:"description"`
}

type UpdateSiteConfigRequest struct {
	Value string `json:"value" binding:"required"`
}

type TogglePatternRuleRequest struct {
	Enabled bool `json:"enabled"`
}
