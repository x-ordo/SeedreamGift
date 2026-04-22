/*
Package handlers는 KCB(Korea Credit Bureau) 휴대폰 본인확인 서비스를 위한 HTTP 요청/응답 핸들링 로직을 제공합니다.
*/
package handlers

import (
	"w-gift-server/internal/app/services"
	"w-gift-server/pkg/logger"
	"w-gift-server/pkg/response"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

// KcbHandler는 KCB 휴대폰 본인확인 관련 HTTP 요청을 처리하는 핸들러입니다.
type KcbHandler struct {
	service *services.KycService
}

// NewKcbHandler는 새로운 KcbHandler 인스턴스를 생성합니다.
func NewKcbHandler(service *services.KycService) *KcbHandler {
	return &KcbHandler{service: service}
}

// Start godoc
// @Summary KCB 본인인증 세션 시작
// @Tags KCB
// @Produce json
// @Success 200 {object} APIResponse
// @Failure 400 {object} APIResponse
// @Router /kyc/kcb/start [post]
// Start는 KCB 휴대폰 본인확인 세션을 시작하고 인증 ID 및 팝업 URL을 반환합니다.
func (h *KcbHandler) Start(c *gin.Context) {
	result, err := h.service.StartKcbAuth()
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.Success(c, result)
}

// CheckStatus godoc
// @Summary KCB 인증 상태 조회
// @Tags KCB
// @Produce json
// @Param kcbAuthId query string true "KCB 인증 ID"
// @Success 200 {object} APIResponse
// @Router /kyc/kcb/check-status [get]
// CheckStatus는 진행 중인 KCB 본인확인 세션의 상태를 조회합니다.
func (h *KcbHandler) CheckStatus(c *gin.Context) {
	kcbAuthId := c.Query("kcbAuthId")
	if kcbAuthId == "" {
		response.BadRequest(c, "kcbAuthId is required")
		return
	}
	result, err := h.service.CheckKcbStatus(kcbAuthId)
	if err != nil {
		response.Success(c, gin.H{"status": "pending"})
		return
	}
	response.Success(c, result)
}

// Complete godoc
// @Summary KCB 본인인증 완료
// @Tags KCB
// @Accept json
// @Produce json
// @Param body body object true "KCB 인증 결과 데이터" SchemaExample({"kcbAuthId":"string","name":"string","phone":"string","ci":"string","birth":"string","gender":"string","nationality":"string","telco":"string"})
// @Success 200 {object} APIResponse
// @Failure 400 {object} APIResponse
// @Failure 500 {object} APIResponse
// @Router /kyc/kcb/complete [post]
// Complete는 KCB 본인확인 프로세스를 완료하고 확인된 신원 정보를 저장합니다.
//
// FIX C-3: 클라이언트가 전달한 신원 데이터를 서버 측 검증 없이 그대로 수용하는 취약점이 있습니다.
// TODO: 실제 KCB 서버-간(S2S) 콜백 검증을 구현하여 클라이언트 데이터를 신뢰하지 않도록 해야 합니다.
// TODO: 이 엔드포인트에 IP 기반 rate limiting을 적용하여 무차별 대입 공격을 방지해야 합니다.
func (h *KcbHandler) Complete(c *gin.Context) {
	var req struct {
		KcbAuthId   string `json:"kcbAuthId"   binding:"required"`
		Name        string `json:"name"`
		Phone       string `json:"phone"`
		CI          string `json:"ci"`
		Birth       string `json:"birth"`
		Gender      string `json:"gender"`
		Nationality string `json:"nationality"`
		Telco       string `json:"telco"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "kcbAuthId is required")
		return
	}

	// FIX C-3: kcbAuthId 형식 최소 검증 (빈 문자열 및 비정상 길이 거부)
	if len(req.KcbAuthId) < 10 || len(req.KcbAuthId) > 100 {
		response.BadRequest(c, "유효하지 않은 kcbAuthId입니다")
		return
	}

	result, err := h.service.CompleteKcbAuth(
		req.KcbAuthId, req.Name, req.Phone, req.CI,
		req.Birth, req.Gender, req.Nationality, req.Telco,
	)
	if err != nil {
		logger.Log.Error("KCB auth complete failed", zap.Error(err), zap.String("handler", "Complete"))
		response.InternalServerError(c, "서버 오류가 발생했습니다")
		return
	}
	response.Success(c, result)
}
