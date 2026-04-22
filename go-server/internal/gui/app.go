// Package gui는 Wails 프레임워크를 사용한 서버 관리 콘솔 GUI 기능을 제공합니다.
package gui

import (
	"context"
	"fmt"
	"io"
	"net"
	"os"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"time"
	"seedream-gift-server/internal/cron"
	"seedream-gift-server/internal/domain"
	"seedream-gift-server/internal/infra"
	"seedream-gift-server/internal/monitor"
	"seedream-gift-server/pkg/logger"

	"github.com/spf13/viper"
	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"
	"go.uber.org/zap"
)

// AppVersion은 애플리케이션의 버전을 저장합니다.
var AppVersion = "dev"

// SetVersion은 빌드 시점에 지정된 버전을 주입합니다.
func SetVersion(v string) { AppVersion = v }

// App은 Wails 애플리케이션의 구조체이며 GUI 바인딩을 노출합니다.
type App struct {
	ctx context.Context
}

// NewApp은 새로운 App 인스턴스를 생성합니다.
func NewApp() *App {
	return &App{}
}

// Ctx는 Wails 컨텍스트를 반환합니다.
func (a *App) Ctx() context.Context {
	return a.ctx
}

// Startup은 애플리케이션이 시작될 때 Wails에 의해 호출됩니다.
func (a *App) Startup(ctx context.Context) {
	a.ctx = ctx
	monitor.StartHistoryCollector()
}

// DomReady는 프론트엔드 DOM이 준비되었을 때 호출됩니다.
func (a *App) DomReady(ctx context.Context) {
	wailsRuntime.EventsEmit(ctx, "server:version", AppVersion)
	logger.Log.Info("Wails DOM ready, version emitted", zap.String("version", AppVersion))
}

// Shutdown은 애플리케이션이 종료될 때 호출됩니다.
func (a *App) Shutdown(ctx context.Context) {
	logger.Log.Info("Application shutting down via Wails")
	monitor.StopHistoryCollector()
	if sqlDB, err := infra.DB.DB(); err == nil {
		sqlDB.Close()
	}
	logger.Log.Sync()
}

// GetDashboardStats는 서버 메트릭 통계를 반환합니다.
func (a *App) GetDashboardStats() monitor.Stats {
	stats := monitor.GetStats()

	// Update DB stats
	sqlDB, err := infra.DB.DB()
	if err == nil {
		stats.DBConnections = sqlDB.Stats().InUse
	}

	return stats
}

// ServerStatus는 서버의 런타임 정보(메모리, 고루틴 등)를 나타냅니다.
type ServerStatus struct {
	Version    string `json:"version"`
	GoVersion  string `json:"goVersion"`
	Goroutines int    `json:"goroutines"`
	HeapAlloc  uint64 `json:"heapAlloc"`
	HeapSys    uint64 `json:"heapSys"`
	TotalAlloc uint64 `json:"totalAlloc"`
	NumGC      uint32 `json:"numGC"`
}

// GetServerStatus는 런타임 시스템 정보를 반환합니다.
func (a *App) GetServerStatus() ServerStatus {
	var m runtime.MemStats
	runtime.ReadMemStats(&m)

	return ServerStatus{
		Version:    AppVersion,
		GoVersion:  runtime.Version(),
		Goroutines: runtime.NumGoroutine(),
		HeapAlloc:  m.HeapAlloc / 1024 / 1024,
		HeapSys:    m.HeapSys / 1024 / 1024,
		TotalAlloc: m.TotalAlloc / 1024 / 1024,
		NumGC:      m.NumGC,
	}
}

// ReadLogs는 로그 파일의 끝부분(최대 64KB)을 읽어 반환합니다.
// 1. 실행 파일 위치를 기준으로 'logs/api.log' 파일을 찾습니다.
// 2. 대용량 로그 파일 전체를 읽는 것을 방지하기 위해 파일의 끝부분(Tail)만 탐색(Seek)합니다.
// 3. 잘린 첫 번째 줄을 제거하여 항상 완전한 로그 라인부터 표시되도록 보정합니다.
// logType 파라미터는 향후 다중 로그 파일 지원을 위해 예약되어 있으나 현재는 사용되지 않습니다.
func (a *App) ReadLogs(logType string) (string, error) {
	// Go 서버는 단일 로그 파일(api.log)에 모든 레벨을 기록합니다.
	// logType은 현재 무시되며, 파일명은 고정값입니다.
	// 향후 logType을 사용할 경우 반드시 filepath.Base로 경로 순회 공격을 차단해야 합니다.
	// 예: logName = filepath.Base(logType); if logName == "" || logName == "." { return "", errors.New("invalid log name") }
	logName := "api.log"

	// 실행 파일의 절대 경로를 파악하여 로그 폴더 위치를 특정합니다.
	exePath, err := os.Executable()
	if err != nil {
		return "", fmt.Errorf("cannot determine exe path: %w", err)
	}
	exeDir := filepath.Dir(exePath)
	filename := filepath.Join(exeDir, "logs", logName)

	f, err := os.Open(filename)
	if err != nil {
		return "", err
	}
	defer f.Close()

	// 성능 최적화: 최대 64KB만 읽어옵니다. (약 1,000줄 분량)
	const maxTailBytes = 64 * 1024

	stat, err := f.Stat()
	if err != nil {
		return "", err
	}

	size := stat.Size()
	if size == 0 {
		return "", nil
	}

	readSize := size
	seeked := false
	if readSize > maxTailBytes {
		// 파일 크기가 64KB보다 크면 끝부분으로 이동(Seek)
		readSize = maxTailBytes
		seeked = true
		if _, err := f.Seek(size-maxTailBytes, io.SeekStart); err != nil {
			return "", err
		}
	}

	buf := make([]byte, readSize)
	n, err := io.ReadFull(f, buf)
	if err != nil && err != io.ErrUnexpectedEOF {
		return "", err
	}
	content := string(buf[:n])

	// 중간부터 읽었을 경우, 첫 번째 줄은 불완전할 수 있으므로 제거합니다.
	if seeked {
		if idx := strings.IndexByte(content, '\n'); idx >= 0 {
			content = content[idx+1:]
		}
	}

	return content, nil
}

// ReloadConfig는 애플리케이션 설정을 재로드합니다.
// 설정은 환경 변수에서 로드되므로 런타임 중 재로드가 지원되지 않습니다.
func (a *App) ReloadConfig() string {
	logger.Log.Info("Configuration reload requested from GUI (not supported at runtime)")
	return "설정 재로드는 서버 재시작이 필요합니다. NSSM 서비스를 재시작해주세요."
}

// BlockIP는 지정된 IP를 차단 목록에 추가합니다 (메모리 + DB 영속화).
func (a *App) BlockIP(ip string) string {
	ip = strings.TrimSpace(ip)
	if net.ParseIP(ip) == nil {
		return fmt.Sprintf("유효하지 않은 IP 주소: %s", ip)
	}
	monitor.AddIPToBlacklist(ip)
	infra.DB.Where("IpAddress = ?", ip).
		FirstOrCreate(&domain.IPBlacklistEntry{
			IpAddress: ip,
			Reason:    "GUI에서 수동 차단",
			Source:    "MANUAL",
		})
	logger.Log.Warn("IP blocked from GUI", zap.String("ip", ip))
	return fmt.Sprintf("IP %s has been blocked", ip)
}

// CopyToClipboard는 텍스트를 시스템 클립보드에 복사합니다.
func (a *App) CopyToClipboard(text string) error {
	return wailsRuntime.ClipboardSetText(a.ctx, text)
}

// SaveLogToFile은 로그 내용을 파일로 저장하기 위한 대화상자를 엽니다.
func (a *App) SaveLogToFile(content string) (string, error) {
	path, err := wailsRuntime.SaveFileDialog(a.ctx, wailsRuntime.SaveDialogOptions{
		Title:           "로그 저장",
		DefaultFilename: "server-log.txt",
		Filters: []wailsRuntime.FileFilter{
			{DisplayName: "텍스트 파일", Pattern: "*.txt;*.log"},
			{DisplayName: "모든 파일", Pattern: "*.*"},
		},
	})
	if err != nil {
		return "", err
	}
	if path == "" {
		return "", nil // 사용자가 취소
	}
	if err := os.WriteFile(path, []byte(content), 0644); err != nil {
		return "", err
	}
	return path, nil
}

// RestartServer는 서버 재시작이 필요함을 안내합니다.
// 실제 재시작은 NSSM 서비스 매니저에서 수행해야 합니다.
func (a *App) RestartServer() string {
	logger.Log.Info("Server restart requested from GUI (must use NSSM)")
	return "서버 재시작은 NSSM 서비스 매니저에서 수행해주세요."
}

// ShutdownServer는 서버를 정상적으로 종료합니다.
func (a *App) ShutdownServer() {
	logger.Log.Info("Server shutdown initiated from GUI")
	wailsRuntime.Quit(a.ctx)
}

// GetDashboardHistory는 차트용 메트릭 히스토리를 반환합니다.
func (a *App) GetDashboardHistory() []monitor.HistoryPoint {
	return monitor.GetHistory()
}

// BlockedIPInfo는 차단 IP의 상세 정보입니다.
type BlockedIPInfo struct {
	IpAddress string `json:"ipAddress"`
	Reason    string `json:"reason"`
	Source    string `json:"source"`
	CreatedAt string `json:"createdAt"`
}

// GetBlockedIPs는 현재 차단된 IP 목록을 반환합니다 (DB 상세 정보 포함).
func (a *App) GetBlockedIPs() []BlockedIPInfo {
	var entries []domain.IPBlacklistEntry
	infra.DB.Order("CreatedAt DESC").Find(&entries)

	// DB에 없지만 메모리에만 있는 IP도 포함
	memIPs := monitor.GetBlockedIPs()
	dbIPSet := make(map[string]bool, len(entries))
	result := make([]BlockedIPInfo, 0, len(entries)+len(memIPs))

	for _, e := range entries {
		dbIPSet[e.IpAddress] = true
		result = append(result, BlockedIPInfo{
			IpAddress: e.IpAddress,
			Reason:    e.Reason,
			Source:    e.Source,
			CreatedAt: e.CreatedAt.Format("2006-01-02 15:04"),
		})
	}

	// 메모리에만 있는 IP (런타임에 추가되었으나 DB 미저장)
	for _, ip := range memIPs {
		if !dbIPSet[ip] {
			result = append(result, BlockedIPInfo{
				IpAddress: ip,
				Reason:    "런타임 차단 (미영속화)",
				Source:    "RUNTIME",
				CreatedAt: "",
			})
		}
	}

	return result
}

// UnblockIP는 차단 목록에서 IP를 제거합니다 (메모리 + DB).
func (a *App) UnblockIP(ip string) string {
	monitor.RemoveIPFromBlacklist(ip)
	infra.DB.Where("IpAddress = ?", ip).Delete(&domain.IPBlacklistEntry{})
	logger.Log.Info("IP unblocked from GUI", zap.String("ip", ip))
	return fmt.Sprintf("IP %s has been unblocked", ip)
}

// SessionInfo는 GUI에 표시할 활성 사용자 세션 정보입니다.
type SessionInfo struct {
	ID        int    `json:"id"`
	UserID    int    `json:"userId"`
	UserEmail string `json:"userEmail"`
	UserAgent string `json:"userAgent"`
	IPAddress string `json:"ipAddress"`
	CreatedAt string `json:"createdAt"`
	ExpiresAt string `json:"expiresAt"`
}

// GetActiveSessions는 현재 활성화된 모든 세션을 조회합니다.
// OOM 방지를 위해 최신 100개 세션으로 제한합니다.
func (a *App) GetActiveSessions() []SessionInfo {
	var tokens []domain.RefreshToken
	infra.DB.Where("ExpiresAt > ?", time.Now()).
		Preload("User").
		Order("CreatedAt DESC").
		Limit(100).
		Find(&tokens)

	result := make([]SessionInfo, len(tokens))
	for i, t := range tokens {
		result[i] = SessionInfo{
			ID:        t.ID,
			UserID:    t.UserID,
			UserEmail: t.User.Email,
			UserAgent: derefStr(t.UserAgent),
			IPAddress: derefStr(t.IPAddress),
			CreatedAt: t.CreatedAt.Format(time.RFC3339),
			ExpiresAt: t.ExpiresAt.Format(time.RFC3339),
		}
	}
	return result
}

// KillSession은 특정 세션을 강제 종료합니다.
func (a *App) KillSession(id int) string {
	infra.DB.Delete(&domain.RefreshToken{}, id)
	return "Session terminated"
}

// KillAllSessions는 모든 활성 세션을 강제 종료합니다.
func (a *App) KillAllSessions() string {
	infra.DB.Where("ExpiresAt > ?", time.Now()).Delete(&domain.RefreshToken{})
	return "All sessions terminated"
}

// AuditLogEntry는 GUI에 표시할 감사 로그 항목입니다.
type AuditLogEntry struct {
	ID         int    `json:"id"`
	CreatedAt  string `json:"createdAt"`
	UserEmail  string `json:"userEmail"`
	Action     string `json:"action"`
	Resource   string `json:"resource"`
	ResourceID string `json:"resourceId"`
	Method     string `json:"method"`
	StatusCode int    `json:"statusCode"`
	IP         string `json:"ip"`
}

// GetAuditLogs는 페이지네이션된 감사 로그를 조회합니다.
func (a *App) GetAuditLogs(page int, limit int) map[string]any {
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 20
	}

	var total int64
	infra.DB.Model(&domain.AuditLog{}).Where("IsArchived = ?", false).Count(&total)

	var logs []domain.AuditLog
	infra.DB.Where("IsArchived = ?", false).
		Preload("User").
		Order("CreatedAt DESC").
		Offset((page - 1) * limit).
		Limit(limit).
		Find(&logs)

	entries := make([]AuditLogEntry, len(logs))
	for i, l := range logs {
		email := ""
		if l.User != nil {
			email = l.User.Email
		}
		entries[i] = AuditLogEntry{
			ID:         l.ID,
			CreatedAt:  l.CreatedAt.Format("2006-01-02 15:04:05"),
			UserEmail:  email,
			Action:     l.Action,
			Resource:   l.Resource,
			ResourceID: derefStr(l.ResourceID),
			Method:     derefStr(l.Method),
			StatusCode: derefInt(l.StatusCode),
			IP:         derefStr(l.IP),
		}
	}

	return map[string]any{
		"items": entries,
		"total": total,
		"page":  page,
		"limit": limit,
	}
}

// ExportAuditLogs는 감사 로그를 TSV 형식 텍스트로 반환합니다.
// 콘솔 복사 또는 파일 저장에 사용됩니다.
func (a *App) ExportAuditLogs(page int, limit int) string {
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 500 {
		limit = 100
	}

	var logs []domain.AuditLog
	infra.DB.Where("IsArchived = ?", false).
		Preload("User").
		Order("CreatedAt DESC").
		Offset((page - 1) * limit).
		Limit(limit).
		Find(&logs)

	var sb strings.Builder
	sb.WriteString("시간\t사용자\t동작\t리소스\t메서드\t상태\tIP\n")

	for _, l := range logs {
		email := ""
		if l.User != nil {
			email = l.User.Email
		}
		sb.WriteString(fmt.Sprintf("%s\t%s\t%s\t%s\t%s\t%d\t%s\n",
			l.CreatedAt.Format("2006-01-02 15:04:05"),
			email,
			l.Action,
			l.Resource,
			derefStr(l.Method),
			derefInt(l.StatusCode),
			derefStr(l.IP),
		))
	}
	return sb.String()
}

// SaveAuditLogsToFile은 감사 로그를 파일로 저장합니다.
func (a *App) SaveAuditLogsToFile(content string) (string, error) {
	ts := time.Now().Format("20060102-150405")
	path, err := wailsRuntime.SaveFileDialog(a.ctx, wailsRuntime.SaveDialogOptions{
		Title:           "감사 로그 저장",
		DefaultFilename: fmt.Sprintf("audit-log-%s.tsv", ts),
		Filters: []wailsRuntime.FileFilter{
			{DisplayName: "TSV 파일", Pattern: "*.tsv"},
			{DisplayName: "텍스트 파일", Pattern: "*.txt"},
			{DisplayName: "모든 파일", Pattern: "*.*"},
		},
	})
	if err != nil {
		return "", err
	}
	if path == "" {
		return "", nil
	}
	if err := os.WriteFile(path, []byte(content), 0644); err != nil {
		return "", err
	}
	logger.Log.Info("감사 로그 파일 저장", zap.String("path", path))
	return path, nil
}

// GetCronStatus는 모든 등록된 크론 잡의 상태를 조회합니다.
func (a *App) GetCronStatus() []cron.JobStatus {
	return cron.GetJobStatuses()
}

// RunCronJob은 특정 크론 잡을 수동으로 실행합니다.
func (a *App) RunCronJob(name string) string {
	name = strings.TrimSpace(name)
	if name == "" {
		return "잡 이름이 비어있습니다"
	}
	if err := cron.RunJobByName(name); err != nil {
		return fmt.Sprintf("실행 실패: %s", err.Error())
	}
	return fmt.Sprintf("'%s' 잡이 실행되었습니다", name)
}

// ════════════════════════════════════════════════════════════════
// 구매 한도 설정 (SiteConfig 기반)
// ════════════════════════════════════════════════════════════════

// LimitConfig는 GUI에 표시할 구매 한도 설정 구조체입니다.
type LimitConfig struct {
	PerOrder string `json:"perOrder"` // 1회 한도 (원)
	PerDay   string `json:"perDay"`   // 일일 한도 (원)
	PerMonth string `json:"perMonth"` // 월간 한도 (원)
	PerYear  string `json:"perYear"`  // 연간 한도 (원)
}

// GetPurchaseLimits는 현재 구매 한도 설정을 조회합니다.
func (a *App) GetPurchaseLimits() LimitConfig {
	defaults := map[string]string{
		"LIMIT_PER_ORDER": "500000",
		"LIMIT_PER_DAY":   "1000000",
		"LIMIT_PER_MONTH": "50000000",
		"LIMIT_PER_YEAR":  "200000000",
	}

	result := LimitConfig{}
	for key, defaultVal := range defaults {
		var cfg domain.SiteConfig
		if err := infra.DB.Where("[Key] = ?", key).First(&cfg).Error; err != nil {
			// 없으면 기본값 반환
			switch key {
			case "LIMIT_PER_ORDER":
				result.PerOrder = defaultVal
			case "LIMIT_PER_DAY":
				result.PerDay = defaultVal
			case "LIMIT_PER_MONTH":
				result.PerMonth = defaultVal
			case "LIMIT_PER_YEAR":
				result.PerYear = defaultVal
			}
		} else {
			switch key {
			case "LIMIT_PER_ORDER":
				result.PerOrder = cfg.Value
			case "LIMIT_PER_DAY":
				result.PerDay = cfg.Value
			case "LIMIT_PER_MONTH":
				result.PerMonth = cfg.Value
			case "LIMIT_PER_YEAR":
				result.PerYear = cfg.Value
			}
		}
	}
	return result
}

// SetPurchaseLimit는 구매 한도를 설정합니다. key: LIMIT_PER_ORDER|LIMIT_PER_DAY|LIMIT_PER_MONTH|LIMIT_PER_YEAR
func (a *App) SetPurchaseLimit(key string, value string) string {
	validKeys := map[string]string{
		"LIMIT_PER_ORDER": "1회 주문 한도",
		"LIMIT_PER_DAY":   "일일 주문 한도",
		"LIMIT_PER_MONTH": "월간 주문 한도",
		"LIMIT_PER_YEAR":  "연간 주문 한도",
	}

	desc, ok := validKeys[key]
	if !ok {
		return "유효하지 않은 한도 키: " + key
	}

	var cfg domain.SiteConfig
	err := infra.DB.Where("[Key] = ?", key).First(&cfg).Error
	if err != nil {
		// 존재하지 않으면 새로 생성
		cfg = domain.SiteConfig{
			Key:         key,
			Value:       value,
			Type:        "number",
			Description: &desc,
		}
		if err := infra.DB.Create(&cfg).Error; err != nil {
			return "생성 실패: " + err.Error()
		}
	} else {
		// 기존 값 업데이트
		infra.DB.Model(&cfg).Update("Value", value)
	}

	logger.Log.Info("Purchase limit updated from GUI",
		zap.String("key", key),
		zap.String("value", value),
	)

	method := "GUI"
	ip := "127.0.0.1"
	detail := fmt.Sprintf("key=%s, value=%s", key, value)
	infra.DB.Create(&domain.AuditLog{
		Action:   "UPDATE",
		Resource: "SetPurchaseLimit",
		Method:   &method,
		IP:       &ip,
		NewValue: &detail,
	})

	return fmt.Sprintf("%s이(가) %s원으로 설정되었습니다", desc, value)
}

// ════════════════════════════════════════════════════════════════
// 보안 설정 (SiteConfig 기반)
// ════════════════════════════════════════════════════════════════

// SecurityConfig는 GUI에 표시할 보안 설정 구조체입니다.
type SecurityConfig struct {
	WebAuthnEnabled     bool   `json:"webAuthnEnabled"`
	SessionTimeoutMin   int    `json:"sessionTimeoutMin"`
	IPWhitelistEnabled  bool   `json:"ipWhitelistEnabled"`
	AdminIPWhitelist    string `json:"adminIPWhitelist"` // comma-separated IPs
	MaxLoginAttempts    int    `json:"maxLoginAttempts"`
	LockDurationMinutes int    `json:"lockDurationMinutes"`
}

// GetSecurityConfig는 SiteConfig 테이블에서 보안 설정을 조회합니다.
func (a *App) GetSecurityConfig() SecurityConfig {
	defaults := map[string]string{
		"WEBAUTHN_ENABLED":        "false",
		"SESSION_TIMEOUT_MINUTES": "30",
		"IP_WHITELIST_ENABLED":    "false",
		"ADMIN_IP_WHITELIST":      "",
		"MAX_LOGIN_ATTEMPTS":      "5",
		"LOCK_DURATION_MINUTES":   "15",
	}

	values := make(map[string]string)
	for key, defaultVal := range defaults {
		var cfg domain.SiteConfig
		if err := infra.DB.Where("[Key] = ?", key).First(&cfg).Error; err != nil {
			values[key] = defaultVal
		} else {
			values[key] = cfg.Value
		}
	}

	sessionTimeout, _ := strconv.Atoi(values["SESSION_TIMEOUT_MINUTES"])
	maxAttempts, _ := strconv.Atoi(values["MAX_LOGIN_ATTEMPTS"])
	lockDuration, _ := strconv.Atoi(values["LOCK_DURATION_MINUTES"])

	return SecurityConfig{
		WebAuthnEnabled:     values["WEBAUTHN_ENABLED"] == "true",
		SessionTimeoutMin:   sessionTimeout,
		IPWhitelistEnabled:  values["IP_WHITELIST_ENABLED"] == "true",
		AdminIPWhitelist:    values["ADMIN_IP_WHITELIST"],
		MaxLoginAttempts:    maxAttempts,
		LockDurationMinutes: lockDuration,
	}
}

// SetSecurityConfig는 보안 설정을 SiteConfig에 저장합니다.
func (a *App) SetSecurityConfig(config SecurityConfig) string {
	entries := map[string]struct {
		value string
		desc  string
		typ   string
	}{
		"WEBAUTHN_ENABLED":        {value: strconv.FormatBool(config.WebAuthnEnabled), desc: "WebAuthn(Passkey) 활성화", typ: "boolean"},
		"SESSION_TIMEOUT_MINUTES": {value: strconv.Itoa(config.SessionTimeoutMin), desc: "세션 타임아웃 (분)", typ: "number"},
		"IP_WHITELIST_ENABLED":    {value: strconv.FormatBool(config.IPWhitelistEnabled), desc: "IP 화이트리스트 활성화", typ: "boolean"},
		"ADMIN_IP_WHITELIST":      {value: config.AdminIPWhitelist, desc: "관리자 허용 IP 목록", typ: "string"},
		"MAX_LOGIN_ATTEMPTS":      {value: strconv.Itoa(config.MaxLoginAttempts), desc: "최대 로그인 시도 횟수", typ: "number"},
		"LOCK_DURATION_MINUTES":   {value: strconv.Itoa(config.LockDurationMinutes), desc: "계정 잠금 시간 (분)", typ: "number"},
	}

	for key, entry := range entries {
		var cfg domain.SiteConfig
		desc := entry.desc
		if err := infra.DB.Where("[Key] = ?", key).First(&cfg).Error; err != nil {
			cfg = domain.SiteConfig{
				Key:         key,
				Value:       entry.value,
				Type:        entry.typ,
				Description: &desc,
			}
			if err := infra.DB.Create(&cfg).Error; err != nil {
				logger.Log.Error("보안 설정 생성 실패", zap.String("key", key), zap.Error(err))
				return "설정 저장 실패: " + err.Error()
			}
		} else {
			infra.DB.Model(&cfg).Update("Value", entry.value)
		}
	}

	logger.Log.Info("Security config updated from GUI")

	method := "GUI"
	ip := "127.0.0.1"
	detail := fmt.Sprintf("webAuthn=%v, sessionTimeout=%d, ipWhitelist=%v, maxAttempts=%d, lockDuration=%d",
		config.WebAuthnEnabled, config.SessionTimeoutMin, config.IPWhitelistEnabled,
		config.MaxLoginAttempts, config.LockDurationMinutes)
	infra.DB.Create(&domain.AuditLog{
		Action:   "UPDATE",
		Resource: "SetSecurityConfig",
		Method:   &method,
		IP:       &ip,
		NewValue: &detail,
	})

	return "보안 설정이 저장되었습니다."
}

// ════════════════════════════════════════════════════════════════
// 재고 부족 알림
// ════════════════════════════════════════════════════════════════

// StockAlert는 재고 부족 상품 정보를 표현합니다.
type StockAlert struct {
	ProductID   int    `json:"productId"`
	ProductName string `json:"productName"`
	BrandCode   string `json:"brandCode"`
	Available   int    `json:"available"`
	Threshold   int    `json:"threshold"`
}

// GetStockAlerts는 재고 부족 상품 목록을 조회합니다.
func (a *App) GetStockAlerts() []StockAlert {
	var results []StockAlert
	infra.DB.Raw(`
		SELECT p.Id as product_id, p.Name as product_name, p.BrandCode as brand_code,
			p.MinStockAlert as threshold,
			COUNT(CASE WHEN v.Status = 'AVAILABLE' THEN 1 END) as available
		FROM Products p
		LEFT JOIN VoucherCodes v ON v.ProductId = p.Id
		WHERE p.MinStockAlert > 0 AND p.DeletedAt IS NULL
		GROUP BY p.Id, p.Name, p.BrandCode, p.MinStockAlert
		HAVING COUNT(CASE WHEN v.Status = 'AVAILABLE' THEN 1 END) < p.MinStockAlert
		ORDER BY available ASC
	`).Scan(&results)

	if results == nil {
		results = []StockAlert{}
	}
	return results
}

// ════════════════════════════════════════════════════════════════
// 서버 환경 정보 (읽기 전용)
// ════════════════════════════════════════════════════════════════

// ServerEnvConfig는 현재 서버의 환경 설정 정보를 표현합니다.
type ServerEnvConfig struct {
	Port             int    `json:"port"`
	Environment      string `json:"environment"`
	CookieDomain     string `json:"cookieDomain"`
	CookieSecure     bool   `json:"cookieSecure"`
	FrontendURL      string `json:"frontendURL"`
	AdminURL         string `json:"adminURL"`
	JWTAccessExpiry  string `json:"jwtAccessExpiry"`
	JWTRefreshExpiry string `json:"jwtRefreshExpiry"`
	LogLevel         string `json:"logLevel"`
	TrustedProxyIPs  string `json:"trustedProxyIPs"`
}

// GetServerEnvConfig는 현재 서버의 환경 설정을 읽기 전용으로 반환합니다.
func (a *App) GetServerEnvConfig() ServerEnvConfig {
	return ServerEnvConfig{
		Port:             viper.GetInt("PORT"),
		Environment:      viper.GetString("GIN_MODE"),
		CookieDomain:     viper.GetString("COOKIE_DOMAIN"),
		CookieSecure:     viper.GetBool("COOKIE_SECURE"),
		FrontendURL:      viper.GetString("FRONTEND_URL"),
		AdminURL:         viper.GetString("ADMIN_URL"),
		JWTAccessExpiry:  viper.GetString("JWT_ACCESS_EXPIRY"),
		JWTRefreshExpiry: viper.GetString("JWT_REFRESH_EXPIRY"),
		LogLevel:         viper.GetString("LOG_LEVEL"),
		TrustedProxyIPs:  viper.GetString("TRUSTED_PROXY_IPS"),
	}
}

// derefStr safely dereferences a *string, returning "" for nil.
func derefStr(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}

// derefInt safely dereferences a *int, returning 0 for nil.
func derefInt(i *int) int {
	if i == nil {
		return 0
	}
	return *i
}
