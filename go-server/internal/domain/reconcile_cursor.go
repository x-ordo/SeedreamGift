package domain

import "time"

// ReconcileCursor 는 Seedream /api/v1/vaccount GET 을 이용한 safety-net
// Reconcile 작업의 마지막 동기화 시점을 저장하는 싱글턴 레코드입니다.
//
// 단일 row 제약(Id = 1) 을 DB 레벨 CHECK 로 강제하여 동시성 이슈를 단순화합니다.
// 실제 업데이트는 `SELECT ... WITH (UPDLOCK, HOLDLOCK)` 비관적 락으로 수행.
//
// 참조: 통합 설계 §4.4, 상위 가이드 §6.6
type ReconcileCursor struct {
	// ID 는 싱글턴 강제 PK (항상 1).
	ID int `gorm:"primaryKey;column:Id;default:1;check:Id = 1" json:"id"`
	// LastSyncAt 은 이 시점까지 Reconcile 이 확인한 주문의 상한 (다음 Run 의 from 기준).
	LastSyncAt time.Time `gorm:"column:LastSyncAt" json:"lastSyncAt"`
	// LastRunAt 은 최근 Reconcile 실행 완료 시각 (성공/실패 무관).
	LastRunAt time.Time `gorm:"column:LastRunAt" json:"lastRunAt"`
	// LastErrorAt 은 최근 Reconcile 실패 시각.
	LastErrorAt *time.Time `gorm:"column:LastErrorAt" json:"lastErrorAt,omitempty"`
	// LastError 는 최근 실패 메시지 (최대 500자).
	LastError *string `gorm:"column:LastError;type:nvarchar(500)" json:"lastError,omitempty"`
}

// TableName 은 GORM 이 사용할 테이블 이름을 반환합니다.
func (ReconcileCursor) TableName() string { return "SeedreamReconcileCursors" }
