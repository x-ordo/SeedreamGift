package seedream

import (
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestMapErrorCode(t *testing.T) {
	tests := []struct {
		code     string
		sentinel error
	}{
		{"VALIDATION", ErrValidation},
		{"UNAUTHORIZED", ErrUnauthorized},
		{"FORBIDDEN", ErrForbidden},
		{"NOT_FOUND", ErrNotFound},
		{"CONFLICT", ErrConflict},
		{"INVALID_STATE_TRANSITION", ErrInvalidState},
		{"IDEMPOTENCY_KEY_REUSE", ErrIdempotencyReuse},
		{"TOO_MANY_REQUESTS", ErrTooManyRequests},
		{"INTERNAL", ErrInternal},
		{"EXTERNAL_API_ERROR", ErrExternalAPI},
		{"CIRCUIT_BREAKER_OPEN", ErrCircuitBreakerOpen},
		{"TIMEOUT", ErrTimeout},
		{"CANCEL_INVALID_STATE", ErrCancelInvalidState},
		{"CANCEL_ALREADY_DONE", ErrCancelAlreadyDone},
		{"CANCEL_API_FAILED", ErrCancelAPIFailed},
		{"CANCEL_REASON_EMPTY", ErrCancelReasonEmpty},
	}
	for _, tc := range tests {
		t.Run(tc.code, func(t *testing.T) {
			err := MapErrorCode(tc.code, "msg", "ERR-ABC", "trace-1")
			assert.True(t, errors.Is(err, tc.sentinel),
				"errorCode %s should wrap %v, got %v", tc.code, tc.sentinel, err)
			// 컨텍스트 정보가 보존되는지 확인
			var apiErr *APIError
			assert.True(t, errors.As(err, &apiErr))
			assert.Equal(t, tc.code, apiErr.Code)
			assert.Equal(t, "ERR-ABC", apiErr.ErrorID)
			assert.Equal(t, "trace-1", apiErr.TraceID)
		})
	}
}

func TestMapErrorCode_Unknown(t *testing.T) {
	err := MapErrorCode("WEIRD_NEW_CODE", "msg", "ERR-X", "trace-2")
	assert.True(t, errors.Is(err, ErrUnknown))
}

func TestAPIError_Message(t *testing.T) {
	err := MapErrorCode("VALIDATION", "필드 오류", "ERR-1", "trace-a")
	assert.Contains(t, err.Error(), "VALIDATION")
	assert.Contains(t, err.Error(), "필드 오류")
}
