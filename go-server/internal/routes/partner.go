package routes

import (
	"seedream-gift-server/internal/api/middleware"
	"seedream-gift-server/internal/config"

	"github.com/gin-gonic/gin"
)

// RegisterPartnerRoutes sets up all /partner/* endpoints requiring PARTNER or ADMIN role.
func RegisterPartnerRoutes(api *gin.RouterGroup, cfg *config.Config, h *Handlers) {
	partner := api.Group("/partner")
	partner.Use(middleware.JWTAuth(cfg.JWTSecret))
	partner.Use(middleware.PartnerOnly())
	partner.Use(middleware.IPWhitelistGuard(h.ipWhitelistSvc))
	{
		// Dashboard
		partner.GET("/dashboard", h.Partner.GetDashboard)

		// Products (AllowPartnerStock=true 상품만 조회, 생성/수정 불가)
		partner.GET("/products", h.Partner.GetAvailableProducts)

		// Orders
		partner.GET("/orders", h.Partner.GetMyOrders)
		partner.GET("/orders/:id", h.Partner.GetMyOrderDetail)

		// Vouchers
		partner.GET("/vouchers", h.Partner.GetMyVouchers)
		partner.POST("/vouchers/bulk", h.Partner.BulkUploadVouchers)
		partner.GET("/vouchers/inventory", h.Partner.GetVoucherInventory)
		partner.GET("/vouchers/stats", h.Partner.GetMyVoucherStats)

		// Payouts (레거시 — 기존 호환성 유지)
		partner.GET("/payouts", h.Partner.GetPayouts)
		partner.GET("/payouts/summary", h.Partner.GetPayoutSummary)

		// Settlements (신규 정산 시스템)
		partner.GET("/settlements", h.Settlement.GetMySettlements)
		partner.GET("/settlements/summary", h.Settlement.GetSettlementSummary)

		// Profile
		partner.GET("/profile", h.Partner.GetProfile)
		partner.PATCH("/profile", h.Partner.UpdateProfile)

		// Business Info (사업자 정보 자가 등록/수정)
		businessInfo := partner.Group("/business-info")
		{
			businessInfo.GET("", h.PartnerBusinessInfo.GetMyBusinessInfo)
			businessInfo.PUT("", h.PartnerBusinessInfo.UpdateMyBusinessInfo)
			businessInfo.DELETE("", h.PartnerBusinessInfo.DeleteMyBusinessInfo)
		}

		// IP Whitelist (partner self-service)
		partner.GET("/ip-whitelist", h.IPWhitelist.GetMyWhitelist)
		partner.POST("/ip-whitelist", h.IPWhitelist.AddToWhitelist)
		partner.DELETE("/ip-whitelist/:id", h.IPWhitelist.DeleteFromWhitelist)
		partner.PATCH("/ip-whitelist/toggle", h.IPWhitelist.ToggleWhitelist)
		partner.GET("/ip-whitelist/current-ip", h.IPWhitelist.GetCurrentIP)

		// Partner Purchasing (구매 — 파트너 대량 발주)
		partner.GET("/products/purchasable", h.PartnerOrder.GetPurchasableProducts)
		partner.POST("/orders", h.PartnerOrder.CreateOrder)
		partner.GET("/orders/purchases", h.PartnerOrder.GetMyPurchases)
		partner.POST("/orders/:id/cancel", h.PartnerOrder.CancelOrder)
		partner.GET("/orders/:id/export", h.PartnerOrder.ExportPins)

		// Partner Trade-in (매입 — 파트너 상품권 판매)
		partner.POST("/trade-ins", h.PartnerTradeIn.Create)
		partner.GET("/trade-ins", h.PartnerTradeIn.GetMyTradeIns)
		partner.GET("/trade-ins/:id", h.PartnerTradeIn.GetDetail)

		// Documents (문서 조회)
		partner.GET("/documents", h.PartnerDoc.GetMyDocuments)
		partner.GET("/documents/:id/download", h.PartnerDoc.DownloadMyDocument)
	}
}
