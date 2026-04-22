// Package dto provides API response data transfer objects.
package dto

import "time"

// PaymentListItem은 결제현황 리스트 뷰의 단일 행 DTO입니다.
// Admin/Partner 공통 필드를 정의하고, Partner용 인스턴스는 mask 함수에서 민감 필드를 `nil`로 만듭니다.
// Partner 마스킹으로 `nil`이 된 필드는 JSON에서 `null`로 노출됩니다 (필드 누락 아님 — 의도적 마스킹 신호).
type PaymentListItem struct {
	// PaymentID는 결제 레코드의 기본 키입니다.
	PaymentID int `json:"paymentId"`
	// OrderID는 결제 대상 주문의 ID입니다.
	OrderID int `json:"orderId"`
	// OrderCode는 사용자에게 노출되는 고유 주문 번호입니다.
	OrderCode *string `json:"orderCode"`
	// CustomerName은 주문자의 이름입니다. Partner 응답에서는 마스킹되어 `nil`입니다.
	CustomerName *string `json:"customerName"`
	// CustomerEmail은 주문자의 이메일입니다. Admin 응답에만 포함. Partner 응답에서는 필드 자체를 생략합니다.
	CustomerEmail *string `json:"customerEmail,omitempty"`
	// Method는 결제 수단입니다.
	Method string `json:"method"`
	// Status는 결제 상태입니다. (PENDING, SUCCESS, FAILED, CANCELLED)
	Status string `json:"status"`
	// Amount는 실 결제 금액(원)입니다. 한국 원화 정수 단위로 표현합니다.
	Amount int64 `json:"amount"`
	// FailReason은 결제 실패 사유입니다. Partner 응답에서는 마스킹되어 `nil`입니다.
	FailReason *string `json:"failReason"`
	// ConfirmedAt은 결제가 확정(입금 완료 등)된 시각입니다.
	ConfirmedAt *time.Time `json:"confirmedAt"`
	// CreatedAt은 결제 레코드 생성 시각입니다.
	CreatedAt time.Time `json:"createdAt"`
}

// PaymentDetail은 주문 상세 드릴다운에서 사용하는 결제 시도 기록 DTO입니다.
// Partner 마스킹으로 `nil`이 된 필드는 JSON에서 `null`로 노출됩니다 (필드 누락 아님 — 의도적 마스킹 신호).
type PaymentDetail struct {
	// PaymentID는 결제 레코드의 기본 키입니다.
	PaymentID int `json:"paymentId"`
	// OrderID는 결제 대상 주문의 ID입니다.
	OrderID int `json:"orderId"`
	// Method는 결제 수단입니다.
	Method string `json:"method"`
	// Status는 결제 상태입니다. (PENDING, SUCCESS, FAILED, CANCELLED)
	Status string `json:"status"`
	// Amount는 실 결제 금액(원)입니다. 한국 원화 정수 단위로 표현합니다.
	Amount int64 `json:"amount"`
	// BankCode는 가상계좌 입금 시 은행 코드입니다.
	BankCode *string `json:"bankCode"`
	// BankName은 가상계좌 입금 시 은행 이름입니다.
	BankName *string `json:"bankName"`
	// AccountNumberMasked는 가상계좌 번호의 마스킹 표현입니다. 전체 뒤 4자리, 항상 마스킹 형태로 노출됩니다.
	AccountNumberMasked *string `json:"accountNumberMasked"`
	// DepositorName은 입금자명입니다. Partner 응답에서는 "홍*" 형태로 마스킹됩니다.
	DepositorName *string `json:"depositorName"`
	// BankTxID는 은행 또는 PG사에서 발급한 거래 식별 번호입니다. Partner 응답에서는 "PAY_abc1****" 형태로 마스킹됩니다.
	BankTxID *string `json:"bankTxId"`
	// ConfirmedAt은 결제가 확정(입금 완료 등)된 시각입니다.
	ConfirmedAt *time.Time `json:"confirmedAt"`
	// CancelledAt은 결제가 취소된 시각입니다.
	CancelledAt *time.Time `json:"cancelledAt"`
	// ExpiresAt은 가상계좌 등의 입금 만료 시각입니다.
	ExpiresAt *time.Time `json:"expiresAt"`
	// FailReason은 결제 실패 사유입니다. Partner 응답에서는 마스킹되어 `nil`입니다.
	FailReason *string `json:"failReason"`
	// CreatedAt은 결제 레코드 생성 시각입니다.
	CreatedAt time.Time `json:"createdAt"`
}

// PaymentListResponse는 결제 리스트 엔드포인트 응답 래퍼입니다.
type PaymentListResponse struct {
	// Items는 현재 페이지에 포함된 결제 레코드 목록입니다.
	Items []PaymentListItem `json:"items"`
	// Total은 필터에 매칭되는 전체 레코드 수입니다.
	Total int64 `json:"total"`
	// Page는 현재 페이지 번호(1-based)입니다.
	Page int `json:"page"`
	// PageSize는 페이지당 레코드 수입니다.
	PageSize int `json:"pageSize"`
	// Summary는 현재 필터(status 제외)의 상태별 집계입니다.
	Summary PaymentSummary `json:"summary"`
}

// PaymentSummary는 현재 필터(status 제외)의 상태별 집계입니다.
type PaymentSummary struct {
	// TotalCount는 전체 결제 레코드 수입니다.
	TotalCount int64 `json:"totalCount"`
	// SuccessCount는 상태가 SUCCESS인 레코드 수입니다.
	SuccessCount int64 `json:"successCount"`
	// FailedCount는 상태가 FAILED인 레코드 수입니다.
	FailedCount int64 `json:"failedCount"`
	// PendingCount는 상태가 PENDING인 레코드 수입니다.
	PendingCount int64 `json:"pendingCount"`
	// CancelledCount는 상태가 CANCELLED인 레코드 수입니다.
	CancelledCount int64 `json:"cancelledCount"`
}
