// Package workqueue는 제한된 고루틴 수로 백그라운드 작업을 처리하는 워커 풀 구현을 제공합니다.
// fire-and-forget 고루틴 남발을 방지하고, 큐 크기로 배압(backpressure)을 제어합니다.
package workqueue

import (
	"context"
	"fmt"
	"sync"
	"sync/atomic"
	"time"

	"go.uber.org/zap"
	"w-gift-server/pkg/logger"
)

// Job은 워커 풀에서 실행될 작업의 인터페이스입니다.
type Job interface {
	Execute() error
	Name() string
}

// WorkerPoolConfig는 워커 풀의 설정입니다.
type WorkerPoolConfig struct {
	Name      string
	Workers   int // 동시 워커 수 (기본 3)
	QueueSize int // 채널 버퍼 크기 (기본 100)
}

// WorkerPool은 제한된 고루틴 수로 Job을 처리하는 워커 풀입니다.
// 채널을 오케스트레이션에, atomic 카운터를 상태 추적에 사용합니다.
type WorkerPool struct {
	name      string
	workers   int // 워커 수 (NewWorkerPool에서 설정)
	jobCh     chan Job
	wg        sync.WaitGroup
	ctx       context.Context
	cancel    context.CancelFunc
	processed atomic.Int64
	failed    atomic.Int64
	closed    atomic.Bool // Shutdown 호출 후 Submit 차단
}

// NewWorkerPool은 새 워커 풀을 생성합니다. Start()를 호출해야 작동합니다.
func NewWorkerPool(cfg WorkerPoolConfig) *WorkerPool {
	workers := cfg.Workers
	if workers <= 0 {
		workers = 3
	}
	if cfg.QueueSize <= 0 {
		cfg.QueueSize = 100
	}

	ctx, cancel := context.WithCancel(context.Background())

	return &WorkerPool{
		name:    cfg.Name,
		workers: workers,
		jobCh:   make(chan Job, cfg.QueueSize),
		ctx:     ctx,
		cancel:  cancel,
	}
}

// Start는 NewWorkerPool에서 설정된 수의 워커 고루틴을 시작합니다.
func (wp *WorkerPool) Start() {
	for i := 0; i < wp.workers; i++ {
		wp.wg.Add(1)
		go wp.worker(i)
	}
	logger.Log.Info("WorkerPool 시작",
		zap.String("pool", wp.name),
		zap.Int("workers", wp.workers),
		zap.Int("queueSize", cap(wp.jobCh)),
	)
}

func (wp *WorkerPool) worker(id int) {
	defer wp.wg.Done()
	for {
		select {
		case <-wp.ctx.Done():
			// 셧다운 신호 수신 — 채널에 남은 작업을 모두 처리하고 종료
			for {
				select {
				case job, ok := <-wp.jobCh:
					if !ok {
						return
					}
					wp.executeJob(job)
				default:
					return
				}
			}
		case job, ok := <-wp.jobCh:
			if !ok {
				return
			}
			wp.executeJob(job)
		}
	}
}

func (wp *WorkerPool) executeJob(job Job) {
	defer func() {
		if r := recover(); r != nil {
			wp.failed.Add(1)
			logger.Log.Error("WorkerPool Job 패닉",
				zap.String("pool", wp.name),
				zap.String("job", job.Name()),
				zap.Any("panic", r),
			)
		}
	}()

	if err := job.Execute(); err != nil {
		wp.failed.Add(1)
		logger.Log.Warn("WorkerPool Job 실패",
			zap.String("pool", wp.name),
			zap.String("job", job.Name()),
			zap.Error(err),
		)
	} else {
		wp.processed.Add(1)
	}
}

// Submit은 작업을 큐에 추가합니다.
// 큐가 가득 차면 즉시 에러를 반환합니다 (블로킹하지 않음).
// 알림 발송 실패는 치명적이지 않으므로 호출자는 에러를 로그만 남기고 무시할 수 있습니다.
func (wp *WorkerPool) Submit(job Job) error {
	if wp.closed.Load() {
		return fmt.Errorf("workqueue(%s): 셧다운됨, job=%s 거부", wp.name, job.Name())
	}
	select {
	case wp.jobCh <- job:
		return nil
	default:
		wp.failed.Add(1)
		return fmt.Errorf("workqueue(%s): 큐가 가득 참 (cap=%d), job=%s 드롭", wp.name, cap(wp.jobCh), job.Name())
	}
}

// Shutdown은 워커 풀을 종료합니다.
// cancel()로 워커에게 셧다운을 알리고, timeout 내에 wg.Wait()을 기다립니다.
func (wp *WorkerPool) Shutdown(timeout time.Duration) {
	logger.Log.Info("WorkerPool 셧다운 시작",
		zap.String("pool", wp.name),
		zap.Int("pending", len(wp.jobCh)),
	)
	wp.closed.Store(true)
	wp.cancel()

	done := make(chan struct{})
	go func() {
		wp.wg.Wait()
		close(done)
	}()

	select {
	case <-done:
		logger.Log.Info("WorkerPool 셧다운 완료",
			zap.String("pool", wp.name),
			zap.Int64("processed", wp.processed.Load()),
			zap.Int64("failed", wp.failed.Load()),
		)
	case <-time.After(timeout):
		logger.Log.Warn("WorkerPool 셧다운 타임아웃",
			zap.String("pool", wp.name),
			zap.Int("remaining", len(wp.jobCh)),
		)
	}
}

// WorkerPoolStats는 모니터링용 통계를 담습니다.
type WorkerPoolStats struct {
	Name      string `json:"name"`
	QueueLen  int    `json:"queueLen"`
	QueueCap  int    `json:"queueCap"`
	Processed int64  `json:"processed"`
	Failed    int64  `json:"failed"`
}

// Stats는 현재 워커 풀의 통계를 반환합니다.
func (wp *WorkerPool) Stats() WorkerPoolStats {
	return WorkerPoolStats{
		Name:      wp.name,
		QueueLen:  len(wp.jobCh),
		QueueCap:  cap(wp.jobCh),
		Processed: wp.processed.Load(),
		Failed:    wp.failed.Load(),
	}
}
