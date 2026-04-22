// Package cron은 Wow Gift 서버를 위한 예약된 백그라운드 작업을 제공합니다.
// 각 작업은 robfig cron 스케줄러에 등록되어 정해진 일정에 따라 데이터베이스 유지보수 작업을 실행합니다.
package cron

import (
	"fmt"
	"strings"
	"sync"
	"time"
	"w-gift-server/internal/api/middleware"
	"w-gift-server/internal/domain"
	"w-gift-server/pkg/logger"
	"w-gift-server/pkg/telegram"

	"github.com/robfig/cron/v3"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

// JobStatus는 등록된 크론 잡의 마지막 실행 상태 정보를 담습니다.
type JobStatus struct {
	Name     string `json:"name"`
	Schedule string `json:"schedule"`
	LastRun  string `json:"lastRun"` // ISO 타임스탬프 또는 "never"
	Status   string `json:"status"`  // "ok", "error", "never"
}

var (
	jobStatuses   []JobStatus
	jobMu         sync.Mutex
	jobFnRegistry = make(map[string]func())
	jobFnMu       sync.Mutex
)


// kstLoc는 한국 표준시(KST, UTC+9) 타임존 객체입니다.
// 패키지 초기화 시 한 번만 로드하여 반복 로딩 비용을 제거합니다.
var (
	kstLoc     *time.Location
	kstLocOnce sync.Once
)

// getKSTLocation은 KST 타임존을 반환합니다. 최초 호출 시에만 time.LoadLocation을 실행합니다.
func getKSTLocation() *time.Location {
	kstLocOnce.Do(func() {
		loc, err := time.LoadLocation("Asia/Seoul")
		if err != nil {
			loc = time.FixedZone("KST", 9*60*60)
		}
		kstLoc = loc
	})
	return kstLoc
}

// SettlementBatchRunner는 정산 배치 작업을 실행할 수 있는 인터페이스입니다.
// 순환 참조를 방지하기 위해 인터페이스로 정의합니다.
type SettlementBatchRunner interface {
	CreateBatchSettlement(frequency string) error
	CheckPartnerPostManagement()
}

// FulfillmentRunner는 외부 API 발급 파이프라인을 실행할 수 있는 인터페이스입니다.
type FulfillmentRunner interface {
	ProcessPendingOrders()
}

// CashReceiptRetryRunner는 현금영수증 실패 재시도 및 상태 동기화를 실행하는 인터페이스입니다.
type CashReceiptRetryRunner interface {
	RetryFailedReceipts()
	SyncPendingReceipts()
}

// OrderCleanupRunner는 만료 주문 자동 취소를 실행하는 인터페이스입니다.
type OrderCleanupRunner interface {
	CancelExpiredOrders()
}

// OutboxRunner는 트랜잭셔널 아웃박스 릴레이를 실행하는 인터페이스입니다.
type OutboxRunner interface {
	ProcessPending()
}

// Scheduler는 robfig cron 스케줄러를 래핑하며 작업을 위한 데이터베이스 접근 권한을 가집니다.
type Scheduler struct {
	c               *cron.Cron
	db              *gorm.DB
	archiveDays     int
	deleteDays      int
	settlementSvc   SettlementBatchRunner
	fulfillmentSvc  FulfillmentRunner
	cashReceiptSvc  CashReceiptRetryRunner
	orderCleanupSvc OrderCleanupRunner
	outboxSvc       OutboxRunner
}

// jobDef는 한글 이름, 크론 표현식 및 핸들러 함수를 쌍으로 정의합니다.
type jobDef struct {
	name  string // 표시용 한글 이름
	cron  string // 실제 cron 표현식
	label string // 표시용 스케줄 설명
	fn    func()
}

// New는 Scheduler를 생성하고 모든 애플리케이션 크론 잡을 등록합니다.
// archiveDays는 감사 로그를 보관 처리할 기준 일수이며, deleteDays는 영구 삭제할 기준 일수입니다.
func New(db *gorm.DB, archiveDays, deleteDays int) *Scheduler {
	// KST 타임존 설정 — 크론 스케줄이 한국 시간 기준으로 실행되도록 (패키지 레벨 캐시 사용)
	c := cron.New(
		cron.WithLocation(getKSTLocation()),
		cron.WithChain(cron.SkipIfStillRunning(cron.DefaultLogger)),
	)
	s := &Scheduler{c: c, db: db, archiveDays: archiveDays, deleteDays: deleteDays}

	jobs := []jobDef{
		{"KYC 인증세션 정리", "@every 1h", "매시간", s.cleanupKycSessions},
		{"만료 리프레시토큰 정리", "@every 6h", "6시간 간격", s.cleanupExpiredRefreshTokens},
		{"만료 멱등성 키 정리", "@every 6h", "6시간 간격", s.cleanupIdempotencyKeys},
		{"만료 바우처 처리", "0 0 * * *", "매일 00:00 KST", s.expireVouchers},
		{"만료 선물 처리", "0 0 * * *", "매일 00:00 KST", s.expireGifts},
		{"감사로그 아카이빙", "0 0 * * *", "매일 00:00 KST", s.archiveAuditLogs},
		{"재고 부족 알림", "@every 30m", "30분 간격", s.checkStockAlerts},
		{"주간 정산 배치", "0 0 * * 1", "매주 월요일 00:00 KST", s.weeklySettlement},
		{"월간 정산 배치", "0 0 1 * *", "매월 1일 00:00 KST", s.monthlySettlement},
		{"방치 장바구니 정리", "0 5 * * *", "매일 05:00 KST", s.cleanupAbandonedCarts},
		{"파트너 사후 관리", "0 3 * * *", "매일 03:00 KST", s.partnerPostManagement},
		{"만료 주문 자동 취소", "@every 5m", "5분 간격", s.cancelExpiredOrders},
		{"아웃박스 메시지 릴레이", "@every 30s", "30초 간격", s.processOutbox},
		{"API 발급 처리", "@every 15s", "15초 간격", s.processFulfillment},
		// [비활성화] 유가증권은 현금영수증 발급 대상 아님 (부가가치세법 시행령 제73조)
		// {"현금영수증 실패 재시도", "@every 30m", "30분 간격", s.retryCashReceipts},
		// {"현금영수증 상태 동기화", "0 4 * * *", "매일 04:00 KST", s.syncCashReceipts},
	}

	// Initialise status records and wrap each job function to track runs.
	jobMu.Lock()
	jobStatuses = make([]JobStatus, len(jobs))
	for i, j := range jobs {
		jobStatuses[i] = JobStatus{
			Name:     j.name,
			Schedule: j.label,
			LastRun:  "never",
			Status:   "never",
		}
		wrapped := s.wrap(j.name, j.fn)
		_, err := c.AddFunc(j.cron, wrapped)
		if err != nil {
			logger.Log.Fatal("failed to register cron job",
				zap.String("job", j.name),
				zap.String("cron", j.cron),
				zap.Error(err),
			)
		}

		// Register the wrapped function so RunJobByName can invoke it.
		jobFnMu.Lock()
		jobFnRegistry[j.name] = wrapped
		jobFnMu.Unlock()
	}
	jobMu.Unlock()

	return s
}

// GetJobStatuses는 모든 등록된 잡의 상태 복사본을 반환합니다.
func GetJobStatuses() []JobStatus {
	jobMu.Lock()
	defer jobMu.Unlock()
	result := make([]JobStatus, len(jobStatuses))
	copy(result, jobStatuses)
	return result
}

// RunJobByName은 이름을 통해 등록된 잡을 수동으로 실행합니다.
func RunJobByName(name string) error {
	jobMu.Lock()
	var found bool
	for _, js := range jobStatuses {
		if js.Name == name {
			found = true
			break
		}
	}
	jobMu.Unlock()

	if !found {
		return fmt.Errorf("job %q not found", name)
	}

	// We keep a package-level registry so RunJobByName can invoke the wrapped
	// function without holding a reference to Scheduler internals.
	jobFnMu.Lock()
	fn, ok := jobFnRegistry[name]
	jobFnMu.Unlock()
	if !ok {
		return fmt.Errorf("job %q has no registered handler", name)
	}

	go fn()
	return nil
}

// wrap은 상태 추적 및 패닉 복구 기능을 포함하도록 작업 함수를 래핑합니다.
func (s *Scheduler) wrap(name string, fn func()) func() {
	return func() {
		defer func() {
			if r := recover(); r != nil {
				logger.Log.Error("cron job panicked", zap.String("job", name), zap.Any("recover", r))
				jobMu.Lock()
				for i := range jobStatuses {
					if jobStatuses[i].Name == name {
						jobStatuses[i].Status = "error"
						jobStatuses[i].LastRun = time.Now().Format(time.RFC3339)
					}
				}
				jobMu.Unlock()
			}
		}()

		fn()

		jobMu.Lock()
		for i := range jobStatuses {
			if jobStatuses[i].Name == name {
				jobStatuses[i].Status = "ok"
				jobStatuses[i].LastRun = time.Now().Format(time.RFC3339)
			}
		}
		jobMu.Unlock()
	}
}

// Start는 크론 스케줄러를 시작합니다.
func (s *Scheduler) Start() {
	logger.Log.Info("Cron scheduler started")
	s.c.Start()
}

// Stop은 크론 스케줄러를 정상적으로 중단합니다.
func (s *Scheduler) Stop() {
	logger.Log.Info("Cron scheduler stopping")
	s.c.Stop()
}

// cleanupIdempotencyKeys는 만료된 멱등성 키를 정리합니다.
func (s *Scheduler) cleanupIdempotencyKeys() {
	middleware.CleanupExpiredKeys(s.db)
}

// cleanupExpiredRefreshTokens는 만료된 리프레시 토큰을 DB에서 삭제합니다.
// 6시간마다 실행되어 만료 후 24시간이 지난 토큰을 정리합니다.
func (s *Scheduler) cleanupExpiredRefreshTokens() {
	cutoff := time.Now().Add(-24 * time.Hour)
	result := s.db.Where("ExpiresAt < ?", cutoff).Delete(&domain.RefreshToken{})
	if result.Error != nil {
		logger.Log.Error("Failed to clean up expired refresh tokens", zap.Error(result.Error))
		return
	}
	if result.RowsAffected > 0 {
		logger.Log.Info("Cleaned up expired refresh tokens", zap.Int64("count", result.RowsAffected))
	}
}

// cleanupKycSessions는 매시간 만료된 KYC 인증 세션을 제거합니다.
func (s *Scheduler) cleanupKycSessions() {
	result := s.db.Where("ExpiresAt < ?", time.Now()).Delete(&domain.KycVerifySession{})
	if result.Error != nil {
		logger.Log.Error("Failed to clean up expired KYC sessions", zap.Error(result.Error))
		return
	}
	if result.RowsAffected > 0 {
		logger.Log.Info("Cleaned up expired KYC sessions", zap.Int64("count", result.RowsAffected))
	}
}

// expireVouchers는 만료 시간이 지난 AVAILABLE 상태의 바우처를 EXPIRED 상태로 변경합니다.
// 매일 01:00에 실행됩니다.
func (s *Scheduler) expireVouchers() {
	result := s.db.Model(&domain.VoucherCode{}).
		Where("Status = ? AND ExpiredAt < ?", "AVAILABLE", time.Now()).
		Update("Status", "EXPIRED")
	if result.Error != nil {
		logger.Log.Error("Failed to expire vouchers", zap.Error(result.Error))
		return
	}
	if result.RowsAffected > 0 {
		logger.Log.Info("Expired vouchers", zap.Int64("count", result.RowsAffected))
	}
}

// expireGifts는 만료 시간이 지난 SENT 상태의 선물을 EXPIRED 상태로 전환합니다.
// 매일 02:00에 실행됩니다.
func (s *Scheduler) expireGifts() {
	result := s.db.Model(&domain.Gift{}).
		Where("Status = ? AND ExpiresAt < ?", "SENT", time.Now()).
		Update("Status", "EXPIRED")
	if result.Error != nil {
		logger.Log.Error("Failed to expire gifts", zap.Error(result.Error))
		return
	}
	if result.RowsAffected > 0 {
		logger.Log.Info("Expired gifts", zap.Int64("count", result.RowsAffected))
	}
}

// archiveAuditLogs는 자정에 두 단계의 감사 로그 유지보수를 수행합니다.
// - 90일보다 오래된 로그는 IsArchived를 true로 설정하여 아카이브합니다.
// - 180일보다 오래된 아카이브된 로그를 영구 삭제합니다.
func (s *Scheduler) archiveAuditLogs() {
	archiveBefore := time.Now().AddDate(0, 0, -s.archiveDays)
	deleteBefore := time.Now().AddDate(0, 0, -s.deleteDays)

	// Archive old logs
	archiveResult := s.db.Model(&domain.AuditLog{}).
		Where("IsArchived = ? AND CreatedAt < ?", false, archiveBefore).
		Update("IsArchived", true)
	if archiveResult.Error != nil {
		logger.Log.Error("Failed to archive audit logs", zap.Error(archiveResult.Error))
	}

	// Permanently delete very old logs that have been archived.
	// Skipping non-archived rows guards against data loss if the archive
	// step above failed (e.g. a previous run returned a DB error).
	deleteResult := s.db.Where("IsArchived = ? AND CreatedAt < ?", true, deleteBefore).Delete(&domain.AuditLog{})
	if deleteResult.Error != nil {
		logger.Log.Error("Failed to delete old audit logs", zap.Error(deleteResult.Error))
	}

	if archiveResult.RowsAffected > 0 || deleteResult.RowsAffected > 0 {
		logger.Log.Info("Audit log maintenance",
			zap.Int64("archived", archiveResult.RowsAffected),
			zap.Int64("deleted", deleteResult.RowsAffected),
		)
	}
}

// checkStockAlerts는 30분마다 재고 부족 상품을 점검하고 경고 로그 및 텔레그램 알림을 발송합니다.
// MinStockAlert > 0 인 상품 중 AVAILABLE 바우처 수가 MinStockAlert 미만인 상품을 탐지합니다.
// 중복 알림 억제는 Products.LastAlertSentAt 컬럼에 지속적으로 저장되어 재시작 후에도 유지됩니다.
// 동일 상품에 대해 2시간 이내 중복 알림은 억제됩니다.
func (s *Scheduler) checkStockAlerts() {
	type stockAlert struct {
		ProductID   int
		ProductName string
		BrandCode   string
		Available   int64
		Threshold   int
	}

	suppressBefore := time.Now().Add(-2 * time.Hour)

	var alerts []stockAlert
	err := s.db.Raw(`
		SELECT p.Id as ProductID, p.Name as ProductName, p.BrandCode,
			p.MinStockAlert as Threshold,
			COUNT(CASE WHEN v.Status = 'AVAILABLE' THEN 1 END) as Available
		FROM Products p
		LEFT JOIN VoucherCodes v ON v.ProductId = p.Id
		WHERE p.MinStockAlert > 0 AND p.DeletedAt IS NULL
		  AND (p.LastAlertSentAt IS NULL OR p.LastAlertSentAt < ?)
		GROUP BY p.Id, p.Name, p.BrandCode, p.MinStockAlert
		HAVING COUNT(CASE WHEN v.Status = 'AVAILABLE' THEN 1 END) < p.MinStockAlert
		ORDER BY Available ASC
	`, suppressBefore).Scan(&alerts).Error

	if err != nil {
		logger.Log.Error("Failed to check stock alerts", zap.Error(err))
		return
	}

	if len(alerts) == 0 {
		return
	}

	// 경고 로그 기록
	for _, a := range alerts {
		logger.Log.Warn("Low stock alert",
			zap.Int("productId", a.ProductID),
			zap.String("productName", a.ProductName),
			zap.String("brandCode", a.BrandCode),
			zap.Int64("available", a.Available),
			zap.Int("threshold", a.Threshold),
		)
	}

	// 텔레그램 알림 발송
	var msg strings.Builder
	msg.WriteString(fmt.Sprintf("📦 <b>재고 부족 알림</b> (%d건)\n\n", len(alerts)))
	for _, a := range alerts {
		msg.WriteString(fmt.Sprintf("• <b>%s</b> (%s)\n  재고: %d / 기준: %d\n",
			a.ProductName, a.BrandCode, a.Available, a.Threshold))
	}
	telegram.SendAlert(telegram.GetGlobalToken(), telegram.GetGlobalChatID(), msg.String())

	// LastAlertSentAt을 DB에 기록하여 재시작 후에도 억제 상태를 유지합니다.
	productIDs := make([]int, len(alerts))
	for i, a := range alerts {
		productIDs[i] = a.ProductID
	}
	now := time.Now()
	if err := s.db.Model(&domain.Product{}).Where("Id IN ?", productIDs).Update("LastAlertSentAt", now).Error; err != nil {
		logger.Log.Error("Failed to update LastAlertSentAt", zap.Error(err))
	}

	logger.Log.Info("Stock alert check completed", zap.Int("alertCount", len(alerts)))
}

// SetSettlementService는 정산 배치 작업을 위한 서비스를 주입합니다.
// Scheduler 생성 후 main.go에서 호출하여 서비스 의존성을 설정합니다.
func (s *Scheduler) SetSettlementService(svc SettlementBatchRunner) {
	s.settlementSvc = svc
}

// SetFulfillmentService는 외부 API 발급 파이프라인 서비스를 주입합니다.
func (s *Scheduler) SetFulfillmentService(svc FulfillmentRunner) {
	s.fulfillmentSvc = svc
}

// weeklySettlement는 매주 월요일 09:00에 주간 배치 정산을 실행합니다.
func (s *Scheduler) weeklySettlement() {
	if s.settlementSvc == nil {
		logger.Log.Warn("주간 정산 배치 스킵: SettlementService가 설정되지 않았습니다")
		return
	}
	if err := s.settlementSvc.CreateBatchSettlement("WEEKLY"); err != nil {
		logger.Log.Error("주간 정산 배치 실패", zap.Error(err))
	}
}

// monthlySettlement는 매월 1일 09:00에 월간 배치 정산을 실행합니다.
func (s *Scheduler) monthlySettlement() {
	if s.settlementSvc == nil {
		logger.Log.Warn("월간 정산 배치 스킵: SettlementService가 설정되지 않았습니다")
		return
	}
	if err := s.settlementSvc.CreateBatchSettlement("MONTHLY"); err != nil {
		logger.Log.Error("월간 정산 배치 실패", zap.Error(err))
	}
}

// partnerPostManagement는 매일 03:00에 파트너 사후 관리를 실행합니다.
// 클레임 임계값 초과, PIN 불량률 초과를 감지합니다.
func (s *Scheduler) partnerPostManagement() {
	if s.settlementSvc == nil {
		logger.Log.Warn("파트너 사후 관리 스킵: SettlementService가 설정되지 않았습니다")
		return
	}
	s.settlementSvc.CheckPartnerPostManagement()
}

// processFulfillment는 PAID 상태의 API 발급 주문을 처리합니다.
func (s *Scheduler) processFulfillment() {
	if s.fulfillmentSvc == nil {
		return
	}
	s.fulfillmentSvc.ProcessPendingOrders()
}

// SetOutboxService는 아웃박스 릴레이 서비스를 주입합니다.
func (s *Scheduler) SetOutboxService(svc OutboxRunner) {
	s.outboxSvc = svc
}

func (s *Scheduler) processOutbox() {
	if s.outboxSvc == nil {
		return
	}
	s.outboxSvc.ProcessPending()
}

// SetOrderCleanupService는 만료 주문 자동 취소 서비스를 주입합니다.
func (s *Scheduler) SetOrderCleanupService(svc OrderCleanupRunner) {
	s.orderCleanupSvc = svc
}

func (s *Scheduler) cancelExpiredOrders() {
	if s.orderCleanupSvc == nil {
		return
	}
	s.orderCleanupSvc.CancelExpiredOrders()
}

// SetCashReceiptService는 현금영수증 재시도 서비스를 주입합니다.
func (s *Scheduler) SetCashReceiptService(svc CashReceiptRetryRunner) {
	s.cashReceiptSvc = svc
}

func (s *Scheduler) retryCashReceipts() {
	if s.cashReceiptSvc == nil {
		return
	}
	s.cashReceiptSvc.RetryFailedReceipts()
}

func (s *Scheduler) syncCashReceipts() {
	if s.cashReceiptSvc == nil {
		return
	}
	s.cashReceiptSvc.SyncPendingReceipts()
}

// cleanupAbandonedCarts는 7일 이상 방치된 장바구니 항목을 삭제합니다.
func (s *Scheduler) cleanupAbandonedCarts() {
	cutoff := time.Now().AddDate(0, 0, -7)
	result := s.db.Where("UpdatedAt < ?", cutoff).Delete(&domain.CartItem{})
	if result.Error != nil {
		logger.Log.Error("Failed to cleanup abandoned carts", zap.Error(result.Error))
		return
	}
	if result.RowsAffected > 0 {
		logger.Log.Info("Cleaned up abandoned carts", zap.Int64("count", result.RowsAffected))
	}
}
