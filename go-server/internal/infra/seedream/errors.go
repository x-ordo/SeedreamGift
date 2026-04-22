package seedream

import (
	"errors"
	"fmt"
)

// Sentinel error 정의 (§3.3 에러 코드 매트릭스).
// errors.Is 로 매칭하고, APIError 로 컨텍스트 접근.
var (
	ErrValidation         = errors.New("seedream: VALIDATION")
	ErrUnauthorized       = errors.New("seedream: UNAUTHORIZED")
	ErrForbidden          = errors.New("seedream: FORBIDDEN")
	ErrNotFound           = errors.New("seedream: NOT_FOUND")
	ErrConflict           = errors.New("seedream: CONFLICT")
	ErrInvalidState       = errors.New("seedream: INVALID_STATE_TRANSITION")
	ErrIdempotencyReuse   = errors.New("seedream: IDEMPOTENCY_KEY_REUSE")
	ErrTooManyRequests    = errors.New("seedream: TOO_MANY_REQUESTS")
	ErrInternal           = errors.New("seedream: INTERNAL")
	ErrExternalAPI        = errors.New("seedream: EXTERNAL_API_ERROR")
	ErrCircuitBreakerOpen = errors.New("seedream: CIRCUIT_BREAKER_OPEN")
	ErrTimeout            = errors.New("seedream: TIMEOUT")
	ErrCancelInvalidState = errors.New("seedream: CANCEL_INVALID_STATE")
	ErrCancelAlreadyDone  = errors.New("seedream: CANCEL_ALREADY_DONE")
	ErrCancelAPIFailed    = errors.New("seedream: CANCEL_API_FAILED")
	ErrCancelReasonEmpty  = errors.New("seedream: CANCEL_REASON_EMPTY")
	ErrUnknown            = errors.New("seedream: UNKNOWN_ERROR_CODE")
)

// APIError 는 Seedream 이 반환한 에러의 구조화된 정보를 담습니다.
// Go sentinel 과 errors.Is 로 매칭 가능하며, ErrorID·TraceID 로 Ops 추적 지원.
type APIError struct {
	Code     string // Seedream errorCode (예: "VALIDATION")
	Message  string // 사람이 읽는 한국어 메시지
	ErrorID  string // "ERR-{16 HEX}"
	TraceID  string // meta.traceId
	sentinel error  // errors.Is 판정용
}

// Error 는 error 인터페이스 구현. 운영 로그 파싱에 적합한 포맷.
func (e *APIError) Error() string {
	return fmt.Sprintf("seedream: %s (%s) errorId=%s traceId=%s",
		e.Code, e.Message, e.ErrorID, e.TraceID)
}

// Unwrap 은 errors.Is/As 가 sentinel 을 찾을 수 있도록 연결합니다.
func (e *APIError) Unwrap() error { return e.sentinel }

// errorCodeSentinels 는 Seedream errorCode 문자열을 Go sentinel 로 매핑합니다.
var errorCodeSentinels = map[string]error{
	"VALIDATION":               ErrValidation,
	"UNAUTHORIZED":             ErrUnauthorized,
	"FORBIDDEN":                ErrForbidden,
	"NOT_FOUND":                ErrNotFound,
	"CONFLICT":                 ErrConflict,
	"INVALID_STATE_TRANSITION": ErrInvalidState,
	"IDEMPOTENCY_KEY_REUSE":    ErrIdempotencyReuse,
	"TOO_MANY_REQUESTS":        ErrTooManyRequests,
	"INTERNAL":                 ErrInternal,
	"EXTERNAL_API_ERROR":       ErrExternalAPI,
	"CIRCUIT_BREAKER_OPEN":     ErrCircuitBreakerOpen,
	"TIMEOUT":                  ErrTimeout,
	"CANCEL_INVALID_STATE":     ErrCancelInvalidState,
	"CANCEL_ALREADY_DONE":      ErrCancelAlreadyDone,
	"CANCEL_API_FAILED":        ErrCancelAPIFailed,
	"CANCEL_REASON_EMPTY":      ErrCancelReasonEmpty,
}

// MapErrorCode 는 Seedream errorCode 문자열을 APIError 로 래핑합니다.
// 알 수 없는 code 는 ErrUnknown 으로 처리.
func MapErrorCode(code, message, errorID, traceID string) error {
	sentinel, ok := errorCodeSentinels[code]
	if !ok {
		sentinel = ErrUnknown
	}
	return &APIError{
		Code:     code,
		Message:  message,
		ErrorID:  errorID,
		TraceID:  traceID,
		sentinel: sentinel,
	}
}
