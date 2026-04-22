// Package handlers는 HTTP 요청 및 응답 처리 로직을 제공합니다.
// HealthHandler는 데이터베이스 연결, 메모리 사용량, 고루틴 수, 가동 시간을 확인하는 헬스체크 엔드포인트를 노출합니다.
package handlers

import (
	"net/http"
	"runtime"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

var serverStartTime = time.Now()

// HealthHandler는 인프라 헬스체크 엔드포인트를 제공합니다.
type HealthHandler struct {
	db        *gorm.DB
	version   string
	buildTime string
}

// NewHealthHandler는 HealthHandler를 생성합니다.
func NewHealthHandler(db *gorm.DB, version, buildTime string) *HealthHandler {
	return &HealthHandler{db: db, version: version, buildTime: buildTime}
}

// Check는 시스템 헬스 상태를 확인합니다.
func (h *HealthHandler) Check(c *gin.Context) {
	status := "ok"
	statusCode := http.StatusOK
	details := make(map[string]any)

	// 1. Database
	sqlDB, err := h.db.DB()
	if err != nil {
		details["database"] = map[string]any{"status": "down", "error": err.Error()}
		status = "error"
		statusCode = http.StatusServiceUnavailable
	} else if pingErr := sqlDB.Ping(); pingErr != nil {
		details["database"] = map[string]any{"status": "down", "error": pingErr.Error()}
		status = "error"
		statusCode = http.StatusServiceUnavailable
	} else {
		dbStats := sqlDB.Stats()
		details["database"] = map[string]any{
			"status":          "up",
			"openConnections": dbStats.OpenConnections,
			"inUse":           dbStats.InUse,
			"idle":            dbStats.Idle,
			"maxOpen":         dbStats.MaxOpenConnections,
		}
	}

	// 2. Memory
	var m runtime.MemStats
	runtime.ReadMemStats(&m)
	heapMB := m.HeapAlloc / 1024 / 1024
	sysMB := m.Sys / 1024 / 1024
	memStatus := "up"
	if heapMB > 150 {
		memStatus = "warning"
		if status == "ok" {
			status = "degraded"
		}
	}
	details["memory"] = map[string]any{
		"status":     memStatus,
		"heapMB":     heapMB,
		"sysMB":      sysMB,
		"gcCount":    m.NumGC,
		"goroutines": runtime.NumGoroutine(),
	}

	// 3. Uptime
	details["uptime"] = time.Since(serverStartTime).Truncate(time.Second).String()
	details["version"] = h.version

	c.JSON(statusCode, gin.H{
		"status":  status,
		"details": details,
	})
}

// SystemInfo는 관리자용 서버 메타데이터를 반환합니다.
func (h *HealthHandler) SystemInfo(c *gin.Context) {
	var m runtime.MemStats
	runtime.ReadMemStats(&m)

	var dbInfo map[string]any
	if sqlDB, err := h.db.DB(); err == nil {
		stats := sqlDB.Stats()
		dbInfo = map[string]any{
			"openConnections": stats.OpenConnections,
			"inUse":           stats.InUse,
			"idle":            stats.Idle,
			"maxOpen":         stats.MaxOpenConnections,
			"waitCount":       stats.WaitCount,
			"waitDuration":    stats.WaitDuration.String(),
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"version":    h.version,
		"buildTime":  h.buildTime,
		"goVersion":  runtime.Version(),
		"os":         runtime.GOOS,
		"arch":       runtime.GOARCH,
		"cpus":       runtime.NumCPU(),
		"uptime":     time.Since(serverStartTime).Truncate(time.Second).String(),
		"goroutines": runtime.NumGoroutine(),
		"memory": gin.H{
			"heapMB":  m.HeapAlloc / 1024 / 1024,
			"sysMB":   m.Sys / 1024 / 1024,
			"gcCount": m.NumGC,
		},
		"database": dbInfo,
	})
}

// StockAlerts는 재고 부족 상품 목록을 반환합니다.
func (h *HealthHandler) StockAlerts(c *gin.Context) {
	type stockAlert struct {
		ProductID   int    `json:"productId"`
		ProductName string `json:"productName"`
		BrandCode   string `json:"brandCode"`
		Available   int64  `json:"available"`
		Threshold   int    `json:"threshold"`
	}

	var alerts []stockAlert
	h.db.Raw(`
		SELECT p.Id as ProductID, p.Name as ProductName, p.BrandCode,
			p.MinStockAlert as Threshold,
			COUNT(CASE WHEN v.Status = 'AVAILABLE' THEN 1 END) as Available
		FROM Products p
		LEFT JOIN VoucherCodes v ON v.ProductId = p.Id
		WHERE p.MinStockAlert > 0 AND p.DeletedAt IS NULL
		GROUP BY p.Id, p.Name, p.BrandCode, p.MinStockAlert
		HAVING COUNT(CASE WHEN v.Status = 'AVAILABLE' THEN 1 END) < p.MinStockAlert
		ORDER BY Available ASC
	`).Scan(&alerts)

	c.JSON(http.StatusOK, gin.H{
		"alerts": alerts,
		"count":  len(alerts),
	})
}
