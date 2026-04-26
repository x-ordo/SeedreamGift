// Package apperror는 서비스 계층에서 사용하는 타입화된 에러를 제공합니다.
// 각 에러에는 HTTP 상태 코드와 매핑되는 코드가 포함되어 있어,
// 핸들러 계층에서 strings.Contains 등의 해킹 없이 적절한 HTTP 응답을 생성할 수 있습니다.
package apperror

import (
	"errors"
	"fmt"
	"net/http"
)

// Code는 에러의 분류를 나타내는 문자열 타입입니다.
type Code string

const (
	// CodeNotFound는 요청한 리소스를 찾을 수 없음을 나타냅니다 (HTTP 404).
	CodeNotFound Code = "NOT_FOUND"
	// CodeValidation은 클라이언트의 입력 데이터가 유효하지 않음을 나타냅니다 (HTTP 400).
	CodeValidation Code = "VALIDATION"
	// CodeUnauthorized는 인증 실패(잘못된 자격 증명, 만료된 토큰 등)를 나타냅니다 (HTTP 401).
	CodeUnauthorized Code = "UNAUTHORIZED"
	// CodeForbidden은 인가 실패(권한 부족)를 나타냅니다 (HTTP 403).
	CodeForbidden Code = "FORBIDDEN"
	// CodeConflict는 리소스 충돌(중복 등)을 나타냅니다 (HTTP 409).
	CodeConflict Code = "CONFLICT"
	// CodeInternal은 서버 내부 오류를 나타냅니다 (HTTP 500).
	CodeInternal Code = "INTERNAL"
)

// AppError는 비즈니스 로직에서 발생하는 타입화된 에러입니다.
// Code를 통해 에러의 종류를 구분하고, 적절한 HTTP 상태 코드로 매핑됩니다.
type AppError struct {
	// Code는 에러의 분류 코드입니다.
	Code Code
	// Message는 클라이언트에 전달할 에러 메시지입니다.
	Message string
	// Err는 원인 에러입니다 (있는 경우). Unwrap()을 통해 접근 가능합니다.
	Err error
	// FieldErrors는 필드별 검증 에러입니다 (검증 실패 시에만 설정).
	FieldErrors map[string]string
}

// Error는 에러 메시지를 반환합니다. 원인 에러가 있으면 함께 포함합니다.
func (e *AppError) Error() string {
	if e.Err != nil {
		return fmt.Sprintf("%s: %v", e.Message, e.Err)
	}
	return e.Message
}

// Unwrap은 원인 에러를 반환하여 errors.Is/errors.As 체인을 지원합니다.
func (e *AppError) Unwrap() error {
	return e.Err
}

// HTTPStatus는 에러 코드에 대응하는 HTTP 상태 코드를 반환합니다.
func (e *AppError) HTTPStatus() int {
	switch e.Code {
	case CodeNotFound:
		return http.StatusNotFound
	case CodeValidation:
		return http.StatusBadRequest
	case CodeUnauthorized:
		return http.StatusUnauthorized
	case CodeForbidden:
		return http.StatusForbidden
	case CodeConflict:
		return http.StatusConflict
	case CodeInternal:
		return http.StatusInternalServerError
	default:
		return http.StatusInternalServerError
	}
}

// ── 생성자 함수 ──

// NotFound는 리소스를 찾을 수 없을 때 사용하는 에러를 생성합니다.
func NotFound(msg string) *AppError {
	return &AppError{Code: CodeNotFound, Message: msg}
}

// NotFoundf는 포맷 문자열을 지원하는 NotFound 에러를 생성합니다.
func NotFoundf(format string, a ...any) *AppError {
	return &AppError{Code: CodeNotFound, Message: fmt.Sprintf(format, a...)}
}

// Validation은 클라이언트 입력 검증 실패 시 사용하는 에러를 생성합니다.
func Validation(msg string) *AppError {
	return &AppError{Code: CodeValidation, Message: msg}
}

// Validationf는 포맷 문자열을 지원하는 Validation 에러를 생성합니다.
func Validationf(format string, a ...any) *AppError {
	return &AppError{Code: CodeValidation, Message: fmt.Sprintf(format, a...)}
}

// ValidationWithFields는 필드별 검증 에러를 포함하는 에러를 생성합니다.
func ValidationWithFields(msg string, fields map[string]string) *AppError {
	return &AppError{Code: CodeValidation, Message: msg, FieldErrors: fields}
}

// Unauthorized는 인증 실패 시 사용하는 에러를 생성합니다.
func Unauthorized(msg string) *AppError {
	return &AppError{Code: CodeUnauthorized, Message: msg}
}

// Forbidden은 권한 부족 시 사용하는 에러를 생성합니다.
func Forbidden(msg string) *AppError {
	return &AppError{Code: CodeForbidden, Message: msg}
}

// Conflict는 리소스 충돌(중복) 시 사용하는 에러를 생성합니다.
func Conflict(msg string) *AppError {
	return &AppError{Code: CodeConflict, Message: msg}
}

// Internal은 서버 내부 오류 시 사용하는 에러를 생성합니다.
// cause에 원인 에러를 전달하면 로그에 원인이 기록됩니다.
func Internal(msg string, cause error) *AppError {
	return &AppError{Code: CodeInternal, Message: msg, Err: cause}
}

// Wrap은 기존 에러를 AppError로 래핑합니다.
func Wrap(err error, code Code, msg string) *AppError {
	return &AppError{Code: code, Message: msg, Err: err}
}

// As는 에러 체인에서 AppError를 추출합니다.
// errors.As의 편의 래퍼로, 핸들러에서 간결하게 사용할 수 있습니다.
func As(err error) (*AppError, bool) {
	var ae *AppError
	ok := errors.As(err, &ae)
	return ae, ok
}

// ── Sentinel 에러 ──
//
// AppError 와 달리 errors.Is 로 분류만 식별하기 위한 표식입니다.
// HTTP 응답 매핑이 아닌 로깅 레벨 분기·재시도 분기 등 인프라 계층 의사결정에 사용합니다.

// ErrOrderNotFound 는 OrderCode 로 주문을 찾지 못한 retriable 시나리오를 표식합니다.
// 웹훅이 Order INSERT 보다 먼저 도착하는 race, smoke test fixture, stale 재전송 등
// "정상적으로 다시 시도하면 해결되는" 케이스를 ERROR 가 아닌 WARN 으로 강등하기 위한 sentinel.
var ErrOrderNotFound = errors.New("order not found")
