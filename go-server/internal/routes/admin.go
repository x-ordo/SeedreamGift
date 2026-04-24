package routes

import (
	"seedream-gift-server/internal/api/middleware"
	"seedream-gift-server/internal/config"

	"github.com/gin-gonic/gin"
)

// RegisterAdminRoutes sets up all /admin/* endpoints requiring ADMIN role.
func RegisterAdminRoutes(api *gin.RouterGroup, cfg *config.Config, h *Handlers) {
	admin := api.Group("/admin")
	admin.Use(middleware.JWTAuth(cfg.JWTSecret), middleware.AdminOnly(), middleware.IPWhitelistGuard(h.ipWhitelistSvc))
	{
		// Dashboard
		admin.GET("/stats", h.Admin.GetStatsWithPeriod)

		// System
		admin.GET("/system/info", h.Health.SystemInfo)
		admin.GET("/stock/alerts", h.Health.StockAlerts)

		// Users
		admin.GET("/users", h.AdminUser.GetUsers)
		admin.GET("/users/:id", h.AdminUser.GetUserDetail)
		admin.POST("/users", h.AdminUser.CreateUser)
		admin.PATCH("/users/:id", h.AdminUser.UpdateUser)
		admin.DELETE("/users/:id", h.AdminUser.DeleteUser)
		admin.PATCH("/users/:id/kyc", h.AdminUser.UpdateKycStatus)
		admin.PATCH("/users/:id/role", h.AdminUser.UpdateUserRole)
		admin.PATCH("/users/:id/password", h.AdminUser.ResetPassword)
		admin.PATCH("/users/:id/lock", h.AdminUser.LockUser)
		admin.PATCH("/users/:id/unlock", h.AdminUser.UnlockUser)
		admin.PATCH("/users/:id/partner-tier", h.AdminUser.UpdatePartnerTier)
		admin.GET("/users/:id/summary", h.AdminUser.GetUserSummary)

		// User WebAuthn management (관리자 패스키 초기화)
		admin.GET("/users/:id/webauthn", h.AdminUser.GetUserWebAuthn)
		admin.DELETE("/users/:id/webauthn", h.AdminUser.ResetUserWebAuthn)

		// Fraud Check (사기 조회)
		admin.GET("/users/:id/fraud-check", h.AdminFraud.FraudCheck)
		admin.GET("/users/:id/fraud-history", h.AdminFraud.FraudHistory)
		admin.POST("/orders/:id/release-hold", h.AdminFraud.ReleaseOrderHold)
		admin.POST("/trade-ins/:id/release-hold", h.AdminFraud.ReleaseTradeInHold)
		admin.POST("/blacklist-screen", h.AdminFraud.BlacklistScreen)

		// Sessions
		admin.GET("/sessions", h.AdminSession.GetSessions)
		admin.DELETE("/sessions/:id", h.AdminSession.DeleteSession)
		admin.DELETE("/sessions/user/:userId", h.AdminSession.DeleteUserSessions)

		// Brands
		admin.GET("/brands", h.AdminBrand.GetBrands)
		admin.GET("/brands/:code", h.AdminBrand.GetBrand)
		admin.POST("/brands", h.AdminBrand.CreateBrand)
		admin.PATCH("/brands/:code", h.AdminBrand.UpdateBrand)
		admin.DELETE("/brands/:code", h.AdminBrand.DeleteBrand)

		// Products
		admin.GET("/products", h.AdminProduct.GetProducts)
		admin.POST("/products", h.AdminProduct.CreateProduct)
		admin.PATCH("/products/:id", h.AdminProduct.UpdateProduct)
		admin.PATCH("/products/:id/approval", h.AdminProduct.ApproveProduct)
		admin.DELETE("/products/:id", h.AdminProduct.DeleteProduct)

		// Orders
		admin.GET("/orders", h.AdminOrder.GetOrders)
		admin.GET("/orders/:id", h.AdminOrder.GetOrderDetail)
		admin.PATCH("/orders/:id/status", h.AdminOrder.UpdateOrderStatus)
		admin.PATCH("/orders/batch-status", h.AdminOrder.BatchUpdateStatus)
		admin.POST("/orders/:id/auto-deliver", h.AdminOrder.AutoDeliver)
		admin.PATCH("/orders/:id/note", h.AdminOrder.UpdateNote)

		// Payments (결제현황 조회 — 읽기 전용)
		admin.GET("/payments", h.AdminPayment.ListPayments)

		// Trade-ins
		admin.GET("/trade-ins", h.AdminTradeIn.GetTradeIns)
		admin.GET("/trade-ins/:id", h.AdminTradeIn.GetTradeIn)
		admin.PATCH("/trade-ins/:id/status", h.AdminTradeIn.UpdateTradeInStatus)
		admin.PATCH("/trade-ins/:id/receive", h.AdminTradeIn.ReceiveTradeIn)

		// Vouchers
		admin.GET("/vouchers", h.AdminVoucher.GetVouchers)
		admin.GET("/vouchers/expiring", h.AdminVoucher.GetExpiringVouchers)
		admin.GET("/vouchers/:id", h.AdminVoucher.GetVoucherDetail)
		admin.PATCH("/vouchers/:id", h.AdminVoucher.UpdateVoucher)
		admin.DELETE("/vouchers/:id", h.AdminVoucher.DeleteVoucher)
		admin.GET("/vouchers/stock/:productId", h.AdminVoucher.GetVoucherStock)
		admin.GET("/vouchers/inventory", h.AdminVoucher.GetVoucherInventory)
		admin.POST("/vouchers/bulk", h.AdminVoucher.BulkVoucherUpload)

		// Reports
		reports := admin.Group("/reports")
		{
			reports.GET("/bank-transactions", h.AdminReport.GetBankTransactionReport)
			reports.GET("/trade-in-payouts", h.AdminReport.GetTradeInPayoutReport)
			reports.GET("/user-transactions/:userId", h.AdminReport.GetUserTransactionExport)
			reports.GET("/daily-sales", h.AdminReport.GetDailySalesReport)
			reports.GET("/brand-performance", h.AdminReport.GetBrandPerformance)
			reports.GET("/profit", h.AdminReport.GetProfitReport)
			reports.GET("/top-customers", h.AdminReport.GetTopCustomers)
		}

		// Carts (monitoring)
		carts := admin.Group("/carts")
		{
			carts.GET("", h.AdminCart.GetAllCarts)
			carts.GET("/user/:userId", h.AdminCart.GetUserCarts)
			carts.DELETE("/:id", h.AdminCart.DeleteCartItem)
			carts.DELETE("/user/:userId/all", h.AdminCart.ClearUserCart)
		}

		// Refunds
		refunds := admin.Group("/refunds")
		{
			refunds.GET("", h.AdminRefund.GetAllRefunds)
			refunds.GET("/:id", h.AdminRefund.GetRefund)
			refunds.POST("/:id/approve", h.AdminRefund.ApproveRefund)
			refunds.POST("/:id/reject", h.AdminRefund.RejectRefund)
		}

		// Gifts — /gifts/stats는 반드시 /gifts/:id 보다 먼저 등록해야 라우터 충돌을 방지합니다.
		admin.GET("/gifts", h.AdminGift.GetAllGifts)
		admin.GET("/gifts/stats", h.AdminGift.GetGiftStats)
		admin.GET("/gifts/:id", h.AdminGift.GetGiftDetail)

		// Content (notices, FAQs, events)
		admin.GET("/notices", h.AdminContent.GetAllNotices)
		admin.GET("/notices/:id", h.AdminContent.GetNotice)
		admin.POST("/notices", h.AdminContent.CreateNotice)
		admin.PATCH("/notices/:id", h.AdminContent.UpdateNotice)
		admin.DELETE("/notices/:id", h.AdminContent.DeleteNotice)

		admin.GET("/faqs", h.AdminContent.GetAllFaqs)
		admin.GET("/faqs/:id", h.AdminContent.GetFaq)
		admin.POST("/faqs", h.AdminContent.CreateFaq)
		admin.PATCH("/faqs/:id", h.AdminContent.UpdateFaq)
		admin.DELETE("/faqs/:id", h.AdminContent.DeleteFaq)

		admin.GET("/events", h.AdminContent.GetAllEvents)
		admin.GET("/events/:id", h.AdminContent.GetEvent)
		admin.POST("/events", h.AdminContent.CreateEvent)
		admin.PATCH("/events/:id", h.AdminContent.UpdateEvent)
		admin.DELETE("/events/:id", h.AdminContent.DeleteEvent)

		// Inquiries (admin answer/close)
		admin.GET("/inquiries", h.AdminContent.GetAllInquiries)
		admin.GET("/inquiries/:id", h.AdminContent.GetInquiry)
		admin.PATCH("/inquiries/:id/answer", h.AdminContent.AnswerInquiry)
		admin.PATCH("/inquiries/:id/close", h.AdminContent.CloseInquiry)
		admin.DELETE("/inquiries/:id", h.AdminContent.DeleteInquiry)

		// Policies
		admin.GET("/policies", h.AdminContent.GetAllPolicies)
		admin.GET("/policies/:id", h.AdminContent.GetPolicy)
		admin.POST("/policies", h.AdminContent.CreatePolicy)
		admin.PATCH("/policies/:id", h.AdminContent.UpdatePolicy)
		admin.PATCH("/policies/:id/current", h.AdminContent.SetCurrentPolicy)
		admin.DELETE("/policies/:id", h.AdminContent.DeletePolicy)

		// Partner config
		admin.PATCH("/users/:id/commission", h.AdminUser.SetCommissionRate)
		admin.PATCH("/users/:id/payout-frequency", h.AdminUser.SetPayoutFrequency)
		admin.PATCH("/users/:id/partner-limits", h.AdminUser.SetPartnerLimits)

		// Settlements
		admin.GET("/settlements", h.Settlement.GetSettlements)
		admin.GET("/settlements/:id", h.Settlement.GetSettlementDetail)
		admin.PATCH("/settlements/:id/status", h.Settlement.UpdateStatus)
		admin.POST("/settlements/batch", h.Settlement.CreateBatch)

		// Audit logs
		admin.GET("/audit-logs", h.AdminSession.GetAuditLogs)
		admin.GET("/audit-logs/:id", h.AdminSession.GetAuditLogDetail)

		// Pattern rules
		admin.GET("/pattern-rules", h.Admin.GetPatternRules)
		admin.PATCH("/pattern-rules/:ruleId", h.Admin.TogglePatternRule)

		// IP Whitelist (admin self-service)
		admin.GET("/ip-whitelist", h.IPWhitelist.GetMyWhitelist)
		admin.POST("/ip-whitelist", h.IPWhitelist.AddToWhitelist)
		admin.DELETE("/ip-whitelist/:id", h.IPWhitelist.DeleteFromWhitelist)
		admin.PATCH("/ip-whitelist/toggle", h.IPWhitelist.ToggleWhitelist)
		admin.GET("/ip-whitelist/current-ip", h.IPWhitelist.GetCurrentIP)

		// Site configs
		admin.GET("/site-configs", h.Admin.GetSiteConfigs)
		admin.GET("/site-configs/:id", h.Admin.GetSiteConfig)
		admin.POST("/site-configs", h.Admin.CreateSiteConfig)
		admin.PATCH("/site-configs/:key", h.Admin.UpdateSiteConfig)
		admin.DELETE("/site-configs/:id", h.Admin.DeleteSiteConfig)

		// Partner Price Management (파트너 단가 관리)
		admin.GET("/partner-prices", h.AdminPartnerPrice.GetPrices)
		admin.GET("/partner-prices/:partnerId", h.AdminPartnerPrice.GetPricesByPartner)
		admin.POST("/partner-prices", h.AdminPartnerPrice.UpsertPrice)
		admin.DELETE("/partner-prices/:id", h.AdminPartnerPrice.DeletePrice)

		// [비활성화] 유가증권은 현금영수증 발급 대상 아님 (부가가치세법 시행령 제73조)
		// adminCashReceipts := admin.Group("/cash-receipts")
		// {
		// 	adminCashReceipts.GET("", h.CashReceipt.AdminGetAll)
		// 	adminCashReceipts.GET("/:id", h.CashReceipt.AdminGetByID)
		// 	adminCashReceipts.POST("/:id/cancel", h.CashReceipt.AdminCancel)
		// 	adminCashReceipts.POST("/:id/reissue", h.CashReceipt.AdminReissue)
		// 	adminCashReceipts.POST("/:id/sync", h.CashReceipt.AdminSync)
		// }

		// Content Attachments (공지/이벤트/문의 첨부 파일)
		admin.GET("/attachments", h.ContentAttachment.GetAttachments)
		admin.POST("/attachments", h.ContentAttachment.Upload)
		admin.GET("/attachments/:id/download", h.ContentAttachment.Download)
		admin.DELETE("/attachments/:id", h.ContentAttachment.Delete)

		// Partner Documents (파트너 문서)
		admin.GET("/partner-documents", h.AdminPartnerDoc.GetDocuments)
		admin.POST("/partner-documents", h.AdminPartnerDoc.UploadDocument)
		admin.GET("/partner-documents/:id/download", h.AdminPartnerDoc.DownloadDocument)
		admin.DELETE("/partner-documents/:id", h.AdminPartnerDoc.DeleteDocument)

		// Business Inquiries (비즈니스 문의)
		admin.GET("/business-inquiries", h.AdminBusinessInquiry.GetAll)
		admin.GET("/business-inquiries/:id", h.AdminBusinessInquiry.GetDetail)
		admin.PATCH("/business-inquiries/:id/status", h.AdminBusinessInquiry.UpdateStatus)
		admin.DELETE("/business-inquiries/:id", h.AdminBusinessInquiry.Delete)

		// Partner Business Info (파트너 사업자 정보 검증)
		adminBusinessInfo := admin.Group("/partner-business-infos")
		{
			adminBusinessInfo.GET("", h.PartnerBusinessInfo.AdminGetAll)
			adminBusinessInfo.GET("/:partnerId", h.PartnerBusinessInfo.AdminGetByPartnerID)
			adminBusinessInfo.PUT("/:partnerId", h.PartnerBusinessInfo.AdminUpsert)
			adminBusinessInfo.PATCH("/:id/verify", h.PartnerBusinessInfo.AdminVerify)
			adminBusinessInfo.DELETE("/:id", h.PartnerBusinessInfo.AdminDelete)
		}

		// Seedreampay admin read endpoints — always filtered to ProviderCode='SEEDREAMPAY'.
		admin.GET("/seedreampay/vouchers", h.AdminSeedreampay.ListVouchers)
		admin.GET("/seedreampay/vouchers/:serialNo", h.AdminSeedreampay.GetVoucher)

		// 알림 채널 관리 (이메일/카카오/텔레그램/팝빌 런타임 설정)
		notifChannels := admin.Group("/notification-channels")
		{
			notifChannels.GET("", h.AdminNotification.GetChannels)
			notifChannels.GET("/:channel", h.AdminNotification.GetChannel)
			notifChannels.PATCH("/:channel/toggle", h.AdminNotification.ToggleChannel)
			notifChannels.PATCH("/:channel/config", h.AdminNotification.UpdateConfig)
			notifChannels.POST("/:channel/test", h.AdminNotification.TestChannel)
		}
	}
}
