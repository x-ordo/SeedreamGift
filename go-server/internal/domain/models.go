// Package domain은 애플리케이션의 핵심 비즈니스 모델과 타입을 정의합니다.
// 시스템의 데이터 구조에 대한 단일 소스(Single source of truth) 역할을 합니다.
//
// 모델 파일 구조:
//   - user.go: User, RefreshToken
//   - product.go: Brand, Product
//   - order.go: Order, OrderItem, Payment, Refund
//   - voucher.go: VoucherCode
//   - tradein.go: TradeIn
//   - cart.go: CartItem
//   - content.go: Notice, Faq, Event, Inquiry
//   - gift.go: Gift
//   - kyc.go: KycVerifySession, SmsVerification
//   - site_config.go: SiteConfig, AuditLog
//   - types.go: NumericDecimal
//   - validation.go: 도메인 검증 규칙
package domain
