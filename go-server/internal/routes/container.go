// Package routes provides modular route registration for the Seedream Gift API server.
// Each domain (auth, product, order, etc.) has its own route file,
// keeping main.go clean and making it easy to add new endpoint groups.
package routes

import (
	"sync"
	"time"
	"seedream-gift-server/internal/api/handlers"
	"seedream-gift-server/internal/app/interfaces"
	"seedream-gift-server/internal/app/services"
	"seedream-gift-server/internal/config"
	"seedream-gift-server/internal/infra/issuance"
	"seedream-gift-server/internal/infra/popbill"
	"seedream-gift-server/internal/infra/resilience"
	"seedream-gift-server/internal/infra/workqueue"
	"seedream-gift-server/pkg/blacklistdb"
	"seedream-gift-server/pkg/email"
	"seedream-gift-server/pkg/kakao"
	"seedream-gift-server/pkg/notification"
	"seedream-gift-server/pkg/thecheat"

	"gorm.io/gorm"
)

// patternRuleSeedOnce는 기본 패턴 규칙 시딩이 프로세스 수명 동안 한 번만 실행되도록 보장합니다.
var patternRuleSeedOnce sync.Once

// Handlers holds all initialized handler instances for dependency injection.
// Adding a new handler: 1) add field here 2) initialize in NewHandlers 3) create route file.
type Handlers struct {
	DB       *gorm.DB // 미들웨어에서 DB 접근 필요 시 사용 (멱등성 등)
	Auth     *handlers.AuthHandler
	WebAuthn *handlers.WebAuthnHandler
	Product  *handlers.ProductHandler
	Brand    *handlers.BrandHandler
	Order    *handlers.OrderHandler
	TradeIn  *handlers.TradeInHandler
	Cart     *handlers.CartHandler
	Payment  *handlers.PaymentHandler
	Gift     *handlers.GiftHandler
	Content  *handlers.ContentHandler
	Kyc      *handlers.KycHandler
	Kcb      *handlers.KcbHandler
	User     *handlers.UserHandler
	Health      *handlers.HealthHandler
	ClientError *handlers.ClientErrorHandler

	// Partner handler
	Partner *handlers.PartnerHandler

	// Settlement handler (admin + partner)
	Settlement *handlers.SettlementHandler

	// IP Whitelist (shared admin + partner)
	IPWhitelist    *handlers.IPWhitelistHandler
	ipWhitelistSvc *services.IPWhitelistService

	// Fulfillment (외부 API 발급 파이프라인 — 크론에서 사용)
	Fulfillment *services.FulfillmentService
	// OrderSvc (만료 주문 자동 취소 — 크론에서 사용)
	OrderSvc *services.OrderService

	// WorkerPools (비동기 작업 큐 — Graceful Shutdown 시 종료)
	NotifyPool *workqueue.WorkerPool
	AuditPool  *workqueue.WorkerPool

	// Admin handlers
	Admin        *handlers.AdminHandler
	AdminUser    *handlers.AdminUserHandler
	AdminProduct *handlers.AdminProductHandler
	AdminBrand   *handlers.AdminBrandHandler
	AdminOrder   *handlers.AdminOrderHandler
	AdminVoucher *handlers.AdminVoucherHandler
	AdminTradeIn *handlers.AdminTradeInHandler
	AdminRefund  *handlers.AdminRefundHandler
	AdminContent *handlers.AdminContentHandler
	AdminGift    *handlers.AdminGiftHandler
	AdminReport  *handlers.AdminReportHandler
	AdminCart    *handlers.AdminCartHandler
	AdminSession *handlers.AdminSessionHandler

	// Partner purchase/trade-in handlers
	PartnerOrder      *handlers.PartnerOrderHandler
	PartnerTradeIn    *handlers.PartnerTradeInHandler
	AdminPartnerPrice *handlers.AdminPartnerPriceHandler

	// Cash receipt handler
	CashReceipt *handlers.CashReceiptHandler
	// CashReceiptSvc — exposed for cron job injection in main.go
	CashReceiptSvc *services.CashReceiptService

	// Partner document handlers (admin + partner)
	AdminPartnerDoc *handlers.AdminPartnerDocHandler
	PartnerDoc      *handlers.PartnerDocHandler

	// Business inquiry handlers (public submit + admin management)
	BusinessInquiry      *handlers.BusinessInquiryHandler
	AdminBusinessInquiry *handlers.AdminBusinessInquiryHandler

	// Content attachment handler (공지/이벤트/문의 첨부 파일)
	ContentAttachment *handlers.ContentAttachmentHandler

	// Partner business info (사업자 정보 등록 및 관리자 검증)
	PartnerBusinessInfo *handlers.PartnerBusinessInfoHandler

	// Notification channel management (admin runtime config)
	AdminNotification *handlers.AdminNotificationHandler

	// Fraud check (더치트 사기 조회)
	AdminFraud *handlers.AdminFraudHandler
}

// NewHandlers creates all service and handler instances with proper dependency injection.
// This is the single place where all dependencies are wired together.
func NewHandlers(db *gorm.DB, cfg *config.Config, pp interfaces.IPaymentProvider, version, buildTime string) *Handlers {
	// SiteConfig 캐시 (TTL 5분) — 여러 서비스가 공유하여 DB 부하를 줄임
	configProvider := services.NewCachedConfigProvider(db, 5*time.Minute)

	// 비동기 워커 풀 초기화
	// notifyPool: 텔레그램 알림 (워커 3, 큐 100)
	// auditPool:  감사 로그 DB 기록 (워커 2, 큐 200)
	notifyPool := workqueue.NewWorkerPool(workqueue.WorkerPoolConfig{Name: "notification", Workers: 3, QueueSize: 100})
	notifyPool.Start()
	auditPool := workqueue.NewWorkerPool(workqueue.WorkerPoolConfig{Name: "audit", Workers: 2, QueueSize: 200})
	auditPool.Start()

	// External service config (런타임 알림 채널 관리 — 다른 서비스보다 먼저 초기화)
	extConfigSvc := services.NewExternalServiceConfigService(db, cfg.EncryptionKey, cfg)
	extConfigSvc.SeedFromEnv(cfg)

	// Core services
	mfaService := services.NewMfaService(db, cfg)
	authService := services.NewAuthService(db, cfg, mfaService)
	webAuthnService := services.NewWebAuthnService(db, cfg)
	emailSvc := email.NewService(cfg)
	kakaoClient := kakao.NewClient(cfg.KakaoSenderKey, cfg.KakaoAPIKey)
	notifSvc := notification.NewService(emailSvc, kakaoClient, cfg.TelegramToken, cfg.TelegramChatID, cfg.FrontendUrl)
	notifSvc.SetSiteName(cfg.SiteName)
	// 런타임 채널 활성 여부를 DB에서 확인하도록 checker 주입
	notifSvc.SetChannelChecker(extConfigSvc)

	productService := services.NewProductService(db)
	brandService := services.NewBrandService(db)
	orderService := services.NewOrderService(db, pp, cfg, configProvider)
	tradeInService := services.NewTradeInService(db, cfg)
	tradeInService.SetConfigProvider(configProvider)

	// ─── Bulkhead: 외부 서비스별 독립 HTTP 커넥션 풀 ───
	// 각 서비스는 전용 Transport를 가지므로 한 서비스 장애가 다른 서비스 연결 풀에 영향을 주지 않습니다.
	httpPool := resilience.NewHTTPClientPool()
	issuanceClient := httpPool.Register(resilience.HTTPClientConfig{
		Name: "issuance", MaxConnsPerHost: 10, Timeout: 15 * time.Second,
	})
	fraudClient := httpPool.Register(resilience.HTTPClientConfig{
		Name: "fraud", MaxConnsPerHost: 5, Timeout: 10 * time.Second,
	})
	receiptClient := httpPool.Register(resilience.HTTPClientConfig{
		Name: "receipt", MaxConnsPerHost: 3, Timeout: 30 * time.Second,
	})
	// paymentClient는 현재 MockPaymentProvider 사용 중이므로 추후 실제 PG 연동 시 활성화
	// paymentClient := httpPool.Register(resilience.HTTPClientConfig{
	// 	Name: "payment", MaxConnsPerHost: 5, Timeout: 10 * time.Second,
	// })
	_ = issuanceClient
	_ = fraudClient
	_ = receiptClient

	// ─── Circuit Breaker 레지스트리 ───
	// 외부 API별 독립 CB 인스턴스. 텔레그램 토큰이 있으면 상태 변경 시 알림을 발송합니다.
	cbReg := resilience.NewCBRegistry(cfg.TelegramToken, cfg.TelegramChatID)
	giftmoaCB := cbReg.Register(resilience.CBConfig{
		Name: "giftmoa", FailThreshold: 5, Timeout: 30 * time.Second,
	})
	expayCB := cbReg.Register(resilience.CBConfig{
		Name: "expay", FailThreshold: 5, Timeout: 30 * time.Second,
	})
	popbillCB := cbReg.Register(resilience.CBConfig{
		Name: "popbill", FailThreshold: 5, Timeout: 30 * time.Second,
	})
	thecheatCB := cbReg.Register(resilience.CBConfig{
		Name: "thecheat", FailThreshold: 5, Timeout: 30 * time.Second,
	})
	// tossCB는 결제 안정성 우선: FailThreshold 3으로 더 민감하게 설정
	// tossCB := cbReg.Register(resilience.CBConfig{
	// 	Name: "toss", FailThreshold: 3, Timeout: 60 * time.Second,
	// })
	_ = giftmoaCB
	_ = expayCB
	_ = popbillCB
	_ = thecheatCB

	// 더치트 사기 조회 + 블랙리스트 스크리닝 서비스
	var fraudChecker interfaces.FraudChecker
	var blScreener services.BlacklistScreener
	if cfg.TheCheatEnabled && cfg.TheCheatAPIKey != "" && cfg.TheCheatEncKey != "" {
		theCheatClient := thecheat.NewClient(cfg.TheCheatAPIKey, cfg.TheCheatEncKey, thecheatCB)
		fraudCheckSvc := services.NewFraudCheckService(db, cfg, theCheatClient)

		// 블랙리스트 스크리닝 클라이언트 주입
		if cfg.BlacklistEnabled && cfg.BlacklistBaseURL != "" && cfg.BlacklistAPIKey != "" {
			blClient := blacklistdb.NewClient(cfg.BlacklistBaseURL, cfg.BlacklistAPIKey, cfg.BlacklistPartnerID)
			fraudCheckSvc.SetBlacklistClient(blClient)
			blScreener = blClient
		}

		orderService.SetFraudChecker(fraudCheckSvc)
		tradeInService.SetFraudChecker(fraudCheckSvc)
		fraudChecker = fraudCheckSvc
	}

	cartService := services.NewCartService(db, configProvider)

	// Cash receipt (팝빌 현금영수증)
	cashReceiptSvc := services.NewCashReceiptService(db, newCashReceiptProvider(cfg, cbReg), cfg.EncryptionKey)

	paymentService := services.NewPaymentService(db, pp, cashReceiptSvc)

	// 복식부기 원장 서비스 — 결제/환불 트랜잭션에 원장 기록 연동
	ledgerSvc := services.NewLedgerService(db)
	paymentService.SetLedgerService(ledgerSvc)

	giftService := services.NewGiftService(db, cfg)
	kycService := services.NewKycService(db, cfg)
	userService := services.NewUserService(db)
	contentService := services.NewContentService(db)

	// Admin services (분리: Stats / Config / PatternRules)
	// CQRS 읽기 모델: DashboardReadService를 AdminStatsService에 주입하여 캐시 우선 조회를 활성화합니다.
	dashboardReadSvc := services.NewDashboardReadService(db, 2*time.Minute)
	adminStatsSvc := services.NewAdminStatsService(db)
	adminStatsSvc.SetReadCache(dashboardReadSvc)
	adminConfigSvc := services.NewAdminConfigService(db, configProvider)
	patternRuleSvc := services.NewPatternRuleService(db)
	patternRuleSeedOnce.Do(func() {
		patternRuleSvc.SeedDefaultPatternRules()
	})

	// Partner and settlement services (configProvider로 설정 조회 캐시 활용)
	partnerService := services.NewPartnerService(db, cfg.EncryptionKey, configProvider)
	settlementService := services.NewSettlementService(db, configProvider)
	partnerOrderSvc := services.NewPartnerOrderService(db, cfg.EncryptionKey, configProvider)
	partnerTradeInSvc := services.NewPartnerTradeInService(db, cfg.EncryptionKey, configProvider)
	partnerPriceSvc := services.NewAdminPartnerPriceService(db)
	adminUserSvc := services.NewAdminUserService(db)
	adminProductSvc := services.NewAdminProductService(db)
	adminBrandSvc := services.NewAdminBrandService(db)
	adminOrderSvc := services.NewAdminOrderService(db)
	adminVoucherSvc := services.NewAdminVoucherService(db, cfg.EncryptionKey)
	adminTradeInSvc := services.NewAdminTradeInService(db)
	adminTradeInSvc.SetLedgerService(ledgerSvc)
	adminRefundSvc := services.NewAdminRefundService(db, cashReceiptSvc)
	adminRefundSvc.SetLedgerService(ledgerSvc)
	adminContentSvc := services.NewAdminContentService(db)
	adminGiftSvc := services.NewAdminGiftService(db)
	adminReportSvc := services.NewAdminReportService(db)
	adminCartSvc := services.NewAdminCartService(db)
	adminSessionSvc := services.NewAdminSessionService(db)
	ipWhitelistSvc := services.NewIPWhitelistService(db)

	// Partner document & business inquiry services
	partnerDocSvc := services.NewPartnerDocService(db, cfg.UploadBasePath)
	contentAttachmentSvc := services.NewContentAttachmentService(db, cfg.UploadBasePath)
	bizEmail := cfg.BizEmail
	if bizEmail == "" {
		bizEmail = cfg.AdminNotifyEmail // 폴백
	}
	businessInquirySvc := services.NewBusinessInquiryService(db, emailSvc, bizEmail)
	partnerBusinessInfoSvc := services.NewPartnerBusinessInfoService(db)

	// Fulfillment: 외부 API 발급 파이프라인
	stubIssuer := issuance.NewStubIssuer()
	voucherIssuers := map[string]interfaces.VoucherIssuer{
		stubIssuer.ProviderCode(): stubIssuer,
	}
	if cfg.EXPayBaseURL != "" && cfg.EXPayAPIKey != "" {
		expayIssuer := issuance.NewEXPayIssuer(cfg.EXPayBaseURL, cfg.EXPayAPIKey, issuanceClient, expayCB)
		voucherIssuers[expayIssuer.ProviderCode()] = expayIssuer
	}
	fulfillmentSvc := services.NewFulfillmentService(db, voucherIssuers, cfg.EncryptionKey, pp)

	// 워커 풀 주입 (setter injection — 선택적 의존성)
	orderService.SetWorkerPools(notifyPool, auditPool)
	fulfillmentSvc.SetNotifyPool(notifyPool)

	// OrderEventService 주입 (주문 상태 변경 이벤트 추적)
	orderEventSvc := services.NewOrderEventService(db)
	orderService.SetOrderEventService(orderEventSvc)
	paymentService.SetOrderEventService(orderEventSvc)
	fulfillmentSvc.SetOrderEventService(orderEventSvc)

	h := &Handlers{
		DB:       db,
		Auth:     handlers.NewAuthHandler(authService, cfg, emailSvc, notifSvc),
		WebAuthn: handlers.NewWebAuthnHandler(webAuthnService, authService, cfg),
		Product: handlers.NewProductHandler(productService),
		Brand:   handlers.NewBrandHandler(brandService),
		Order:   handlers.NewOrderHandler(orderService, notifSvc),
		TradeIn: handlers.NewTradeInHandler(tradeInService, notifSvc),
		Cart:    handlers.NewCartHandler(cartService),
		Payment: handlers.NewPaymentHandler(paymentService),
		Gift:    handlers.NewGiftHandler(giftService),
		Content: handlers.NewContentHandler(contentService),
		Kyc:     handlers.NewKycHandler(kycService),
		Kcb:     handlers.NewKcbHandler(kycService),
		User:    handlers.NewUserHandler(userService, cfg),
		Health:      handlers.NewHealthHandler(db, version, buildTime),
		ClientError: handlers.NewClientErrorHandler(),

		Partner:    handlers.NewPartnerHandler(partnerService),
		Settlement: handlers.NewSettlementHandler(settlementService),
		PartnerOrder:      handlers.NewPartnerOrderHandler(partnerOrderSvc),
		PartnerTradeIn:    handlers.NewPartnerTradeInHandler(partnerTradeInSvc),
		AdminPartnerPrice: handlers.NewAdminPartnerPriceHandler(partnerPriceSvc),
		IPWhitelist:    handlers.NewIPWhitelistHandler(ipWhitelistSvc),
		ipWhitelistSvc: ipWhitelistSvc,
		Fulfillment:    fulfillmentSvc,
		OrderSvc:       orderService,
		NotifyPool:     notifyPool,
		AuditPool:      auditPool,

		Admin:        handlers.NewAdminHandler(adminStatsSvc, adminConfigSvc, patternRuleSvc),
		AdminUser:    handlers.NewAdminUserHandler(adminUserSvc),
		AdminProduct: handlers.NewAdminProductHandler(adminProductSvc),
		AdminBrand:   handlers.NewAdminBrandHandler(adminBrandSvc),
		AdminOrder:   handlers.NewAdminOrderHandler(adminOrderSvc, notifSvc),
		AdminVoucher: handlers.NewAdminVoucherHandler(adminVoucherSvc),
		AdminTradeIn: handlers.NewAdminTradeInHandler(adminTradeInSvc, notifSvc, db),
		AdminRefund:  handlers.NewAdminRefundHandler(adminRefundSvc),
		AdminContent: handlers.NewAdminContentHandler(adminContentSvc),
		AdminGift:    handlers.NewAdminGiftHandler(adminGiftSvc),
		AdminReport:  handlers.NewAdminReportHandler(adminReportSvc),
		AdminCart:    handlers.NewAdminCartHandler(adminCartSvc),
		AdminSession: handlers.NewAdminSessionHandler(adminSessionSvc),

		CashReceipt:    handlers.NewCashReceiptHandler(cashReceiptSvc),
		CashReceiptSvc: cashReceiptSvc,

		AdminPartnerDoc: handlers.NewAdminPartnerDocHandler(partnerDocSvc),
		PartnerDoc:      handlers.NewPartnerDocHandler(partnerDocSvc),

		BusinessInquiry:      handlers.NewBusinessInquiryHandler(businessInquirySvc),
		AdminBusinessInquiry: handlers.NewAdminBusinessInquiryHandler(businessInquirySvc),

		ContentAttachment: handlers.NewContentAttachmentHandler(contentAttachmentSvc),

		PartnerBusinessInfo: handlers.NewPartnerBusinessInfoHandler(partnerBusinessInfoSvc),

		AdminNotification: handlers.NewAdminNotificationHandler(extConfigSvc),

		AdminFraud: handlers.NewAdminFraudHandler(db, fraudChecker, blScreener),
	}

	// Handlers 구조체 생성 후 setter injection
	h.AdminOrder.SetOrderEventService(orderEventSvc)

	return h
}

// newCashReceiptProvider returns Popbill client or stub based on config.
// cb는 Circuit Breaker 인스턴스입니다. nil이면 CB 없이 동작합니다.
func newCashReceiptProvider(cfg *config.Config, cbReg *resilience.CBRegistry) interfaces.ICashReceiptProvider {
	if cfg.PopbillLinkID == "" || cfg.PopbillSecretKey == "" {
		return popbill.NewStubCashReceiptProvider()
	}
	cb := cbReg.Get("popbill")
	return popbill.NewClient(popbill.Config{
		LinkID:    cfg.PopbillLinkID,
		SecretKey: cfg.PopbillSecretKey,
		CorpNum:   cfg.PopbillCorpNum,
		IsTest:    cfg.PopbillIsTest,
	}, cb)
}
