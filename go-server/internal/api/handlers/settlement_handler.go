package handlers

import (
	"w-gift-server/internal/app/services"
	"w-gift-server/pkg/pagination"
	"w-gift-server/pkg/response"

	"github.com/gin-gonic/gin"
)

// SettlementHandler는 정산 관련 HTTP 핸들러입니다.
type SettlementHandler struct {
	service *services.SettlementService
}

// NewSettlementHandler는 새로운 SettlementHandler 인스턴스를 생성합니다.
func NewSettlementHandler(service *services.SettlementService) *SettlementHandler {
	return &SettlementHandler{service: service}
}

// ── Admin Endpoints ──

// GetSettlements는 관리자용 정산 목록을 조회합니다.
// 파트너 ID별, 정산 상태별 필터링을 지원하며 페이지네이션된 결과를 반환합니다.
func (h *SettlementHandler) GetSettlements(c *gin.Context) {
	var params pagination.QueryParams
	if err := c.ShouldBindQuery(&params); err != nil {
		response.BadRequest(c, "잘못된 쿼리 파라미터입니다")
		return
	}

	partnerID := 0
	if pid := c.Query("partnerId"); pid != "" {
		if id, ok := parseIntQuery(pid); ok {
			partnerID = id
		}
	}
	status := c.Query("status")

	res, err := h.service.GetSettlements(params, partnerID, status)
	if err != nil {
		response.HandleError(c, err)
		return
	}
	response.Success(c, res)
}

// GetSettlementDetail는 특정 정산 레코드의 상세 정보를 조회합니다.
func (h *SettlementHandler) GetSettlementDetail(c *gin.Context) {
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}

	settlement, err := h.service.GetSettlementByID(id)
	if err != nil {
		response.HandleError(c, err)
		return
	}
	response.Success(c, settlement)
}

// UpdateStatus는 정산의 진행 상태를 변경합니다.
// 관리자가 정산 내역을 검토한 후 승인(CONFIRMED)하거나, 실제 송금 후 완료(PAID) 처리할 때 사용합니다.
func (h *SettlementHandler) UpdateStatus(c *gin.Context) {
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}

	var body struct {
		Status        string `json:"status" binding:"required"` // 변경할 상태 (CONFIRMED, PAID, FAILED)
		TransferRef   string `json:"transferRef"`               // 송금 참조 번호 (선택)
		FailureReason string `json:"failureReason"`             // 실패 사유 (상태가 FAILED인 경우)
		AdminNote     string `json:"adminNote"`                 // 관리자 비고 (선택)
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		response.BadRequest(c, "입력 데이터가 올바르지 않습니다")
		return
	}

	// 허용된 상태값인지 1차 검증
	validStatuses := map[string]bool{
		"CONFIRMED": true,
		"PAID":      true,
		"FAILED":    true,
	}
	if !validStatuses[body.Status] {
		response.BadRequest(c, "유효하지 않은 상태값입니다 (CONFIRMED, PAID, FAILED 중 하나여야 함)")
		return
	}

	if err := h.service.UpdateSettlementStatus(id, body.Status, body.TransferRef, body.FailureReason, body.AdminNote); err != nil {
		response.HandleError(c, err)
		return
	}
	response.Success(c, gin.H{"message": "정산 상태가 성공적으로 변경되었습니다"})
}

// CreateBatch는 정기적으로 실행되는 배치 정산 프로세스를 수동으로 트리거합니다.
// 특정 주기(WEEKLY, MONTHLY)를 지정하여 미정산 내역을 집계합니다.
func (h *SettlementHandler) CreateBatch(c *gin.Context) {
	var body struct {
		Frequency string `json:"frequency" binding:"required"` // 정산 주기 (WEEKLY, MONTHLY)
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		response.BadRequest(c, "정산 주기를 지정해야 합니다")
		return
	}

	validFrequencies := map[string]bool{
		"WEEKLY":  true,
		"MONTHLY": true,
	}
	if !validFrequencies[body.Frequency] {
		response.BadRequest(c, "유효하지 않은 정산 주기입니다 (WEEKLY, MONTHLY)")
		return
	}

	if err := h.service.CreateBatchSettlement(body.Frequency); err != nil {
		response.HandleError(c, err)
		return
	}
	response.Success(c, gin.H{"message": "배치 정산 프로세스가 성공적으로 완료되었습니다"})
}

// ── Partner Endpoints ──

// GetMySettlements는 파트너의 정산 목록을 조회합니다.
func (h *SettlementHandler) GetMySettlements(c *gin.Context) {
	partnerID := c.GetInt("userId")
	var params pagination.QueryParams
	if err := c.ShouldBindQuery(&params); err != nil {
		response.BadRequest(c, "잘못된 조회 요청입니다")
		return
	}
	res, err := h.service.GetPartnerSettlements(partnerID, params)
	if err != nil {
		response.HandleError(c, err)
		return
	}
	response.Success(c, res)
}

// GetSettlementSummary는 파트너의 정산 요약 통계를 조회합니다.
func (h *SettlementHandler) GetSettlementSummary(c *gin.Context) {
	partnerID := c.GetInt("userId")
	from := c.Query("from")
	to := c.Query("to")
	res, err := h.service.GetSettlementSummary(partnerID, from, to)
	if err != nil {
		response.HandleError(c, err)
		return
	}
	response.Success(c, res)
}

// parseIntQuery는 쿼리 파라미터 문자열을 int로 파싱합니다.
func parseIntQuery(s string) (int, bool) {
	var id int
	for _, c := range s {
		if c < '0' || c > '9' {
			return 0, false
		}
		id = id*10 + int(c-'0')
	}
	return id, len(s) > 0
}
