// Package email provides SMTP-based email sending for transactional notifications.
// Templates use responsive table-based HTML for broad email client compatibility.
package email

import (
	"fmt"
	"html"
	"net/smtp"
	"regexp"
	"strings"
	"time"

	"seedream-gift-server/internal/config"
	"seedream-gift-server/pkg/logger"

	"go.uber.org/zap"
)

// emailRegex는 기본적인 이메일 형식 검증용 정규식입니다.
var emailRegex = regexp.MustCompile(`^[^\s@]+@[^\s@]+\.[^\s@]+$`)

// font is the shared font-family stack (declared once, used everywhere).
const font = `'Pretendard',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif`

// Service handles email sending via SMTP.
type Service struct {
	cfg *config.Config
}

// NewService creates a new email service.
func NewService(cfg *config.Config) *Service {
	return &Service{cfg: cfg}
}

// IsEnabled returns whether email sending is configured and enabled.
func (s *Service) IsEnabled() bool {
	return s.cfg.SMTPEnabled && s.cfg.SMTPHost != "" && s.cfg.SMTPUser != ""
}

// prefix returns email subject prefix like "[W기프트]"
// Prefix returns email subject prefix like "[W기프트] "
func (s *Service) Prefix() string {
	name := s.cfg.SiteName
	if name == "" {
		name = "W기프트"
	}
	return "[" + name + "] "
}

func sanitizeHeader(s string) string {
	s = strings.ReplaceAll(s, "\r", "")
	s = strings.ReplaceAll(s, "\n", "")
	return s
}

// Send sends an email with the given subject and HTML body.
func (s *Service) Send(to, subject, htmlBody string) error {
	if !s.IsEnabled() {
		logger.Log.Warn("email not sent: SMTP disabled", zap.String("to", to), zap.String("subject", subject))
		return nil
	}

	to = strings.TrimSpace(to)
	if to == "" {
		logger.Log.Warn("email not sent: empty recipient", zap.String("subject", subject))
		return nil
	}
	if !emailRegex.MatchString(to) {
		logger.Log.Warn("email not sent: invalid recipient format", zap.String("to", to), zap.String("subject", subject))
		return nil
	}

	to = sanitizeHeader(to)
	subject = sanitizeHeader(subject)

	from := s.cfg.SMTPFrom
	fromName := s.cfg.SMTPFromName
	// envelope sender는 인증 계정(SMTP_USER)을 사용 — Gmail SMTP Relay 호환
	envelopeSender := s.cfg.SMTPUser
	replyTo := s.cfg.CsEmail
	if replyTo == "" {
		replyTo = from
	}
	addr := fmt.Sprintf("%s:%d", s.cfg.SMTPHost, s.cfg.SMTPPort)

	headers := []string{
		fmt.Sprintf("From: %s <%s>", fromName, from),
		fmt.Sprintf("Reply-To: %s", replyTo),
		fmt.Sprintf("To: %s", to),
		fmt.Sprintf("Subject: %s", subject),
		"MIME-Version: 1.0",
		"Content-Type: text/html; charset=UTF-8",
	}
	msg := []byte(strings.Join(headers, "\r\n") + "\r\n\r\n" + htmlBody)

	auth := smtp.PlainAuth("", s.cfg.SMTPUser, s.cfg.SMTPPassword, s.cfg.SMTPHost)

	if err := smtp.SendMail(addr, auth, envelopeSender, []string{to}, msg); err != nil {
		logger.Log.Error("failed to send email", zap.String("to", to), zap.String("subject", subject), zap.Error(err))
		return fmt.Errorf("email send failed: %w", err)
	}

	logger.Log.Info("email sent", zap.String("to", to), zap.String("subject", subject))
	return nil
}

// ============================================================
// Layout — Responsive Email Template
// ============================================================

func (s *Service) layout(title, body string) string {
	csEmail := s.cfg.CsEmail
	if csEmail == "" {
		csEmail = "cs@voucherfactory.kr"
	}
	siteName := s.cfg.SiteName
	if siteName == "" {
		siteName = "W기프트"
	}
	siteDomain := s.cfg.SiteDomain
	if siteDomain == "" {
		siteDomain = "voucherfactory.kr"
	}
	companyName := s.cfg.CompanyName
	if companyName == "" {
		companyName = "주식회사 바우처팩토리"
	}
	companyLicense := s.cfg.CompanyLicenseNo
	if companyLicense == "" {
		companyLicense = "841-88-04007"
	}
	companyOwner := s.cfg.CompanyOwner
	if companyOwner == "" {
		companyOwner = "고정희"
	}
	year := time.Now().Year()
	result := fmt.Sprintf(`<!DOCTYPE html>
<html lang="ko" xmlns:v="urn:schemas-microsoft-com:vml">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<meta name="color-scheme" content="light">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
<style>
  /* Reset */
  body,table,td,p,a,li{-webkit-text-size-adjust:100%%;-ms-text-size-adjust:100%%}
  table,td{mso-table-lspace:0;mso-table-rspace:0}
  img{-ms-interpolation-mode:bicubic;border:0;outline:none;text-decoration:none}
  /* Base */
  body{margin:0;padding:0;width:100%% !important;background:#f0f2f5;font-family:%s}
  .card{max-width:600px;width:100%% !important;background:#ffffff;border-radius:16px;overflow:hidden}
  /* Responsive */
  @media only screen and (max-width:639px){
    .outer-pad{padding:16px 8px 32px !important}
    .card{border-radius:12px !important}
    .hdr-pad{padding:20px 20px 16px !important}
    .hdr-domain{display:none !important}
    .title-pad{padding:24px 20px 0 !important}
    .title{font-size:19px !important}
    .body-pad{padding:16px 20px 28px !important}
    .badge-pad{padding:0 20px !important}
    .ftr-pad{padding:20px 20px 24px !important}
    .info-card{border-radius:10px !important}
    .info-card-pad{padding:16px 16px !important}
    .info-label{font-size:12px !important}
    .info-value{font-size:13px !important}
    .amount-value{font-size:15px !important}
    .cta-btn{padding:13px 24px !important;font-size:14px !important;border-radius:10px !important;display:block !important;text-align:center !important}
    .receipt-hdr,.receipt-cell{padding:6px 4px !important;font-size:12px !important}
    .pin-name,.pin-code{padding:8px 10px !important}
    .pin-code{font-size:13px !important;letter-spacing:0.04em !important}
    .p-text{font-size:13px !important}
    .hint-text{font-size:11px !important}
    .ftr-text{font-size:10px !important}
  }
</style>
</head>
<body>
<table width="100%%" cellpadding="0" cellspacing="0" role="presentation" style="background:#f0f2f5;">
<tr><td class="outer-pad" style="padding:32px 16px 48px;" align="center">

<table class="card" width="600" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px;width:100%%;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.06);">

  <!-- Header -->
  <tr><td style="background:linear-gradient(135deg,#3182f6 0%%,#1b64da 50%%,#194aa6 100%%);">
    <table width="100%%" cellpadding="0" cellspacing="0" role="presentation">
    <tr>
      <td class="hdr-pad" style="padding:24px 32px 20px;">
        <table cellpadding="0" cellspacing="0" role="presentation"><tr>
          <td style="width:28px;height:28px;background:#fff;border-radius:8px;text-align:center;vertical-align:middle;font-size:14px;font-weight:900;color:#3182f6;line-height:28px;font-family:%s;">W</td>
          <td style="padding-left:8px;font-size:15px;font-weight:800;color:#fff;letter-spacing:-0.02em;font-family:%s;">W기프트</td>
        </tr></table>
      </td>
      <td class="hdr-pad hdr-domain" style="padding:24px 32px 20px;text-align:right;">
        <span style="font-size:11px;color:rgba(255,255,255,0.45);font-family:%s;">wowgift.co.kr</span>
      </td>
    </tr>
    </table>
  </td></tr>

  <!-- Title -->
  <tr><td class="title-pad" style="padding:28px 32px 0;">
    <h1 class="title" style="margin:0;font-size:20px;font-weight:800;color:#191f28;letter-spacing:-0.03em;line-height:1.4;font-family:%s;word-break:keep-all;">%s</h1>
  </td></tr>

  <!-- Body -->
  <tr><td class="body-pad" style="padding:16px 32px 32px;">
    %s
  </td></tr>

  <!-- Security badge -->
  <tr><td class="badge-pad" style="padding:0 32px;">
    <table width="100%%" cellpadding="0" cellspacing="0" role="presentation" style="background:#f8f9fa;border-radius:10px;">
    <tr><td style="padding:12px 16px;font-size:11px;color:#8b95a1;font-family:%s;">
      &#128274; 이 이메일은 W기프트에서 자동 발송된 보안 메일입니다
    </td></tr>
    </table>
  </td></tr>

  <!-- Footer -->
  <tr><td class="ftr-pad" style="padding:24px 32px 28px;">
    <table width="100%%" cellpadding="0" cellspacing="0" role="presentation" style="border-top:1px solid #eef0f3;">
    <tr><td style="padding-top:16px;">
      <p class="ftr-text" style="font-size:11px;color:#b0b8c1;margin:0;line-height:1.7;font-family:%s;">
        <strong style="color:#8b95a1;">주식회사 더블유에이아이씨</strong><br>
        사업자등록번호 731-87-02461 &middot; 대표 권학재<br>
        <a href="mailto:%s" style="color:#3182f6;text-decoration:none;">%s</a> &middot; 02-569-7334
      </p>
      <p style="font-size:10px;color:#d1d6db;margin:8px 0 0;font-family:%s;">&copy; %d W기프트</p>
    </td></tr>
    </table>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`, font, font, font, font, font, title, body, font, font, csEmail, csEmail, font, year)

	// 사업자 정보 치환 (하드코딩 제거)
	result = strings.ReplaceAll(result, "W기프트", siteName)
	result = strings.ReplaceAll(result, "wowgift.co.kr", siteDomain)
	result = strings.ReplaceAll(result, "주식회사 더블유에이아이씨", companyName)
	result = strings.ReplaceAll(result, "731-87-02461", companyLicense)
	result = strings.ReplaceAll(result, "권학재", companyOwner)
	return result
}

// ============================================================
// Reusable Components
// ============================================================

func infoCard(accentColor, bgColor string, rows string) string {
	return fmt.Sprintf(`<table class="info-card" width="100%%" cellpadding="0" cellspacing="0" role="presentation" style="background:%s;border-radius:12px;border-left:4px solid %s;margin:16px 0;">
<tr><td class="info-card-pad" style="padding:18px 20px;">
  <table width="100%%" cellpadding="0" cellspacing="0" role="presentation">
    %s
  </table>
</td></tr>
</table>`, bgColor, accentColor, rows)
}

func infoRow(label, value, valueColor string) string {
	if valueColor == "" {
		valueColor = "#191f28"
	}
	return fmt.Sprintf(`<tr>
<td class="info-label" style="padding:5px 0;color:#8b95a1;font-size:13px;font-family:%s;white-space:nowrap;">%s</td>
<td class="info-value" style="padding:5px 0;text-align:right;font-weight:700;color:%s;font-size:14px;font-family:%s;word-break:break-all;">%s</td>
</tr>`, font, html.EscapeString(label), valueColor, font, html.EscapeString(value))
}

func amountRow(label, amount, color string) string {
	return fmt.Sprintf(`<tr>
<td class="info-label" style="padding:6px 0;color:#8b95a1;font-size:13px;font-family:%s;">%s</td>
<td class="amount-value" style="padding:6px 0;text-align:right;font-weight:800;color:%s;font-size:17px;letter-spacing:-0.02em;font-variant-numeric:tabular-nums;font-family:%s;">%s</td>
</tr>`, font, html.EscapeString(label), color, font, html.EscapeString(amount))
}

func ctaButton(href, label string) string {
	return fmt.Sprintf(`<div style="text-align:center;margin:24px 0 8px;">
<!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" href="%s" style="height:48px;v-text-anchor:middle;width:240px;" arcsize="29%%" fill="true" stroke="false"><v:fill type="gradient" color="#3182f6" color2="#2272eb" angle="135"/><v:textbox inset="0,0,0,0"><center style="color:#fff;font-size:15px;font-weight:700;">%s</center></v:textbox></v:roundrect><![endif]-->
<!--[if !mso]><!-->
<a class="cta-btn" href="%s" target="_blank" style="display:inline-block;padding:14px 40px;background:#3182f6;color:#ffffff;text-decoration:none;border-radius:12px;font-size:15px;font-weight:700;letter-spacing:-0.01em;font-family:%s;mso-hide:all;">%s</a>
<!--<![endif]-->
</div>`, href, label, href, font, label)
}

func paragraph(text string) string {
	return fmt.Sprintf(`<p class="p-text" style="font-size:14px;line-height:1.7;color:#4e5968;margin:0 0 14px;font-family:%s;word-break:keep-all;">%s</p>`, font, text)
}

func hint(text string) string {
	return fmt.Sprintf(`<p class="hint-text" style="font-size:12px;color:#8b95a1;line-height:1.6;margin:10px 0 0;font-family:%s;word-break:keep-all;">%s</p>`, font, text)
}

func divider() string {
	return `<table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr><td style="padding:6px 0;"><div style="border-top:1px solid #f2f4f6;"></div></td></tr></table>`
}

// ============================================================
// Data Types
// ============================================================

// ReceiptItem represents a line item in a receipt email.
type ReceiptItem struct {
	ProductName string
	Quantity    int
	UnitPrice   int
	Subtotal    int
}

// PinInfo represents a voucher PIN for email notification.
type PinInfo struct {
	ProductName string
	PinCode     string // masked: "1234-****-****"
}

// ============================================================
// 1. Password Reset
// ============================================================

func (s *Service) SendPasswordReset(to, token, frontendURL string) error {
	resetLink := fmt.Sprintf("%s/reset-password?token=%s", frontendURL, token)

	body := paragraph("비밀번호 재설정을 요청하셨습니다.<br>아래 버튼을 클릭하여 이메일과 새 비밀번호를 입력해주세요.") +
		ctaButton(resetLink, "비밀번호 재설정하기") +
		hint("&#9888;&#65039; 본인이 요청하지 않으셨다면 이 메일을 무시해주세요.<br>보안을 위해 이 링크는 <strong>15분간</strong> 유효합니다.")

	return s.Send(to, s.Prefix() + "비밀번호 재설정 안내", s.layout("비밀번호를 재설정해주세요", body))
}

// ============================================================
// 2. Order Confirmation
// ============================================================

func (s *Service) SendOrderConfirmation(to, userName, orderCode string, totalAmount int) error {
	body := paragraph(fmt.Sprintf("<strong>%s</strong>님, 주문이 정상적으로 접수되었습니다.", html.EscapeString(userName))) +
		infoCard("#3182f6", "#f0f4ff",
			infoRow("주문번호", orderCode, "")+
				amountRow("결제 금액", FormatKRW(totalAmount)+"원", "#3182f6")) +
		paragraph("입금 확인 후 자동으로 처리됩니다.")

	return s.Send(to, s.Prefix() + "주문 접수 완료", s.layout("주문이 접수되었습니다", body))
}

// ============================================================
// 3. Payment Receipt
// ============================================================

func (s *Service) SendPaymentReceipt(to, userName, orderCode string, items []ReceiptItem, totalAmount int, paymentMethod string) error {
	var itemRows strings.Builder
	for _, item := range items {
		fmt.Fprintf(&itemRows, `<tr>
<td class="receipt-cell" style="padding:8px 0;font-size:13px;color:#191f28;border-bottom:1px solid #f2f4f6;font-family:%s;">%s</td>
<td class="receipt-cell" style="padding:8px 0;font-size:13px;color:#6b7684;text-align:center;border-bottom:1px solid #f2f4f6;font-family:%s;">%d매</td>
<td class="receipt-cell" style="padding:8px 0;font-size:13px;color:#191f28;text-align:right;font-weight:600;border-bottom:1px solid #f2f4f6;font-variant-numeric:tabular-nums;font-family:%s;">%s원</td>
</tr>`, font, html.EscapeString(item.ProductName), font, item.Quantity, font, FormatKRW(item.Subtotal))
	}

	receiptTable := fmt.Sprintf(`<table width="100%%" cellpadding="0" cellspacing="0" role="presentation" style="margin:16px 0;">
<tr style="border-bottom:2px solid #e5e8eb;">
  <td class="receipt-hdr" style="padding:6px 0;font-size:11px;font-weight:700;color:#8b95a1;letter-spacing:0.05em;">상품</td>
  <td class="receipt-hdr" style="padding:6px 0;font-size:11px;font-weight:700;color:#8b95a1;text-align:center;letter-spacing:0.05em;">수량</td>
  <td class="receipt-hdr" style="padding:6px 0;font-size:11px;font-weight:700;color:#8b95a1;text-align:right;letter-spacing:0.05em;">금액</td>
</tr>
%s
</table>`, itemRows.String())

	pm := paymentMethod
	if pm == "" {
		pm = "무통장입금"
	}

	body := paragraph(fmt.Sprintf("<strong>%s</strong>님, 결제가 완료되었습니다.", html.EscapeString(userName))) +
		infoCard("#3182f6", "#f0f4ff",
			infoRow("주문번호", orderCode, "")+
				infoRow("결제일시", time.Now().Format("2006-01-02 15:04"), "")+
				infoRow("결제수단", pm, "")) +
		receiptTable +
		infoCard("#3182f6", "#f0f4ff",
			amountRow("결제 합계", FormatKRW(totalAmount)+"원", "#3182f6")) +
		hint("마이페이지에서 주문 상세 내역을 확인하실 수 있습니다.")

	return s.Send(to, s.Prefix() + "결제 완료 영수증", s.layout("결제가 완료되었습니다", body))
}

// ============================================================
// 4. Delivery Complete — PIN Issued
// ============================================================

func (s *Service) SendDeliveryComplete(to, userName, orderCode string, pins []PinInfo, frontendURL string) error {
	var pinRows strings.Builder
	for i, pin := range pins {
		bg := "#ffffff"
		if i%2 == 1 {
			bg = "#fafbfc"
		}
		fmt.Fprintf(&pinRows, `<tr style="background:%s;">
<td class="pin-name" style="padding:10px 14px;font-size:13px;color:#191f28;font-family:%s;">%s</td>
<td class="pin-code" style="padding:10px 14px;font-size:14px;font-weight:700;color:#3182f6;text-align:right;font-family:'SF Mono','Fira Code','Courier New',monospace;letter-spacing:0.06em;word-break:break-all;">%s</td>
</tr>`, bg, font, html.EscapeString(pin.ProductName), html.EscapeString(pin.PinCode))
	}

	pinTable := fmt.Sprintf(`<table width="100%%" cellpadding="0" cellspacing="0" role="presentation" style="border:1px solid #e5e8eb;border-radius:12px;overflow:hidden;margin:16px 0;">
<tr style="background:#f2f4f6;">
  <td style="padding:8px 14px;font-size:11px;font-weight:700;color:#8b95a1;letter-spacing:0.05em;">상품</td>
  <td style="padding:8px 14px;font-size:11px;font-weight:700;color:#8b95a1;text-align:right;letter-spacing:0.05em;">PIN 번호</td>
</tr>
%s
</table>`, pinRows.String())

	body := paragraph(fmt.Sprintf("<strong>%s</strong>님, 주문하신 상품의 PIN이 발급되었습니다.", html.EscapeString(userName))) +
		infoCard("#03b26c", "#f0faf6",
			infoRow("주문번호", orderCode, "")+
				infoRow("발급일시", time.Now().Format("2006-01-02 15:04"), "")+
				infoRow("발급 수량", fmt.Sprintf("%d건", len(pins)), "#03b26c")) +
		pinTable +
		ctaButton(frontendURL+"/mypage", "마이페이지에서 확인") +
		hint("&#128274; PIN 번호는 보안을 위해 일부 마스킹되어 있습니다.<br>전체 PIN은 마이페이지에서 확인해주세요.")

	return s.Send(to, s.Prefix() + "PIN 발급 완료", s.layout("PIN이 발급되었습니다", body))
}

// ============================================================
// 5. Business Inquiry Notification
// ============================================================

func (s *Service) SendBusinessInquiryNotification(adminEmail string, companyName, businessRegNo, businessOpenDate, repName, contactName, emailAddr, phone, category, message string) error {
	body := paragraph("새로운 파트너 제휴 문의가 접수되었습니다.") +
		infoCard("#6b7684", "#f8f9fa",
			infoRow("회사명", companyName, "")+
				infoRow("사업자등록번호", businessRegNo, "")+
				infoRow("개업일자", businessOpenDate, "")+
				infoRow("대표자", repName, "")+
				infoRow("담당자", contactName, "")+
				infoRow("이메일", emailAddr, "#3182f6")+
				infoRow("연락처", phone, "")+
				infoRow("문의 유형", category, "")) +
		divider() +
		paragraph("<strong>문의 내용</strong>") +
		paragraph(html.EscapeString(message))

	return s.Send(adminEmail, s.Prefix() + "파트너 제휴 문의 접수", s.layout("파트너 제휴 문의가 접수되었습니다", body))
}

// ============================================================
// 6. Trade-In Confirmation
// ============================================================

func (s *Service) SendTradeInConfirmation(to, userName, productName string, quantity int, payoutAmount int) error {
	body := paragraph(fmt.Sprintf("<strong>%s</strong>님, 상품권 판매 신청이 접수되었습니다.", html.EscapeString(userName))) +
		infoCard("#03b26c", "#f0faf6",
			infoRow("상품", fmt.Sprintf("%s × %d매", html.EscapeString(productName), quantity), "")+
				amountRow("예상 정산액", FormatKRW(payoutAmount)+"원", "#03b26c")) +
		paragraph("상품권 수령 확인 후 영업일 1~2일 내에 등록된 계좌로 입금됩니다.") +
		hint("&#128176; 정산 완료 시 별도의 이메일이 발송됩니다.")

	return s.Send(to, s.Prefix() + "판매 신청 접수 완료", s.layout("판매 신청이 접수되었습니다", body))
}

// ============================================================
// Utility
// ============================================================

// WrapLayout wraps simple text content in the standard email layout.
// standalone 버전 — notification 서비스에서 사용 (cs@ 이메일은 기본값 사용)
func WrapLayout(title, body string) string {
	s := &Service{cfg: &config.Config{CsEmail: "cs@wowgift.co.kr"}}
	return s.layout(title, paragraph(body))
}

// SendDeployNotification은 시스템 배포 완료 알림 이메일을 발송합니다.
func (s *Service) SendDeployNotification(to, deployTime string) error {
	body := paragraph("W기프트 시스템 배포가 완료되었습니다.") +
		infoCard("#3182f6", "#f0f4ff",
			infoRow("배포 시각", deployTime, "")+
				infoRow("서비스", "W기프트 (wowgift.co.kr)", "#3182f6")+
				infoRow("환경", "Production", "")+
				infoRow("상태", "정상 운영 중", "#03b26c")) +
		divider() +
		paragraph("모든 서비스가 정상적으로 배포되었습니다.")

	return s.Send(to, s.Prefix() + "시스템 배포 완료 알림", s.layout("시스템 배포 완료", body))
}

// FormatKRW formats an integer as Korean Won with comma separators.
func FormatKRW(amount int) string {
	s := fmt.Sprintf("%d", amount)
	n := len(s)
	if n <= 3 {
		return s
	}
	var result strings.Builder
	for i, c := range s {
		if i > 0 && (n-i)%3 == 0 {
			result.WriteByte(',')
		}
		result.WriteRune(c)
	}
	return result.String()
}
