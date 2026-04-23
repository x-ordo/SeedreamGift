// Package handlers — Seedream 결제 취소/환불 HTTP 진입점.
//
// 본 파일은 통합 엔드포인트 `POST /api/v1/payment/seedream/cancel` 을 정의합니다.
// 요청 바디의 `payMethod` 필드에 따라 두 가지 시나리오로 분기:
//
//   - `VACCOUNT-ISSUECAN` — 입금 전 발급 취소 (CancelService.CancelIssued)
//   - `BANK`              — 입금 후 환불 (CancelService.Refund)
//
// 핸들러는 의도적으로 얇은 계층입니다. 실제 비즈니스 규칙
// (cancelReason 5~50 rune, bankCode 화이트리스트 등)은 CancelService 가
// 강제하며, 본 핸들러는 Seedream sentinel error 를 HTTP status 로 매핑합니다.
//
// 에러 매핑 (플랜 §7.10):
//
//	ErrCancelAlreadyDone    → 200 + {alreadyDone: true}  (성공 처리)
//	ErrValidation (내부)     → 400 + errorCode "VALIDATION"
//	ErrCancelInvalidState   → 409 + errorCode "CANCEL_INVALID_STATE"
//	gorm.ErrRecordNotFound  → 404 + errorCode "NOT_FOUND"   (권한 결합 실패 포함)
//	ErrExternalAPI          → 502 + errorCode "EXTERNAL_API_ERROR"
//	default                 → 500 + errorCode "INTERNAL"
package handlers

import (
	"context"
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"seedream-gift-server/internal/app/services"
	"seedream-gift-server/internal/infra/seedream"
)

// CancelServiceAPI 는 SeedreamCancelHandler 가 의존하는 CancelService 의
// 하위집합입니다. 테스트에서 mock 하기 위한 인터페이스 경계 —
// `*services.CancelService` 는 본 인터페이스를 만족합니다.
type CancelServiceAPI interface {
	CancelIssued(ctx context.Context, in services.SeedreamCancelInput) (*services.SeedreamCancelResult, error)
	Refund(ctx context.Context, in services.SeedreamRefundInput) (*services.SeedreamCancelResult, error)
}

// 컴파일 타임 guard — 프로덕션 구현이 인터페이스를 계속 만족하는지 확인.
// 시그니처 drift 발생 시 빌드가 깨지도록 강제.
var _ CancelServiceAPI = (*services.CancelService)(nil)

// SeedreamCancelHandler 는 통합 cancel/refund HTTP 엔드포인트를 제공합니다.
type SeedreamCancelHandler struct {
	cancelSvc CancelServiceAPI
}

// NewSeedreamCancelHandler 는 프로덕션 CancelService 에 바인딩된 핸들러를 생성.
func NewSeedreamCancelHandler(svc *services.CancelService) *SeedreamCancelHandler {
	return &SeedreamCancelHandler{cancelSvc: svc}
}

// CancelHTTPRequest 는 핸들러가 수신하는 사용자 노출용 JSON 바디.
// `seedream.CancelPaymentRequest` 와는 **다릅니다** — 저쪽은 Seedream wire format.
type CancelHTTPRequest struct {
	OrderCode    string `json:"orderCode"    binding:"required"`
	PayMethod    string `json:"payMethod"    binding:"required,oneof=VACCOUNT-ISSUECAN BANK"`
	CancelReason string `json:"cancelReason" binding:"required,min=5,max=50"`

	// BANK 전용. VACCOUNT-ISSUECAN 에서는 무시.
	BankCode  string `json:"bankCode,omitempty"`
	AccountNo string `json:"accountNo,omitempty"`
}

// CancelHTTPResponse 는 성공 응답 바디. Seedream 원본 응답(Data)과 함께
// AlreadyDone 플래그·메시지를 노출.
type CancelHTTPResponse struct {
	Success     bool                     `json:"success"`
	AlreadyDone bool                     `json:"alreadyDone,omitempty"`
	Data        *seedream.CancelResponse `json:"data,omitempty"`
	Message     string                   `json:"message,omitempty"`
}

// Handle 는 POST /api/v1/payment/seedream/cancel 의 진입점.
//
// 인증은 미들웨어 레벨에서 JWT 로 수행되며, userId 는 gin context
// 에 세팅되어 있다고 가정합니다 (auth_middleware.go 와 동일 패턴).
func (h *SeedreamCancelHandler) Handle(c *gin.Context) {
	var req CancelHTTPRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success":   false,
			"errorCode": "VALIDATION",
			"error":     err.Error(),
		})
		return
	}

	// JWT 미들웨어가 userId 를 context 에 세팅했는지 확인.
	// `c.Get` 이 존재 여부를 boolean 으로 돌려줌 — `c.GetInt` 는 누락 시
	// 0 을 반환해서 "정상적인 userId=0" 와 구별할 수 없으므로 사용 X.
	userIDAny, exists := c.Get("userId")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success":   false,
			"errorCode": "UNAUTHORIZED",
			"error":     "인증이 필요합니다",
		})
		return
	}
	userID, ok := userIDAny.(int)
	if !ok || userID <= 0 {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success":   false,
			"errorCode": "UNAUTHORIZED",
			"error":     "인증이 필요합니다",
		})
		return
	}

	ctx := c.Request.Context()
	var result *services.SeedreamCancelResult
	var err error

	switch req.PayMethod {
	case "VACCOUNT-ISSUECAN":
		result, err = h.cancelSvc.CancelIssued(ctx, services.SeedreamCancelInput{
			OrderCode:    req.OrderCode,
			CancelReason: req.CancelReason,
			UserID:       userID,
		})
	case "BANK":
		// BANK 결제수단은 bankCode + accountNo 필수.
		// (Service 계층에서도 검증하지만, Seedream 호출 직전에 떨어지는 편이
		//  사용자 경험에 유리 — 400 vs 500 구분.)
		if req.BankCode == "" || req.AccountNo == "" {
			c.JSON(http.StatusBadRequest, gin.H{
				"success":   false,
				"errorCode": "VALIDATION",
				"error":     "BANK 결제수단은 bankCode 와 accountNo 가 필수입니다",
			})
			return
		}
		result, err = h.cancelSvc.Refund(ctx, services.SeedreamRefundInput{
			OrderCode:    req.OrderCode,
			CancelReason: req.CancelReason,
			BankCode:     req.BankCode,
			AccountNo:    req.AccountNo,
			UserID:       userID,
		})
	default:
		// binding:"oneof" 가 먼저 걸러내므로 이 경로는 이론상 도달 불가.
		// 방어적으로 400 반환 (validator bypass 대비).
		c.JSON(http.StatusBadRequest, gin.H{
			"success":   false,
			"errorCode": "VALIDATION",
			"error":     "unsupported payMethod",
		})
		return
	}

	if err != nil {
		status, body := mapCancelError(err)
		c.JSON(status, body)
		return
	}

	if result != nil && result.AlreadyDone {
		c.JSON(http.StatusOK, CancelHTTPResponse{
			Success:     true,
			AlreadyDone: true,
			Message:     "이미 취소 완료된 건입니다",
		})
		return
	}

	c.JSON(http.StatusOK, CancelHTTPResponse{
		Success: true,
		Data:    resultResponse(result),
	})
}

// resultResponse 는 nil-safe 하게 Seedream 응답 포인터를 추출.
func resultResponse(r *services.SeedreamCancelResult) *seedream.CancelResponse {
	if r == nil {
		return nil
	}
	return r.Response
}

// mapCancelError 는 CancelService 가 반환한 에러를 HTTP status + body 로 변환.
//
// 매핑 우선순위:
//  1. gorm.ErrRecordNotFound (order/payment 조회 실패 또는 권한 결합 실패) → 404
//  2. seedream.ErrCancelInvalidState                                     → 409
//  3. seedream.ErrValidation (Seedream 측 VALIDATION)                     → 400
//  4. seedream.ErrExternalAPI (네트워크/5xx 등)                            → 502
//  5. 내부 validate*() 함수가 반환한 fmt.Errorf                             → 400
//  6. 그 외 모든 에러                                                       → 500
//
// 주의: CancelService 는 내부 검증 실패에 대해 명시적 sentinel 을 사용하지
// 않고 `fmt.Errorf` 로만 감싼다. 따라서 sentinel 매칭이 모두 실패한 경우,
// "원본 에러 메시지가 내부 검증 사유인지" 구분할 방법이 없으므로 보수적으로
// 500 으로 내려보낸다 — 단, 레이어 경계에서 cancelReason 길이 등은 `binding`
// 태그로 이미 걸러지므로 이 경로는 실무상 드물다.
func mapCancelError(err error) (int, gin.H) {
	// 1) 주문 조회 실패 / 권한 결합 실패 — UserId 불일치도 여기로 빠짐.
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return http.StatusNotFound, gin.H{
			"success":   false,
			"errorCode": "NOT_FOUND",
			"error":     "주문을 찾을 수 없거나 권한이 없습니다",
		}
	}

	// 2) Seedream 상태 전이 불가 — 이미 취소된 건·입금 완료 후 ISSUECAN 등.
	if errors.Is(err, seedream.ErrCancelInvalidState) {
		return http.StatusConflict, gin.H{
			"success":   false,
			"errorCode": "CANCEL_INVALID_STATE",
			"error":     "현재 결제 상태에서 취소할 수 없습니다",
		}
	}

	// 3) Seedream VALIDATION — 필드 포맷 오류 등.
	if errors.Is(err, seedream.ErrValidation) {
		return http.StatusBadRequest, gin.H{
			"success":   false,
			"errorCode": "VALIDATION",
			"error":     err.Error(),
		}
	}

	// 4) Seedream 외부 장애 — 5xx, 네트워크, 타임아웃 등.
	if errors.Is(err, seedream.ErrExternalAPI) ||
		errors.Is(err, seedream.ErrTimeout) ||
		errors.Is(err, seedream.ErrCircuitBreakerOpen) {
		return http.StatusBadGateway, gin.H{
			"success":   false,
			"errorCode": "EXTERNAL_API_ERROR",
			"error":     "결제 서비스 호출에 실패했습니다",
		}
	}

	// 5) fallback — 내부 예외 / 알 수 없는 에러.
	return http.StatusInternalServerError, gin.H{
		"success":   false,
		"errorCode": "INTERNAL",
		"error":     "서버 오류가 발생했습니다",
	}
}
