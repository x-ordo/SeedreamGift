// Package monitor는 서버의 상태 지표(CPU, 메모리, 요청 수 등)를 수집하고 모니터링하는 기능을 제공합니다.
package monitor

import (
	"runtime"
	"sync"
	"sync/atomic"
	"time"

	"github.com/shirou/gopsutil/v3/cpu"
	"github.com/shirou/gopsutil/v3/mem"
)

var (
	startTime      time.Time
	requestCount   int64
	errorCount     int64
	blacklistedIPs sync.Map
)

// 히스토리 상태 - historyMu에 의해 보호됩니다.
// 기본값은 constants.go의 값과 일치하며, StartHistoryCollector를 호출하기 전에 Configure를 호출하십시오.
var (
	maxHistory      = 60
	collectInterval = 3 * time.Second
)

// Configure는 지표 수집 주기와 히스토리 버퍼 크기를 설정합니다.
func Configure(historyPoints int, interval time.Duration) {
	maxHistory = historyPoints
	collectInterval = interval
}

var (
	history      []HistoryPoint
	historyMu    sync.Mutex
	prevReqCount int64
	prevErrCount int64
	prevTime     time.Time
)

func init() {
	startTime = time.Now()
	prevTime = startTime
}

// Stats는 시스템 및 애플리케이션의 현재 메트릭 정보를 담습니다.
type Stats struct {
	Uptime            string  `json:"uptime"`
	CPUUsage          float64 `json:"cpuUsage"`
	MemoryUsage       uint64  `json:"memoryUsage"`       // Go 프로세스 힙 (MB)
	SystemMemoryUsage uint64  `json:"systemMemoryUsage"` // 서버 전체 메모리 (MB)
	GoroutineCount    int     `json:"goroutineCount"`
	RequestRate       float64 `json:"requestRate"`
	ErrorRate         float64 `json:"errorRate"`
	DBConnections     int     `json:"dbConnections"`
}

// HistoryPoint는 대시보드 차트용 메트릭 스냅샷입니다.
type HistoryPoint struct {
	Timestamp   int64   `json:"timestamp"` // Unix seconds
	CPUUsage    float64 `json:"cpuUsage"`
	MemoryUsage uint64  `json:"memoryUsage"`
	Goroutines  int     `json:"goroutines"`
	RequestRate float64 `json:"requestRate"`
	ErrorRate   float64 `json:"errorRate"`
}

// GetUptime은 서버 시작 이후 경과 시간을 반환합니다.
func GetUptime() string {
	return time.Since(startTime).String()
}

// GetCPUUsage는 현재 CPU 사용률을 백분율로 반환합니다.
func GetCPUUsage() float64 {
	percentages, _ := cpu.Percent(0, false)
	if len(percentages) > 0 {
		return percentages[0]
	}
	return 0
}

// GetMemoryUsage는 현재 Go 프로세스의 메모리 사용량을 MB 단위로 반환합니다.
func GetMemoryUsage() uint64 {
	var m runtime.MemStats
	runtime.ReadMemStats(&m)
	return m.Alloc / 1024 / 1024 // Go 힙 메모리 (MB)
}

// GetSystemMemoryUsage는 서버 전체 메모리 사용량을 MB 단위로 반환합니다.
func GetSystemMemoryUsage() uint64 {
	v, err := mem.VirtualMemory()
	if err != nil || v == nil {
		return 0
	}
	return v.Used / 1024 / 1024
}

// RecordRequest는 요청 및 에러 발생 여부를 기록합니다.
func RecordRequest(isError bool) {
	atomic.AddInt64(&requestCount, 1)
	if isError {
		atomic.AddInt64(&errorCount, 1)
	}
}

// GetStats는 모든 지표를 포함한 종합 통계 정보를 반환합니다.
func GetStats() Stats {
	duration := time.Since(startTime).Seconds()
	rc := atomic.LoadInt64(&requestCount)
	ec := atomic.LoadInt64(&errorCount)
	reqRate := float64(rc) / duration
	errRate := 0.0
	if rc > 0 {
		errRate = float64(ec) / float64(rc) * 100
	}

	return Stats{
		Uptime:            GetUptime(),
		CPUUsage:          GetCPUUsage(),
		MemoryUsage:       GetMemoryUsage(),       // Go 프로세스만
		SystemMemoryUsage: GetSystemMemoryUsage(), // 서버 전체
		GoroutineCount:    runtime.NumGoroutine(),
		RequestRate:       reqRate,
		ErrorRate:         errRate,
		DBConnections:     0,
	}
}

// ─── IP 블랙리스트 ───

// AddIPToBlacklist는 특정 IP를 차단 목록에 추가합니다.
func AddIPToBlacklist(ip string) {
	blacklistedIPs.Store(ip, true)
}

// RemoveIPFromBlacklist는 차단 목록에서 특정 IP를 제거합니다.
func RemoveIPFromBlacklist(ip string) {
	blacklistedIPs.Delete(ip)
}

// IsIPBlacklisted는 특정 IP가 차단된 상태인지 확인합니다.
func IsIPBlacklisted(ip string) bool {
	_, ok := blacklistedIPs.Load(ip)
	return ok
}

// GetBlockedIPs는 현재 차단된 모든 IP 목록을 반환합니다.
func GetBlockedIPs() []string {
	ips := make([]string, 0)
	blacklistedIPs.Range(func(key, _ any) bool {
		if ip, ok := key.(string); ok {
			ips = append(ips, ip)
		}
		return true
	})
	return ips
}

// ─── 침해 시도 자동 차단 ───

// threatStrikeLimit는 자동 차단까지의 침해 시도 횟수입니다.
const threatStrikeLimit = 5

// threatEntry는 IP별 침해 시도 카운터입니다.
type threatEntry struct {
	count   int
	firstAt time.Time
	lastAt  time.Time
}

var threatStrikes sync.Map // map[string]*threatEntry

// OnThreatDetected는 침해 행위 탐지 시 호출됩니다 (없는 스캐닝 경로 접속하는 경우 등).
// threatStrikeLimit 초과 시 자동 블랙리스트 + 콜백 호출.
// 콜백(onAutoBlock)은 텔레그램 알림 등에 사용됩니다.
// OnAutoBlock은 IP가 자동 차단될 때 호출되는 콜백입니다 (텔레그램 알림, DB 저장 등).
// main.go에서 주입합니다.
var OnAutoBlock func(ip string, strikes int)

func RecordThreatStrike(ip string) bool {
	val, _ := threatStrikes.LoadOrStore(ip, &threatEntry{firstAt: time.Now()})
	entry := val.(*threatEntry)
	entry.count++
	entry.lastAt = time.Now()

	if entry.count >= threatStrikeLimit && !IsIPBlacklisted(ip) {
		AddIPToBlacklist(ip)
		if OnAutoBlock != nil {
			go OnAutoBlock(ip, entry.count)
		}
		return true // 차단됨
	}
	return false
}

// CleanupThreatStrikes는 1시간 이상 지난 침해 기록을 정리합니다.
func CleanupThreatStrikes() {
	cutoff := time.Now().Add(-1 * time.Hour)
	threatStrikes.Range(func(key, val any) bool {
		entry := val.(*threatEntry)
		if entry.lastAt.Before(cutoff) {
			threatStrikes.Delete(key)
		}
		return true
	})
}

// RecordHistory는 현재 시점의 메트릭 스냅샷을 히스토리 버퍼에 기록합니다.
func RecordHistory() {
	// Collect OS syscall values outside the lock to avoid blocking other
	// goroutines that need historyMu (e.g. GetHistory).
	now := time.Now()
	cpuUsage := GetCPUUsage()
	memUsage := GetMemoryUsage()
	goroutines := runtime.NumGoroutine()

	historyMu.Lock()
	defer historyMu.Unlock()

	elapsed := now.Sub(prevTime).Seconds()
	curReq := atomic.LoadInt64(&requestCount)
	curErr := atomic.LoadInt64(&errorCount)

	var reqRate, errRate float64
	if elapsed > 0 {
		delta := curReq - prevReqCount
		reqRate = float64(delta) / elapsed
	}
	if curReq-prevReqCount > 0 {
		errRate = float64(curErr-prevErrCount) / float64(curReq-prevReqCount) * 100
	}

	prevReqCount = curReq
	prevErrCount = curErr
	prevTime = now

	point := HistoryPoint{
		Timestamp:   now.Unix(),
		CPUUsage:    cpuUsage,
		MemoryUsage: memUsage,
		Goroutines:  goroutines,
		RequestRate: reqRate,
		ErrorRate:   errRate,
	}

	if len(history) >= maxHistory {
		copy(history, history[1:])
		history[len(history)-1] = point
	} else {
		history = append(history, point)
	}
}

// GetHistory는 히스토리 버퍼의 복사본을 반환합니다.
func GetHistory() []HistoryPoint {
	historyMu.Lock()
	defer historyMu.Unlock()
	result := make([]HistoryPoint, len(history))
	copy(result, history)
	return result
}

// StartHistoryCollector는 주기적으로 RecordHistory를 호출하는 백그라운드 고루틴을 실행합니다.
var (
	historyOnce sync.Once
	stopOnce    sync.Once
	historyStop chan struct{}
)

func StartHistoryCollector() {
	historyOnce.Do(func() {
		historyStop = make(chan struct{})
		go func() {
			ticker := time.NewTicker(collectInterval)
			defer ticker.Stop()
			for {
				select {
				case <-ticker.C:
					RecordHistory()
				case <-historyStop:
					return
				}
			}
		}()
	})
}

// StopHistoryCollector는 백그라운드 수집 고루틴을 중단합니다.
// 애플리케이션 종료 시 호출해야 합니다.
func StopHistoryCollector() {
	stopOnce.Do(func() {
		if historyStop != nil {
			close(historyStop)
		}
	})
}
