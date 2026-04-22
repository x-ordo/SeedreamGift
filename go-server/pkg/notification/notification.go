// Package notification provides a unified notification service that dispatches
// messages to email, Kakao Alimtalk, and Telegram simultaneously.
// Each channel failure is independent — one failing does not block others.
package notification

import (
	"fmt"
	"html"

	"seedream-gift-server/pkg/email"
	"seedream-gift-server/pkg/kakao"
	"seedream-gift-server/pkg/logger"
	"seedream-gift-server/pkg/telegram"

	"go.uber.org/zap"
)

// ChannelEnabledChecker는 알림 채널의 활성/비활성 상태를 런타임에 확인합니다.
// nil인 경우 모든 채널이 활성화된 것으로 간주합니다 (하위 호환).
type ChannelEnabledChecker interface {
	IsChannelEnabled(channel string) bool
}

// Service orchestrates multi-channel notifications.
type Service struct {
	email          *email.Service
	kakao          *kakao.Client
	tgToken        string
	tgChatID       string
	frontURL       string
	siteName       string
	channelChecker ChannelEnabledChecker
}

func (s *Service) SetSiteName(name string) { s.siteName = name }

func (s *Service) emailSubject(suffix string) string {
	n := s.siteName
	if n == "" {
		n = "W기프트"
	}
	return "[" + n + "] " + suffix
}

func (s *Service) sn() string {
	if s.siteName != "" {
		return s.siteName
	}
	return "W기프트"
}

// NewService creates a notification service.
func NewService(emailSvc *email.Service, kakaoClient *kakao.Client, tgToken, tgChatID, frontendURL string) *Service {
	return &Service{
		email:    emailSvc,
		kakao:    kakaoClient,
		tgToken:  tgToken,
		tgChatID: tgChatID,
		frontURL: frontendURL,
	}
}

// SetChannelChecker는 런타임 채널 활성 여부 확인기를 설정합니다.
// DI 순환 참조를 피하기 위해 생성 후 별도로 주입합니다.
func (s *Service) SetChannelChecker(checker ChannelEnabledChecker) {
	s.channelChecker = checker
}

// ============================================================
// Notification Data Types
// ============================================================

// OrderInfo holds order data for notifications.
type OrderInfo struct {
	OrderCode   string
	UserName    string
	UserEmail   string
	UserPhone   string
	TotalAmount int
	Items       []email.ReceiptItem
	PaymentMethod string
}

// TradeInInfo holds trade-in data for notifications.
type TradeInInfo struct {
	UserName    string
	UserEmail   string
	UserPhone   string
	ProductName string
	Quantity    int
	PayoutAmount int
}

// PinItem holds PIN data for delivery notification.
type PinItem struct {
	ProductName string
	PinCode     string // masked
}

// ============================================================
// Notification Methods
// ============================================================

// OrderCreated dispatches notifications when a new order is placed.
// Channels: email (주문 접수) + kakao (알림톡) + telegram (운영)
func (s *Service) OrderCreated(info OrderInfo) {
	// Email
	go s.safeEmail(func() error {
		return s.email.SendOrderConfirmation(info.UserEmail, info.UserName, info.OrderCode, info.TotalAmount)
	})

	// Kakao Alimtalk
	go s.safeKakao(info.UserPhone, "ORDER_CREATED", map[string]string{
		"orderCode": info.OrderCode,
		"amount":    email.FormatKRW(info.TotalAmount),
	}, []kakao.Button{
		kakao.WebLinkButton("주문 확인하기", s.frontURL+"/mypage?tab=orders"),
	})

	// Telegram (운영)
	go s.safeTelegram(fmt.Sprintf("📦 <b>신규 주문</b>\n주문번호: %s\n금액: %s원", info.OrderCode, email.FormatKRW(info.TotalAmount)))
}

// PaymentConfirmed dispatches notifications when payment is confirmed.
// Channels: email (영수증) + kakao (알림톡)
func (s *Service) PaymentConfirmed(info OrderInfo) {
	// Email (영수증)
	go s.safeEmail(func() error {
		return s.email.SendPaymentReceipt(info.UserEmail, info.UserName, info.OrderCode, info.Items, info.TotalAmount, info.PaymentMethod)
	})

	// Kakao Alimtalk
	go s.safeKakao(info.UserPhone, "PAYMENT_CONFIRMED", map[string]string{
		"orderCode": info.OrderCode,
		"amount":    email.FormatKRW(info.TotalAmount),
	}, []kakao.Button{
		kakao.WebLinkButton("영수증 확인", s.frontURL+"/mypage?tab=orders"),
	})
}

// DeliveryComplete dispatches notifications when PINs are issued.
// Channels: email (PIN 목록) + kakao (알림톡)
func (s *Service) DeliveryComplete(orderCode, userName, userEmail, userPhone string, pins []PinItem) {
	// Email (PIN 목록)
	emailPins := make([]email.PinInfo, len(pins))
	for i, p := range pins {
		emailPins[i] = email.PinInfo{ProductName: p.ProductName, PinCode: p.PinCode}
	}
	go s.safeEmail(func() error {
		return s.email.SendDeliveryComplete(userEmail, userName, orderCode, emailPins, s.frontURL)
	})

	// Kakao Alimtalk
	go s.safeKakao(userPhone, "PIN_ISSUED", map[string]string{
		"orderCode": orderCode,
		"pinCount":  fmt.Sprintf("%d", len(pins)),
	}, []kakao.Button{
		kakao.WebLinkButton("PIN 확인하기", s.frontURL+"/mypage?tab=orders"),
	})
}

// OrderCancelled dispatches notifications when an order is cancelled.
// Channels: email + kakao + telegram
func (s *Service) OrderCancelled(info OrderInfo) {
	go s.safeEmail(func() error {
		body := fmt.Sprintf("%s님, 주문이 취소되었습니다.\n\n주문번호: %s\n금액: %s원",
			html.EscapeString(info.UserName), html.EscapeString(info.OrderCode), email.FormatKRW(info.TotalAmount))
		return s.email.Send(info.UserEmail, s.emailSubject("주문 취소 안내"), email.WrapLayout("주문이 취소되었습니다", body))
	})

	go s.safeKakao(info.UserPhone, "ORDER_CANCELLED", map[string]string{
		"orderCode": info.OrderCode,
		"amount":    email.FormatKRW(info.TotalAmount),
	}, nil)

	go s.safeTelegram(fmt.Sprintf("❌ <b>주문 취소</b>\n주문번호: %s\n금액: %s원", info.OrderCode, email.FormatKRW(info.TotalAmount)))
}

// TradeInSubmitted dispatches notifications when a trade-in is requested.
// Channels: email + kakao + telegram
func (s *Service) TradeInSubmitted(info TradeInInfo) {
	go s.safeEmail(func() error {
		return s.email.SendTradeInConfirmation(info.UserEmail, info.UserName, info.ProductName, info.Quantity, info.PayoutAmount)
	})

	go s.safeKakao(info.UserPhone, "TRADEIN_SUBMITTED", map[string]string{
		"productName": info.ProductName,
		"quantity":    fmt.Sprintf("%d", info.Quantity),
		"payout":     email.FormatKRW(info.PayoutAmount),
	}, nil)

	go s.safeTelegram(fmt.Sprintf("💰 <b>매입 신청</b>\n상품: %s x %d매\n정산예정: %s원",
		info.ProductName, info.Quantity, email.FormatKRW(info.PayoutAmount)))
}

// TradeInPaid dispatches notifications when trade-in payout is complete.
// Channels: email + kakao
func (s *Service) TradeInPaid(info TradeInInfo) {
	go s.safeEmail(func() error {
		body := fmt.Sprintf("%s님, 매입 정산이 완료되었습니다.\n\n상품: %s x %d매\n정산금액: %s원\n\n등록된 계좌로 입금 처리되었습니다.",
			html.EscapeString(info.UserName), html.EscapeString(info.ProductName), info.Quantity, email.FormatKRW(info.PayoutAmount))
		return s.email.Send(info.UserEmail, s.emailSubject("매입 정산 완료"), email.WrapLayout("매입 정산이 완료되었습니다", body))
	})

	go s.safeKakao(info.UserPhone, "TRADEIN_PAID", map[string]string{
		"productName": info.ProductName,
		"payout":      email.FormatKRW(info.PayoutAmount),
	}, nil)
}

// Welcome dispatches a welcome notification after registration.
// Channels: email + kakao
func (s *Service) Welcome(userName, userEmail, userPhone string) {
	go s.safeEmail(func() error {
		body := fmt.Sprintf("%s님, %s에 오신 것을 환영합니다!\n\n상품권 할인 구매부터 판매까지, %s에서 시작하세요.",
			html.EscapeString(userName), s.sn(), s.sn())
		return s.email.Send(userEmail, s.emailSubject("회원가입을 환영합니다"), email.WrapLayout("환영합니다!", body))
	})

	go s.safeKakao(userPhone, "WELCOME", map[string]string{
		"userName": userName,
	}, []kakao.Button{
		kakao.WebLinkButton("상품 둘러보기", s.frontURL+"/products"),
	})
}

// ============================================================
// Internal helpers
// ============================================================

func (s *Service) safeEmail(fn func() error) {
	if s.email == nil {
		return
	}
	if s.channelChecker != nil && !s.channelChecker.IsChannelEnabled("EMAIL") {
		return
	}
	if err := fn(); err != nil {
		logger.Log.Error("notification: email failed", zap.Error(err))
	}
}

func (s *Service) safeKakao(phone, templateCode string, vars map[string]string, buttons []kakao.Button) {
	if s.kakao == nil || !s.kakao.IsEnabled() || phone == "" {
		return
	}
	if s.channelChecker != nil && !s.channelChecker.IsChannelEnabled("KAKAO") {
		return
	}
	// kakao.Button → kakao.alimtalkButton 변환은 클라이언트 내부에서 처리
	if err := s.kakao.SendAlimtalk(phone, templateCode, vars, buttons); err != nil {
		logger.Log.Error("notification: kakao failed", zap.Error(err), zap.String("template", templateCode))
	}
}

func (s *Service) safeTelegram(msg string) {
	if s.tgToken == "" || s.tgChatID == "" {
		return
	}
	if s.channelChecker != nil && !s.channelChecker.IsChannelEnabled("TELEGRAM") {
		return
	}
	if err := telegram.SendAlert(s.tgToken, s.tgChatID, msg); err != nil {
		logger.Log.Error("notification: telegram failed", zap.Error(err))
	}
}
