// Package handlers는 Swagger 문서 생성을 위한 타입 정의를 포함합니다.
package handlers

// APIResponse는 모든 엔드포인트에서 사용하는 표준 JSON 응답 구조체입니다.
// Swag 어노테이션 해석을 위해 response.Response를 복사한 형태입니다.
type APIResponse struct {
	Success bool   `json:"success"`
	Data    any    `json:"data,omitempty"`
	Message string `json:"message,omitempty"`
	Error   string `json:"error,omitempty"`
	ErrorID string `json:"errorId,omitempty"`
}
