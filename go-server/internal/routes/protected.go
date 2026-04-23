package routes

import (
	"time"
	"seedream-gift-server/internal/api/middleware"
	"seedream-gift-server/internal/config"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// RegisterProtectedRoutes sets up all JWT-protected user endpoints:
// cart, payments, orders, gifts, trade-ins, KYC (bank account), user, inquiries.
func RegisterProtectedRoutes(api *gin.RouterGroup, cfg *config.Config, h *Handlers, db *gorm.DB) {
	protected := api.Group("")
	protected.Use(middleware.JWTAuth(cfg.JWTSecret))
	{
		// ── 소비자 전용 기능 (PARTNER 접근 차단) ──────────────────────
		consumer := protected.Group("")
		consumer.Use(middleware.UserOnly())

		// Cart
		cart := consumer.Group("/cart")
		{
			cart.GET("", h.Cart.GetCart)
			cart.GET("/check-limit", h.Cart.CheckLimit)
			cart.POST("", h.Cart.AddItem)
			cart.PATCH("/:id", h.Cart.UpdateQuantity)
			cart.DELETE("/:id", h.Cart.RemoveItem)
			cart.DELETE("/batch", h.Cart.RemoveItemsBatch)
			cart.DELETE("", h.Cart.ClearCart)
		}

		// Payments
		payments := consumer.Group("/payments")
		{
			payments.POST("/initiate", middleware.EndpointRateLimit(10, time.Minute), h.Payment.InitiatePayment)
			payments.GET("/verify", h.Payment.VerifyPayment)
		}

		// Orders
		orders := consumer.Group("/orders")
		{
			orders.POST("", middleware.TransactionThrottle(), middleware.IdempotencyMiddleware(db), h.Order.CreateOrder)
			orders.GET("/my", h.Order.GetMyOrders)
			orders.GET("/:id", h.Order.GetOrderDetail)
			orders.POST("/:id/cancel", h.Order.CancelOrder)
			orders.POST("/payment/confirm", middleware.IdempotencyMiddleware(db), h.Order.ConfirmPayment)
			orders.GET("/my/export", h.Order.GetMyExport)
			orders.GET("/my/bank-submission", h.Order.GetMyBankSubmission)
		}

		// Gifts (legacy path kept for compatibility)
		orders.GET("/my-gifts", h.Gift.GetReceivedGifts)

		gifts := consumer.Group("/gifts")
		{
			gifts.GET("/received", h.Gift.GetReceivedGifts)
			gifts.POST("/check-receiver", h.Gift.CheckReceiver)
			gifts.GET("/search", middleware.EndpointRateLimit(30, time.Minute), h.Gift.SearchReceiver)
			gifts.POST("/:id/claim", middleware.IdempotencyMiddleware(db), h.Gift.ClaimGift)
		}

		// Trade-ins
		tradeIn := consumer.Group("/trade-ins")
		{
			tradeIn.POST("", middleware.TransactionThrottle(), middleware.IdempotencyMiddleware(db), h.TradeIn.SubmitTradeIn)
			tradeIn.GET("/my", h.TradeIn.GetMyTradeIns)
			tradeIn.GET("/:id", h.TradeIn.GetTradeIn)
		}

		// Seedreampay consumer actions (redeem requires JWT; refund bound to
		// the 7-day user window enforced in the service).
		consumer.POST("/seedreampay/vouchers/redeem", h.Seedreampay.Redeem)
		consumer.POST("/seedreampay/vouchers/:serialNo/refund", h.Seedreampay.Refund)

		// Seedream 결제 취소/환불 (Phase 4) — payMethod 로 VACCOUNT-ISSUECAN | BANK 분기.
		// 권한은 서비스 레이어에서 OrderCode AND UserId 결합 쿼리로 강제 (타인 주문 차단).
		// JWT 만 필요 (UserOnly 제한 없음 — 파트너도 본인 주문 취소 가능).
		protected.POST("/payment/seedream/cancel", h.SeedreamCancel.Handle)

		// [비활성화] 유가증권은 현금영수증 발급 대상 아님 (부가가치세법 시행령 제73조)
		// cashReceipts := consumer.Group("/cash-receipts")
		// {
		// 	cashReceipts.POST("/request", middleware.RateLimiter("5-M"), h.CashReceipt.RequestAfterPurchase)
		// 	cashReceipts.GET("/my", h.CashReceipt.GetMyReceipts)
		// 	cashReceipts.GET("/:id", h.CashReceipt.GetByID)
		// }

		// ── 공통 기능 (모든 인증 사용자) ────────────────────────────

		// KYC (authenticated — bank account management)
		kycProtected := protected.Group("/kyc")
		{
			kycProtected.GET("/bank-account", h.Kyc.GetBankAccount)
			kycProtected.POST("/bank-account", h.Kyc.ChangeBankAccount)
			kycProtected.POST("/change-phone", h.Kyc.ChangePhone)
		}

		// User self-management (비밀번호 확인 필요 + rate limit)
		protected.DELETE("/users/me", middleware.EndpointRateLimit(3, time.Minute), h.User.DeleteMe)

		// Inquiries
		inquiries := protected.Group("/inquiries")
		{
			inquiries.GET("", h.Content.GetMyInquiries)
			inquiries.POST("", h.Content.CreateInquiry)
			inquiries.PATCH("/:id", h.Content.UpdateInquiry)
			inquiries.DELETE("/:id", h.Content.DeleteInquiry)
		}
	}
}
