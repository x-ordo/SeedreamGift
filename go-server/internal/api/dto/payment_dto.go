// Package dto provides API response data transfer objects.
package dto

import "time"

// PaymentListItem은 결제현황 리스트 뷰의 단일 행 DTO입니다.
// Admin/Partner 공통 필드를 정의하고, Partner용 인스턴스는 mask 함수에서 민감 필드를 `nil`로 만듭니다.
type PaymentListItem struct {
	PaymentID     int        `json:"paymentId"`
	OrderID       int        `json:"orderId"`
	OrderCode     *string    `json:"orderCode"`
	CustomerName  *string    `json:"customerName"`        // Partner에서는 nil
	CustomerEmail *string    `json:"customerEmail,omitempty"` // Admin only
	Method        string     `json:"method"`
	Status        string     `json:"status"`
	Amount        float64    `json:"amount"`
	FailReason    *string    `json:"failReason"`          // Partner에서는 nil
	ConfirmedAt   *time.Time `json:"confirmedAt"`
	CreatedAt     time.Time  `json:"createdAt"`
}

// PaymentDetail은 주문 상세 드릴다운에서 사용하는 결제 시도 기록 DTO입니다.
type PaymentDetail struct {
	ID                   int        `json:"id"`
	OrderID              int        `json:"orderId"`
	Method               string     `json:"method"`
	Status               string     `json:"status"`
	Amount               float64    `json:"amount"`
	BankCode             *string    `json:"bankCode"`
	BankName             *string    `json:"bankName"`
	AccountNumberMasked  *string    `json:"accountNumberMasked"` // 전체 뒤 4자리, 항상 마스킹 형태로 노출
	DepositorName        *string    `json:"depositorName"`        // Partner에서는 "홍*" 형태
	BankTxID             *string    `json:"bankTxId"`             // Partner에서는 "PAY_abc1****"
	ConfirmedAt          *time.Time `json:"confirmedAt"`
	CancelledAt          *time.Time `json:"cancelledAt"`
	ExpiresAt            *time.Time `json:"expiresAt"`
	FailReason           *string    `json:"failReason"`           // Partner에서는 nil
	CreatedAt            time.Time  `json:"createdAt"`
}

// PaymentListResponse는 결제 리스트 엔드포인트 응답 래퍼입니다.
type PaymentListResponse struct {
	Items    []PaymentListItem `json:"items"`
	Total    int64             `json:"total"`
	Page     int               `json:"page"`
	PageSize int               `json:"pageSize"`
	Summary  PaymentSummary    `json:"summary"`
}

// PaymentSummary는 현재 필터(status 제외)의 상태별 집계입니다.
type PaymentSummary struct {
	TotalCount     int64 `json:"totalCount"`
	SuccessCount   int64 `json:"successCount"`
	FailedCount    int64 `json:"failedCount"`
	PendingCount   int64 `json:"pendingCount"`
	CancelledCount int64 `json:"cancelledCount"`
}
