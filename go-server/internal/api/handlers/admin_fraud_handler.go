package handlers

import (
	"fmt"
	"strconv"
	"strings"
	"seedream-gift-server/internal/app/interfaces"
	"seedream-gift-server/internal/app/services"
	"seedream-gift-server/internal/domain"
	"seedream-gift-server/pkg/blacklistdb"
	"seedream-gift-server/pkg/logger"
	"seedream-gift-server/pkg/response"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

type AdminFraudHandler struct {
	db              *gorm.DB
	fraudChecker    interfaces.FraudChecker
	blacklistClient services.BlacklistScreener
}

func NewAdminFraudHandler(db *gorm.DB, fraudChecker interfaces.FraudChecker, blacklistClient services.BlacklistScreener) *AdminFraudHandler {
	return &AdminFraudHandler{db: db, fraudChecker: fraudChecker, blacklistClient: blacklistClient}
}

// FraudCheck godoc
// @Summary 사용자 사기 조회 (실시간)
// @Tags Admin - Fraud
// @Produce json
// @Security BearerAuth
// @Param id path int true "사용자 ID"
// @Success 200 {object} APIResponse
// @Router /admin/users/{id}/fraud-check [get]
func (h *AdminFraudHandler) FraudCheck(c *gin.Context) {
	userID, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "유효하지 않은 사용자 ID입니다")
		return
	}
	if h.fraudChecker == nil {
		response.BadRequest(c, "더치트 사기 조회 기능이 비활성화되어 있습니다")
		return
	}
	result, err := h.fraudChecker.CheckRealtime(userID)
	if err != nil {
		logger.Log.Error("admin: 사기 조회 실패",
			zap.Int("userID", userID),
			zap.Error(err),
		)
		response.InternalServerError(c, "사기 조회 서비스에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.")
		return
	}
	response.Success(c, result)
}

// FraudHistory godoc
// @Summary 사용자 사기 조회 이력
// @Tags Admin - Fraud
// @Produce json
// @Security BearerAuth
// @Param id path int true "사용자 ID"
// @Success 200 {object} APIResponse
// @Router /admin/users/{id}/fraud-history [get]
func (h *AdminFraudHandler) FraudHistory(c *gin.Context) {
	userID, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "유효하지 않은 사용자 ID입니다")
		return
	}
	var logs []domain.FraudCheckLog
	if err := h.db.Where("UserId = ?", userID).Order("CreatedAt DESC").Find(&logs).Error; err != nil {
		response.InternalServerError(c, "이력 조회 실패")
		return
	}
	response.Success(c, logs)
}

// ── 블랙리스트 스크리닝 ──

type blacklistScreenRequest struct {
	Name    string `json:"name" binding:"required,min=2"`
	Phone   string `json:"phone"`
	Account string `json:"account"`
}

// BlacklistScreen godoc
// @Summary 블랙리스트 단건 스크리닝
// @Tags Admin - Fraud
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param body body blacklistScreenRequest true "스크리닝 대상"
// @Success 200 {object} APIResponse
// @Router /admin/blacklist-screen [post]
func (h *AdminFraudHandler) BlacklistScreen(c *gin.Context) {
	if h.blacklistClient == nil {
		response.BadRequest(c, "블랙리스트 스크리닝 기능이 비활성화되어 있습니다")
		return
	}

	var req blacklistScreenRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "이름(2자 이상)은 필수이며, 전화번호 또는 계좌번호 중 하나는 입력해야 합니다")
		return
	}

	// 전화번호 정규화: 하이픈 제거
	phone := strings.ReplaceAll(req.Phone, "-", "")
	account := strings.ReplaceAll(req.Account, "-", "")

	if phone == "" && account == "" {
		response.BadRequest(c, "전화번호 또는 계좌번호 중 하나는 필수입니다")
		return
	}

	refID := fmt.Sprintf("admin-screen-%s", req.Name)
	result, err := h.blacklistClient.Screen(refID, req.Name, phone, account)
	if err != nil {
		logger.Log.Error("admin: 블랙리스트 스크리닝 실패",
			zap.String("name", req.Name),
			zap.Error(err),
		)
		response.InternalServerError(c, "블랙리스트 스크리닝 서비스에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.")
		return
	}

	isBlocked := result.Status == "BLOCKED" && blacklistdb.IsNameBasedBlock(result.MatchCode)

	response.Success(c, gin.H{
		"status":        result.Status,
		"matchCode":     result.MatchCode,
		"incidentCount": result.IncidentCount,
		"isBlocked":     isBlocked,
		"matchDetail":   formatMatchDetail(result.MatchCode),
	})
}

// formatMatchDetail은 matchCode 비트맵을 사람이 읽을 수 있는 설명으로 변환합니다.
func formatMatchDetail(matchCode string) string {
	if len(matchCode) < 3 {
		return "알 수 없음"
	}
	var parts []string
	if matchCode[0] == '1' {
		parts = append(parts, "이름")
	}
	if matchCode[1] == '1' {
		parts = append(parts, "전화번호")
	}
	if matchCode[2] == '1' {
		parts = append(parts, "계좌번호")
	}
	if len(parts) == 0 {
		return "매칭 없음"
	}
	return strings.Join(parts, " + ") + " 일치"
}

type releaseHoldRequest struct {
	AdminNote string `json:"adminNote" binding:"required"`
}

// ReleaseOrderHold godoc
// @Summary 주문 FRAUD_HOLD 해제
// @Tags Admin - Fraud
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param id path int true "주문 ID"
// @Param body body releaseHoldRequest true "해제 사유"
// @Success 200 {object} APIResponse
// @Router /admin/orders/{id}/release-hold [post]
func (h *AdminFraudHandler) ReleaseOrderHold(c *gin.Context) {
	orderID, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "유효하지 않은 주문 ID입니다")
		return
	}
	var req releaseHoldRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "adminNote는 필수입니다")
		return
	}
	var order domain.Order
	if err := h.db.First(&order, orderID).Error; err != nil {
		response.NotFound(c, "주문을 찾을 수 없습니다")
		return
	}
	if order.Status != "FRAUD_HOLD" {
		response.BadRequest(c, fmt.Sprintf("FRAUD_HOLD 상태가 아닙니다 (현재: %s)", order.Status))
		return
	}
	if err := h.db.Model(&order).Updates(map[string]any{
		"Status":    "PENDING",
		"AdminNote": req.AdminNote,
	}).Error; err != nil {
		response.InternalServerError(c, "상태 변경 실패")
		return
	}
	response.Success(c, gin.H{"message": "주문이 정상 처리로 전환되었습니다", "orderId": orderID})
}

// ReleaseTradeInHold godoc
// @Summary 매입 FRAUD_HOLD 해제
// @Tags Admin - Fraud
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param id path int true "매입 ID"
// @Param body body releaseHoldRequest true "해제 사유"
// @Success 200 {object} APIResponse
// @Router /admin/trade-ins/{id}/release-hold [post]
func (h *AdminFraudHandler) ReleaseTradeInHold(c *gin.Context) {
	tradeInID, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "유효하지 않은 매입 ID입니다")
		return
	}
	var req releaseHoldRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "adminNote는 필수입니다")
		return
	}
	var tradeIn domain.TradeIn
	if err := h.db.First(&tradeIn, tradeInID).Error; err != nil {
		response.NotFound(c, "매입 건을 찾을 수 없습니다")
		return
	}
	if tradeIn.Status != "FRAUD_HOLD" {
		response.BadRequest(c, fmt.Sprintf("FRAUD_HOLD 상태가 아닙니다 (현재: %s)", tradeIn.Status))
		return
	}
	if err := h.db.Model(&tradeIn).Updates(map[string]any{
		"Status":    "REQUESTED",
		"AdminNote": req.AdminNote,
	}).Error; err != nil {
		response.InternalServerError(c, "상태 변경 실패")
		return
	}
	response.Success(c, gin.H{"message": "매입이 정상 처리로 전환되었습니다", "tradeInId": tradeInID})
}
