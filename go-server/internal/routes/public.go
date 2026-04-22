package routes

import (
	"time"
	"seedream-gift-server/internal/api/middleware"
	"seedream-gift-server/internal/config"
	"seedream-gift-server/pkg/response"

	"github.com/gin-gonic/gin"
)

// RegisterPublicRoutes sets up all unauthenticated public endpoints:
// products, brands, content (notices/faqs/events), KYC, and site config.
func RegisterPublicRoutes(api *gin.RouterGroup, _ *config.Config, h *Handlers) {
	// Brands & Products
	api.GET("/brands", h.Brand.GetBrands)
	api.GET("/brands/:code", h.Brand.GetBrand)
	api.GET("/products", h.Product.GetProducts)
	api.GET("/products/rates", h.Product.GetProductRates)
	api.GET("/products/live-rates", h.Product.GetProductRates)
	api.GET("/products/brand/:brand", h.Product.GetProductsByBrand)
	api.GET("/products/:id", h.Product.GetProduct)

	// Notices
	api.GET("/notices", h.Content.GetNotices)
	api.GET("/notices/active", h.Content.GetActiveNotices)
	api.GET("/notices/:id", h.Content.GetNotice)
	api.PATCH("/notices/:id/view", middleware.EndpointRateLimit(10, time.Minute), h.Content.IncrementNoticeView)

	// FAQs
	api.GET("/faqs", h.Content.GetFaqs)
	api.GET("/faqs/active", h.Content.GetActiveFaqs)
	api.GET("/faqs/categories", h.Content.GetFaqCategories)
	api.GET("/faqs/:id", h.Content.GetFaq)
	api.PATCH("/faqs/:id/helpful", middleware.EndpointRateLimit(10, time.Minute), h.Content.IncrementFaqHelpful)

	// Events
	api.GET("/events", h.Content.GetEvents)
	api.GET("/events/active", h.Content.GetActiveEvents)
	api.GET("/events/featured", h.Content.GetFeaturedEvents)
	api.GET("/events/:id", h.Content.GetEvent)
	api.PATCH("/events/:id/view", middleware.EndpointRateLimit(10, time.Minute), h.Content.IncrementEventView)

	// KYC (public, rate limited)
	kyc := api.Group("/kyc")
	kyc.Use(middleware.EndpointRateLimit(5, time.Minute))
	{
		kyc.POST("/bank-verify/request", h.Kyc.RequestBankVerify)
		kyc.POST("/bank-verify/confirm", h.Kyc.ConfirmBankVerify)
		kyc.POST("/verify-sms", h.Kyc.VerifySms)

		kcb := kyc.Group("/kcb")
		{
			kcb.POST("/start", h.Kcb.Start)
			kcb.POST("/complete", h.Kcb.Complete)
		}
	}
	// check-status는 프론트엔드가 1.5초마다 폴링하므로 별도의 높은 rate limit 적용
	api.GET("/kyc/kcb/check-status", middleware.EndpointRateLimit(60, time.Minute), h.Kcb.CheckStatus)

	// Site config (public read)
	api.GET("/site-configs/:key", func(c *gin.Context) {
		// This uses AdminHandler's service — acceptable for read-only public access
		key := c.Param("key")
		cfg, err := h.Admin.GetSiteConfigByKey(key)
		if err != nil {
			response.NotFound(c, "설정을 찾을 수 없습니다")
			return
		}
		response.Success(c, cfg)
	})

	// Policy (public read — current version only)
	api.GET("/policies/:type", h.AdminContent.GetCurrentPolicyPublic)

	// Content attachments (공개 — 목록 조회 + 이미지 인라인 / 파일 다운로드)
	api.GET("/attachments", h.ContentAttachment.GetAttachments)
	api.GET("/attachments/:id", h.ContentAttachment.Download)

	// Business inquiry (public, rate limited: 5/min)
	api.POST("/business-inquiries", middleware.EndpointRateLimit(5, time.Minute), h.BusinessInquiry.Submit)

	// Client error reporting (rate limited: IP당 분당 10건)
	api.POST("/client-errors", middleware.EndpointRateLimit(10, time.Minute), h.ClientError.ReportError)
}
