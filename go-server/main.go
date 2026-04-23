// @title 씨드림기프트 API
// @version 1.0
// @description 백화점 상품권 판매 및 매입 플랫폼 API
// @host localhost:5140
// @BasePath /api/v1
// @securityDefinitions.apikey BearerAuth
// @in header
// @name Authorization
// @description Bearer {access_token}
// Package main은 씨드림기프트 API 서버의 진입점입니다.
// 이 패키지는 서버 환경 설정 로드, 로거 초기화, 데이터베이스 연결,
// 그리고 GUI(Wails) 또는 Headless 모드로 API 서버를 시작하는 역할을 담당합니다.
package main

import (
	"context"
	"embed"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"
	"seedream-gift-server/docs"
	"seedream-gift-server/internal/api/middleware"
	"seedream-gift-server/internal/app/services"
	"seedream-gift-server/internal/config"
	"seedream-gift-server/internal/cron"
	"seedream-gift-server/internal/domain"
	"seedream-gift-server/internal/gui"
	"seedream-gift-server/internal/infra"
	"seedream-gift-server/internal/infra/payment"
	"seedream-gift-server/internal/monitor"
	"seedream-gift-server/internal/routes"
	"seedream-gift-server/pkg/banner"
	"seedream-gift-server/pkg/logger"
	"seedream-gift-server/pkg/response"
	"seedream-gift-server/pkg/telegram"

	"github.com/gin-contrib/cors"
	"github.com/gin-contrib/gzip"
	"github.com/gin-gonic/gin"
	swaggerFiles "github.com/swaggo/files"
	ginSwagger "github.com/swaggo/gin-swagger"
	"github.com/wailsapp/wails/v2"
	wailsLogger "github.com/wailsapp/wails/v2/pkg/logger"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/options/windows"
	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"
	"go.uber.org/zap"
)

var (
	Version   = "2.1.0"
	BuildTime = "unknown"
)

//go:embed all:frontend/dist
var assets embed.FS

func main() {
	cfg, err := config.LoadConfig(".")
	if err != nil {
		fmt.Printf("Failed to load config: %v\n", err)
		os.Exit(1)
	}

	logger.InitLogger(cfg.LogPath, cfg.LogLevel, cfg.LogMaxSizeMB, cfg.LogMaxBackups, cfg.LogMaxAgeDays)
	defer logger.Log.Sync()

	banner.Print(Version, BuildTime)
	banner.PrintSummary(cfg.Port, gin.Mode(), "SQLite/SQLServer (GORM)")

	infra.InitDB(&cfg)

	// 신규 테이블 AutoMigrate
	if err := infra.DB.AutoMigrate(
		&domain.OutboxMessage{},
		&domain.LedgerEntry{},
		&domain.IdempotencyRecord{},
		&domain.OrderEvent{},
		&domain.IPBlacklistEntry{},
	); err != nil {
		logger.Log.Warn("AutoMigrate 경고 (신규 테이블)", zap.Error(err))
	}

	gui.SetVersion(Version)

	// ── Pre-flight checks ───
	logger.Log.Info("Pre-flight 검증 시작...")
	if sqlDB, err := infra.DB.DB(); err != nil {
		logger.Log.Fatal("Pre-flight 실패: DB 핸들 획득 불가", zap.Error(err))
	} else if err := sqlDB.Ping(); err != nil {
		logger.Log.Fatal("Pre-flight 실패: DB 연결 불가", zap.Error(err))
	} else {
		stats := sqlDB.Stats()
		logger.Log.Info("Pre-flight: DB 연결 OK",
			zap.Int("maxOpen", stats.MaxOpenConnections),
			zap.Int("open", stats.OpenConnections),
		)
	}
	if cfg.TelegramToken == "" || cfg.TelegramChatID == "" {
		logger.Log.Warn("Pre-flight: 텔레그램 미설정 — 운영 알림이 발송되지 않습니다")
	}
	if !cfg.SMTPEnabled || cfg.SMTPHost == "" {
		logger.Log.Warn("Pre-flight: SMTP 미설정 — 이메일 알림이 발송되지 않습니다")
	}
	logger.Log.Info("Pre-flight 검증 완료")

	headless := os.Getenv("HEADLESS")
	if headless == "true" || headless == "1" {
		logger.Log.Info("서버 시작",
			zap.String("mode", "headless"),
			zap.String("version", Version),
			zap.Int("port", cfg.Port),
			zap.String("ginMode", gin.Mode()),
		)
		startAPIServer(cfg)
		return
	}

	go startAPIServer(cfg)

	app := gui.NewApp()
	err = wails.Run(&options.App{
		Title:                    "씨드림기프트 서버 관리 콘솔",
		Width:                    1100,
		Height:                   780,
		MinWidth:                 800,
		MinHeight:                600,
		AssetServer:              &assetserver.Options{Assets: assets},
		BackgroundColour:         &options.RGBA{R: 27, G: 38, B: 54, A: 255},
		EnableDefaultContextMenu: false,
		SingleInstanceLock: &options.SingleInstanceLock{
			UniqueId: "seedream-gift-server-admin-console-2024",
			OnSecondInstanceLaunch: func(_ options.SecondInstanceData) {
				wailsRuntime.WindowUnminimise(app.Ctx())
				wailsRuntime.Show(app.Ctx())
			},
		},
		Windows: &windows.Options{
			Theme:                windows.SystemDefault,
			DisablePinchZoom:     true,
			WebviewIsTransparent: false,
		},
		OnStartup:  app.Startup,
		OnDomReady: app.DomReady,
		OnShutdown: app.Shutdown,
		OnBeforeClose: func(ctx context.Context) (prevent bool) {
			dialog, err := wailsRuntime.MessageDialog(ctx, wailsRuntime.MessageDialogOptions{
				Type:          wailsRuntime.QuestionDialog,
				Title:         "서버 관리 콘솔 종료",
				Message:       "콘솔을 닫으면 API 서버도 함께 종료됩니다.\n계속하시겠습니까?",
				DefaultButton: "No",
				Buttons:       []string{"Yes", "No"},
			})
			if err != nil {
				return false
			}
			return dialog == "No"
		},
		Bind:               []any{app},
		LogLevel:           wailsLogger.INFO,
		LogLevelProduction: wailsLogger.ERROR,
	})
	if err != nil {
		logger.Log.Fatal("Wails application failed", zap.Error(err))
	}
}

// startAPIServer는 HTTP API 서버를 구성하고 시작합니다.
func startAPIServer(cfg config.Config) {
	// ─── 글로벌 설정 ───
	monitor.Configure(cfg.HistoryMaxPoints, cfg.HistoryCollectInterval)
	middleware.ConfigureRateLimits(cfg.LoginMaxFailures, cfg.LoginBlockDuration, cfg.TransactionMaxPerMin)
	middleware.StartCleanupRoutine()
	monitor.StartHistoryCollector()

	// ─── IP 블랙리스트 DB 영속화 ───
	// 서버 시작 시 DB에서 차단 IP 로드 (재시작 후에도 유지)
	var blockedEntries []domain.IPBlacklistEntry
	infra.DB.Find(&blockedEntries)
	for _, e := range blockedEntries {
		monitor.AddIPToBlacklist(e.IpAddress)
	}
	if len(blockedEntries) > 0 {
		logger.Log.Info("DB에서 차단 IP 로드 완료", zap.Int("count", len(blockedEntries)))
	}

	// 자동 차단 시 DB 저장 + 텔레그램 알림 콜백
	monitor.OnAutoBlock = func(ip string, strikes int) {
		reason := fmt.Sprintf("자동 차단: 침해 시도 %d회 누적", strikes)
		infra.DB.Where("IpAddress = ?", ip).
			FirstOrCreate(&domain.IPBlacklistEntry{
				IpAddress: ip,
				Reason:    reason,
				Source:    "AUTO",
			})
		telegram.NotifySecurity("IP 자동 차단",
			fmt.Sprintf("IP %s — 침해 시도 %d회 누적으로 자동 차단됨", ip, strikes), ip)
		logger.Log.Warn("IP 자동 차단",
			zap.String("ip", ip),
			zap.Int("strikes", strikes),
		)
	}

	// 결제 모듈
	// TODO: 실제 PG 연동 시 Mock 제거 필요 — 현재는 실제 상품권이 발급되지 않도록 AllowRealFulfillment=false로 보호
	var pp = payment.NewMockPaymentProvider()
	if gin.Mode() == gin.ReleaseMode {
		logger.Log.Warn("WARNING: Mock payment provider active in RELEASE mode — 실제 PG 연동이 완료되기 전까지 실제 결제가 처리되지 않습니다. AllowRealFulfillment=false 설정을 확인하세요.",
			zap.String("provider", "MockPaymentProvider"),
			zap.Bool("allowRealFulfillment", cfg.AllowRealFulfillment),
		)
	}

	// 텔레그램 알림
	response.SetTelegramConfig(cfg.TelegramToken, cfg.TelegramChatID)
	telegram.SetConfig(cfg.TelegramToken, cfg.TelegramChatID)

	// ─── DI: 모든 서비스 및 핸들러 초기화 ───
	h := routes.NewHandlers(infra.DB, &cfg, pp, Version, BuildTime)

	// ─── Gin 라우터 ───
	if cfg.GinMode == "release" {
		gin.SetMode(gin.ReleaseMode)
	}
	if gin.Mode() != gin.ReleaseMode {
		logger.Log.Warn("서버가 릴리즈 모드가 아닙니다. 프로덕션 환경에서는 GIN_MODE=release를 설정하세요.",
			zap.String("currentMode", gin.Mode()))
	}
	r := gin.New()
	r.Use(middleware.RequestLogger())
	r.Use(gin.CustomRecovery(func(c *gin.Context, recovered any) {
		logger.Log.Error(fmt.Sprintf("PANIC: %v", recovered),
			zap.String("path", c.Request.URL.Path),
			zap.String("method", c.Request.Method),
			zap.Stack("stack"),
		)
		response.InternalServerError(c, "internal server error")
	}))

	// Trusted proxies & Cloudflare
	// Cloudflare 환경: CF-Connecting-IP 헤더에서 실제 클라이언트 IP를 추출
	r.TrustedPlatform = gin.PlatformCloudflare
	r.ForwardedByClientIP = true
	trustedProxies := []string{"127.0.0.1"}
	if cfg.TrustedProxyIPs != "" {
		for _, ip := range strings.Split(cfg.TrustedProxyIPs, ",") {
			if t := strings.TrimSpace(ip); t != "" {
				trustedProxies = append(trustedProxies, t)
			}
		}
	}
	_ = r.SetTrustedProxies(trustedProxies)

	// ─── 미들웨어 스택 ───
	r.Use(middleware.BotBlocker())
	r.Use(middleware.SecurityHeaders(cfg.APIDomain))
	r.Use(middleware.TraceID())
	r.Use(middleware.HPPGuard())
	r.Use(middleware.MaxBodySize(cfg.MaxRequestBodyBytes))
	r.Use(gzip.Gzip(gzip.DefaultCompression))
	r.Use(buildCORS(cfg))
	r.Use(middleware.IPBlacklist())
	r.Use(middleware.RateLimiter("100-M"))
	r.Use(middleware.AuditMiddleware(infra.DB))
	r.Use(func(c *gin.Context) { c.Next(); monitor.RecordRequest(c.Writer.Status() >= 400) })

	// ─── 유틸리티 엔드포인트 ───
	docs.SwaggerInfo.Host = fmt.Sprintf("localhost:%d", cfg.Port)
	r.GET("/docs/*any", middleware.SwaggerProductionGuard(), ginSwagger.WrapHandler(swaggerFiles.Handler))
	r.GET("/health", h.Health.Check)
	r.GET("/sitemap.xml", sitemapHandler(cfg))

	// Seedream 웹훅 수신 (인증 없음 — HMAC 으로만 검증. /api/v1/ 밖에 위치)
	r.POST("/webhook/seedream", h.SeedreamWebhook.Receive)

	// ─── API v1 라우트 (모듈식) ───
	api := r.Group("/api/v1")
	api.Use(middleware.NoCacheAPI())
	routes.Register(api, &cfg, h, infra.DB)

	// SPA fallback
	r.Static("/assets", "./public/assets")
	r.NoRoute(func(c *gin.Context) {
		if strings.HasPrefix(c.Request.URL.Path, "/api/") {
			response.NotFound(c, "API endpoint not found")
			return
		}
		c.File("./public/index.html")
	})

	// ─── 크론잡 + Graceful Shutdown ───
	scheduler := cron.New(infra.DB, cfg.AuditArchiveDays, cfg.AuditDeleteDays)
	// 정산 서비스를 크론 스케줄러에 주입 (주간/월간 배치, 사후 관리용)
	configProviderForCron := services.NewCachedConfigProvider(infra.DB, 5*time.Minute)
	settlementSvcForCron := services.NewSettlementService(infra.DB, configProviderForCron)
	scheduler.SetSettlementService(settlementSvcForCron)
	scheduler.SetFulfillmentService(h.Fulfillment)
	// [비활성화] 유가증권은 현금영수증 발급 대상 아님 (부가가치세법 시행령 제73조)
	// scheduler.SetCashReceiptService(h.CashReceiptSvc)
	scheduler.SetOrderCleanupService(h.OrderSvc)
	scheduler.SetOutboxService(services.NewOutboxService(infra.DB))
	scheduler.SetSeedreampayExpiryService(h.SeedreampaySvc)
	scheduler.Start()
	defer scheduler.Stop()

	srv := &http.Server{
		Addr:              fmt.Sprintf(":%d", cfg.Port),
		Handler:           r,
		ReadTimeout:       cfg.ServerReadTimeout,
		WriteTimeout:      cfg.ServerWriteTimeout,
		IdleTimeout:       cfg.ServerIdleTimeout,
		ReadHeaderTimeout: cfg.ServerReadHeaderTimeout,
		MaxHeaderBytes:    cfg.ServerMaxHeaderBytes,
	}

	go func() {
		logger.Log.Info("Server starting", zap.Int("port", cfg.Port), zap.String("version", Version))
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Log.Fatal("Server failed", zap.Error(err))
		}
	}()

	// os.Interrupt는 Windows에서 Ctrl+C와 Ctrl+Break를 모두 처리합니다.
	// syscall.SIGTERM은 프로세스 종료 시그널을 위해 유지합니다.
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	<-ctx.Done()
	stop()

	logger.Log.Info("Shutting down...")
	shutdownCtx, cancel := context.WithTimeout(context.Background(), cfg.ShutdownGracePeriod)
	defer cancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		logger.Log.Error("Forced shutdown", zap.Error(err))
	}

	// 워커 풀 셧다운 — HTTP 서버 종료 후 남은 큐 항목을 완료 처리
	if h.NotifyPool != nil {
		h.NotifyPool.Shutdown(5 * time.Second)
	}
	if h.AuditPool != nil {
		h.AuditPool.Shutdown(5 * time.Second)
	}
	if h.WebhookPool != nil {
		h.WebhookPool.Shutdown(10 * time.Second)
	}

	logger.Log.Info("Server exited")
}

// ─── Helpers ───

func buildCORS(cfg config.Config) gin.HandlerFunc {
	origins := []string{"http://localhost:5173", "http://localhost:5174", "http://127.0.0.1:5173"}
	if cfg.FrontendUrl != "" {
		origins = append(origins, cfg.FrontendUrl)
	}
	if cfg.AdminUrl != "" {
		origins = append(origins, cfg.AdminUrl)
	}
	if cfg.AdditionalCorsOrigins != "" {
		for _, o := range strings.Split(cfg.AdditionalCorsOrigins, ",") {
			if t := strings.TrimSpace(o); t != "" {
				origins = append(origins, t)
			}
		}
	}

	// 릴리즈 모드에서는 localhost/127.0.0.1 CORS 오리진을 차단합니다.
	if gin.Mode() == gin.ReleaseMode {
		filtered := make([]string, 0, len(origins))
		for _, o := range origins {
			if strings.Contains(o, "localhost") || strings.Contains(o, "127.0.0.1") {
				logger.Log.Warn("Blocking localhost CORS origin in release mode", zap.String("origin", o))
				continue
			}
			filtered = append(filtered, o)
		}
		origins = filtered
	}

	return cors.New(cors.Config{
		AllowOrigins:     origins,
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Accept", "Authorization", "X-Trace-Id"},
		ExposeHeaders:    []string{"Content-Length", "X-Trace-Id", "X-Response-Time", "ETag", "X-RateLimit-Limit", "X-RateLimit-Remaining", "X-RateLimit-Reset", "Retry-After"},
		AllowCredentials: true,
	})
}

func sitemapHandler(cfg config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		var brands []domain.Brand
		infra.DB.Where("IsActive = ?", true).Order("\"Order\" ASC").Find(&brands)

		baseURL := strings.TrimRight(cfg.FrontendUrl, "/")
		if baseURL == "" {
			baseURL = "https://seedreamgift.com"
		}
		today := time.Now().Format("2006-01-02")

		type u struct{ Loc, Pri, Freq string }
		pages := []u{
			{"/", "1.0", "daily"}, {"/products", "0.9", "daily"}, {"/trade-in", "0.8", "daily"},
			{"/live", "0.7", "hourly"}, {"/support", "0.5", "weekly"},
			{"/login", "0.3", "monthly"}, {"/register", "0.3", "monthly"},
		}

		var sb strings.Builder
		sb.WriteString(`<?xml version="1.0" encoding="UTF-8"?>` + "\n")
		sb.WriteString(`<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">` + "\n")
		for _, p := range pages {
			fmt.Fprintf(&sb, "  <url><loc>%s%s</loc><lastmod>%s</lastmod><changefreq>%s</changefreq><priority>%s</priority></url>\n",
				baseURL, p.Loc, today, p.Freq, p.Pri)
		}
		for _, b := range brands {
			fmt.Fprintf(&sb, "  <url><loc>%s/voucher/%s</loc><lastmod>%s</lastmod><changefreq>daily</changefreq><priority>0.8</priority></url>\n",
				baseURL, url.PathEscape(b.Code), today)
		}
		sb.WriteString("</urlset>")
		c.Header("Cache-Control", "public, max-age=3600")
		c.Data(http.StatusOK, "application/xml; charset=utf-8", []byte(sb.String()))
	}
}
