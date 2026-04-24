package domain

import (
	"errors"
	"fmt"
	"regexp"
	"strings"

	"github.com/shopspring/decimal"
)

// ── 공통 검증 로직 ──

var emailRegex = regexp.MustCompile(`^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$`)

// ValidRoles는 시스템에서 허용하는 사용자 권한의 집합입니다.
var ValidRoles = map[string]bool{"USER": true, "PARTNER": true, "ADMIN": true}

// ValidKycStatuses는 사용자의 본인인증(KYC) 상태의 집합입니다.
var ValidKycStatuses = map[string]bool{"NONE": true, "PENDING": true, "VERIFIED": true, "REJECTED": true}

// ── 주문 상태 상수 ──

const (
	OrderStatusPending        = "PENDING"
	OrderStatusIssued         = "ISSUED" // Seedream: 은행선택 완료, 입금 대기
	OrderStatusPaid           = "PAID"
	OrderStatusDelivered      = "DELIVERED"
	OrderStatusCompleted      = "COMPLETED"
	OrderStatusCancelled      = "CANCELLED"
	OrderStatusRefunded       = "REFUNDED"
	OrderStatusRefundPaid     = "REFUND_PAID"     // Seedream: 환불 VA에 실제 입금 확인
	OrderStatusExpired        = "EXPIRED"         // Seedream: depositEndDate 만료
	OrderStatusAmountMismatch = "AMOUNT_MISMATCH" // Seedream: 입금액 ≠ 주문액 (Reconcile 감지)
)

// ── 바우처 상태 상수 ──

const (
	VoucherStatusAvailable = "AVAILABLE"
	VoucherStatusSold      = "SOLD"
	VoucherStatusUsed      = "USED"
	VoucherStatusExpired   = "EXPIRED"
)

// ── Seedream Payment Phase 상수 ──
// Payment.SeedreamPhase 에 저장되는 값. Seedream 통합 가이드 §5 참조.
const (
	SeedreamPhaseAwaitingBankSelection = "awaiting_bank_selection"
	SeedreamPhaseAwaitingDeposit       = "awaiting_deposit"
	SeedreamPhaseCompleted             = "completed"
	SeedreamPhaseCancelled             = "cancelled"
	SeedreamPhaseFailed                = "failed"
	SeedreamPhaseRefunded              = "refunded"    // Phase 4
	SeedreamPhaseRefundPaid            = "refund_paid" // Phase 4
)

// phoneRegex는 한국 휴대전화 번호 형식 (하이픈 유무 무관)
var phoneRegex = regexp.MustCompile(`^01[016789]\d{7,8}$`)

// ValidatePhone은 전화번호 형식이 유효한지 검증합니다.
func ValidatePhone(phone string) error {
	if phone == "" {
		return nil // 전화번호는 선택 사항
	}
	// 하이픈 제거 후 검증
	cleaned := strings.ReplaceAll(phone, "-", "")
	if !phoneRegex.MatchString(cleaned) {
		return errors.New("유효하지 않은 전화번호 형식입니다 (01X-XXXX-XXXX)")
	}
	return nil
}

// ValidateEmail은 이메일 형식이 유효한지 검증합니다.
func ValidateEmail(email string) error {
	if email == "" {
		return errors.New("이메일을 입력해주세요")
	}
	if !emailRegex.MatchString(email) {
		return errors.New("유효하지 않은 이메일 형식입니다")
	}
	return nil
}

// ValidatePassword는 비밀번호의 최소/최대 길이 및 복잡도 규칙을 검증합니다.
// bcrypt는 72바이트 이후 입력을 무시하므로 최대 72자로 제한합니다.
func ValidatePassword(password string) error {
	if len(password) < 8 {
		return errors.New("비밀번호는 최소 8자 이상이어야 합니다")
	}
	if len(password) > 72 {
		return errors.New("비밀번호는 최대 72자까지 가능합니다")
	}
	var hasLetter, hasDigit, hasSpecial bool
	for _, c := range password {
		switch {
		case (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z'):
			hasLetter = true
		case c >= '0' && c <= '9':
			hasDigit = true
		default:
			hasSpecial = true
		}
	}
	if !hasLetter {
		return errors.New("비밀번호에 영문자가 포함되어야 합니다")
	}
	if !hasDigit {
		return errors.New("비밀번호에 숫자가 포함되어야 합니다")
	}
	if !hasSpecial {
		return errors.New("비밀번호에 특수문자가 포함되어야 합니다")
	}
	return nil
}

// ValidateRole은 사용자 권한이 정의된 범위 내에 있는지 확인합니다.
func ValidateRole(role string) error {
	if !ValidRoles[role] {
		return fmt.Errorf("유효하지 않은 권한: %s (허용: USER, PARTNER, ADMIN)", role)
	}
	return nil
}

// ValidateKycStatus는 KYC 상태값이 정의된 범위 내에 있는지 확인합니다.
func ValidateKycStatus(status string) error {
	if !ValidKycStatuses[status] {
		return fmt.Errorf("유효하지 않은 KYC 상태: %s (허용: NONE, PENDING, VERIFIED, REJECTED)", status)
	}
	return nil
}

// ── 브랜드 검증 ──

var brandCodeRegex = regexp.MustCompile(`^[A-Z][A-Z0-9_]{1,19}$`)

// ValidateBrandCreate는 브랜드 생성 시 필요한 필수 필드 및 코드 형식을 검증합니다.
func ValidateBrandCreate(b *Brand) error {
	if b.Code == "" {
		return errors.New("인증 코드를 입력해주세요")
	}
	// 브랜드 코드는 대문자 영문으로 시작하며, 식별자로 사용되기에 적합한 형식이어야 합니다.
	if !brandCodeRegex.MatchString(b.Code) {
		return errors.New("코드는 대문자 영문 및 숫자로 구성되어야 합니다 (2-20자, 예: SHINSEGAE)")
	}
	if b.Name == "" {
		return errors.New("브랜드 이름을 입력해주세요")
	}
	// 색상 코드가 제공된 경우 헥사(Hex) 형식인지 확인합니다.
	if b.Color != nil && *b.Color != "" {
		c := strings.ToLower(*b.Color)
		if matched, _ := regexp.MatchString(`^#[0-9a-f]{6}$`, c); !matched {
			return errors.New("색상은 Hex 형식이어야 합니다 (예: #FF5733)")
		}
	}
	return nil
}

// ── 상품 검증 ──

// ValidateProductCreate는 상품 등록 시 필수 정보 및 수치의 유효 범위를 확인합니다.
func ValidateProductCreate(p *Product) error {
	if p.BrandCode == "" {
		return errors.New("브랜드 코드는 필수입니다")
	}
	if p.Name == "" {
		return errors.New("상품명은 필수입니다")
	}
	if p.Price.Decimal.LessThanOrEqual(decimal.Zero) {
		return errors.New("가격은 0보다 커야 합니다")
	}
	// 할인율 및 매입율은 0~100 사이의 퍼센트 값이어야 합니다.
	if err := validateRate("할인율", p.DiscountRate.Decimal); err != nil {
		return err
	}
	if err := validateRate("매입율", p.TradeInRate.Decimal); err != nil {
		return err
	}
	if p.FulfillmentType != "" && !ValidFulfillmentTypes[p.FulfillmentType] {
		return fmt.Errorf("유효하지 않은 발급 방식: %s", p.FulfillmentType)
	}
	if p.FulfillmentType == "API" && (p.ProviderCode == nil || *p.ProviderCode == "") {
		return errors.New("API 발급 상품은 제공업체 코드(ProviderCode)가 필수입니다")
	}
	return nil
}

// CalculateBuyPrice는 정가와 할인율을 바탕으로 실제 판매가(BuyPrice)를 계산합니다.
// 계산식: BuyPrice = Price × (1 - DiscountRate/100)
func CalculateBuyPrice(p *Product) {
	hundred := decimal.NewFromInt(100)
	p.BuyPrice = NewNumericDecimal(
		p.Price.Decimal.Mul(hundred.Sub(p.DiscountRate.Decimal)).Div(hundred).Round(0),
	)
}

func validateRate(name string, val decimal.Decimal) error {
	if val.LessThan(decimal.Zero) || val.GreaterThan(decimal.NewFromInt(100)) {
		return fmt.Errorf("%s은(는) 0에서 100 사이여야 합니다", name)
	}
	return nil
}

// ── 주문 상태 머신 ──

// validOrderTransitions는 주문의 상태 흐름(State Machine)을 정의합니다.
// 각 상태에서 전이 가능한 다음 상태를 명시하여 비정상적인 상태 변경을 방지합니다.
var validOrderTransitions = map[string][]string{
	// PENDING: 초기 상태. Seedream 발급 요청 직후 유지 (phase=awaiting_bank_selection).
	// ISSUED 로 넘어가거나, 은행선택 전 취소/만료 가능.
	// "PAID" 직접 전이는 legacy Mock/Toss 플로우 호환용 — Phase 6 에서 제거.
	// "AMOUNT_MISMATCH" 는 ISSUED 경로를 놓친 Reconcile 보정 시에만 발생 (엣지 케이스).
	"PENDING":    {"ISSUED", "PAID", "CANCELLED", "EXPIRED", "AMOUNT_MISMATCH"},
	"FRAUD_HOLD": {"PAID", "CANCELLED"},
	// ISSUED: 은행선택 완료, 입금 대기 (phase=awaiting_deposit).
	// 정상 입금 → PAID, 가맹점 요청 취소 또는 키움 자동 취소 → CANCELLED,
	// 만료 → EXPIRED, 입금액 불일치 → AMOUNT_MISMATCH (웹훅 없이 Reconcile 감지).
	"ISSUED":    {"PAID", "CANCELLED", "EXPIRED", "AMOUNT_MISMATCH"},
	"PAID":      {"DELIVERED", "CANCELLED", "REFUNDED"},
	"DELIVERED": {"COMPLETED"},
	// 아래는 최종 상태.
	"CANCELLED":       {},
	"COMPLETED":       {},
	// REFUNDED: 환불 VA 발행 완료 (vaccount.deposit_canceled 수신). REFUND_PAID 로 전이 가능.
	"REFUNDED":        {"REFUND_PAID"},
	// REFUND_PAID: 환불 VA 에 실제 입금 확인 (deposit_cancel.deposited 수신). 최종 상태.
	"REFUND_PAID":     {},
	"EXPIRED":         {},
	"AMOUNT_MISMATCH": {}, // Ops 수동 처리 대기. 자동 전이 없음.
}

// ValidateOrderTransition은 요청된 주문 상태 변경이 비즈니스 규칙상 허용되는지 검증합니다.
func ValidateOrderTransition(current, next string) error {
	allowed, ok := validOrderTransitions[current]
	if !ok {
		return fmt.Errorf("알 수 없는 주문 상태: %q", current)
	}
	if len(allowed) == 0 {
		return fmt.Errorf("주문이 최종 상태(%q)이므로 상태를 변경할 수 없습니다", current)
	}
	for _, s := range allowed {
		if s == next {
			return nil
		}
	}
	return fmt.Errorf("유효하지 않은 주문 상태 전환: %s → %s", current, next)
}

// ── 바우처 상태 머신 ──

// validVoucherTransitions는 개별 바우처(쿠폰 번호)의 수명 주기를 정의합니다.
var validVoucherTransitions = map[string][]string{
	"AVAILABLE": {"RESERVED", "SOLD", "EXPIRED"}, // 판매 가능 -> 예약됨(장바구니/주문진행), 판매됨, 또는 만료됨
	"RESERVED":  {"SOLD", "AVAILABLE"},           // 예약됨 -> 판매됨 또는 주문 취소 시 다시 판매 가능으로 복구
	"SOLD":      {"USED"},                        // 판매됨 -> 사용됨
	// USED, EXPIRED는 최종 상태
}

// ValidateVoucherTransition은 바우처의 상태 변경 권한을 검증합니다.
func ValidateVoucherTransition(current, next string) error {
	allowed, ok := validVoucherTransitions[current]
	if !ok {
		return fmt.Errorf("바우처가 최종 상태(%q)이므로 상태를 변경할 수 없습니다", current)
	}
	for _, s := range allowed {
		if s == next {
			return nil
		}
	}
	return fmt.Errorf("유효하지 않은 바우처 상태 전환: %s → %s", current, next)
}

// CanDeleteVoucher는 바우처를 시스템에서 삭제할 수 있는 상태인지 확인합니다.
// 판매 중이거나 이미 만료된 경우에만 삭제가 가능하며, 예약/판매/사용된 바우처는 데이터 무결성을 위해 삭제를 금지합니다.
func CanDeleteVoucher(status string) bool {
	return status == "AVAILABLE" || status == "EXPIRED"
}

// ── 매입(Trade-In) 상태 머신 ──

var validTradeInTransitions = map[string][]string{
	"REQUESTED":  {"RECEIVED", "VERIFIED", "REJECTED"},   // 매입 신청 → 수령/검수/반려
	"FRAUD_HOLD": {"REQUESTED", "REJECTED"},              // 사기 보류 → 승인(REQUESTED) 또는 거절(REJECTED)
	"RECEIVED":   {"VERIFIED", "REJECTED"},               // 수령 확인 → 검수/반려
	"VERIFIED":   {"PAID", "REJECTED"},                   // 검수 완료 → 지급/반려
	// PAID, REJECTED는 최종 상태
	"PAID":     {},
	"REJECTED": {},
}

// ValidateTradeInTransition은 매입 신청건의 상태 변경이 허용된 흐름인지 검증합니다.
func ValidateTradeInTransition(current, next string) error {
	allowed, ok := validTradeInTransitions[current]
	if !ok {
		return fmt.Errorf("매입 상태 %q는 최종 상태이거나 정의되지 않았습니다", current)
	}
	if len(allowed) == 0 {
		return fmt.Errorf("매입 처리가 이미 종료된 상태(%q)입니다", current)
	}
	for _, s := range allowed {
		if s == next {
			return nil
		}
	}
	return fmt.Errorf("유효하지 않은 매입 상태 전환: %s → %s", current, next)
}

// ── 상품 승인 상태 검증 ──

// ValidApprovalStatuses는 관리자의 상품 등록 승인 상태 집합입니다.
var ValidApprovalStatuses = map[string]bool{"PENDING": true, "APPROVED": true, "REJECTED": true}

// ValidFulfillmentTypes는 상품의 발급 방식 집합입니다.
var ValidFulfillmentTypes = map[string]bool{"STOCK": true, "API": true}

// ValidateProductApproval은 상품 승인/반려 처리가 가능한 상태인지 확인합니다.
// 대기(PENDING) 상태의 상품만 승인 또는 반려가 가능하며, 반려 시에는 반드시 사유가 입력되어야 합니다.
func ValidateProductApproval(currentStatus, targetStatus, reason string) error {
	if currentStatus != "PENDING" {
		return fmt.Errorf("상품이 이미 %s 상태입니다. 대기 중인 상품만 승인/반려가 가능합니다", currentStatus)
	}
	if targetStatus != "APPROVED" && targetStatus != "REJECTED" {
		return fmt.Errorf("유효하지 않은 승인 상태: %s (허용: APPROVED, REJECTED)", targetStatus)
	}
	if targetStatus == "REJECTED" && strings.TrimSpace(reason) == "" {
		return errors.New("반려 시에는 반드시 사유를 입력해야 합니다")
	}
	return nil
}

// ── 환불 상태 검증 ──

// ValidateRefundApproval은 환불 요청이 처리 가능한 상태인지 확인합니다.
// 이미 승인되었거나 거절된 환불 건은 다시 처리할 수 없습니다.
func ValidateRefundApproval(currentStatus string) error {
	if currentStatus != "REQUESTED" {
		return fmt.Errorf("환불이 이미 %s 상태이므로 승인/거절할 수 없습니다", currentStatus)
	}
	return nil
}

// ── 공지사항 검증 ──

// ValidateNotice는 공지사항 저장 전 필수 항목(제목, 내용) 및 길이 제한을 확인합니다.
func ValidateNotice(n *Notice) error {
	if strings.TrimSpace(n.Title) == "" {
		return errors.New("제목을 입력해주세요")
	}
	if len(n.Title) > 100 {
		return errors.New("제목은 100자 이내로 입력해주세요")
	}
	if strings.TrimSpace(n.Content) == "" {
		return errors.New("내용을 입력해주세요")
	}
	if len([]rune(n.Content)) > 500 {
		return errors.New("내용은 500자 이내로 입력해주세요")
	}
	return nil
}

// ── FAQ 검증 ──

// ValidateFaq는 FAQ 저장 전 필수 항목(질문, 답변, 카테고리)이 채워졌는지 확인합니다.
func ValidateFaq(f *Faq) error {
	if strings.TrimSpace(f.Question) == "" {
		return errors.New("질문을 입력해주세요")
	}
	if strings.TrimSpace(f.Answer) == "" {
		return errors.New("답변을 입력해주세요")
	}
	if strings.TrimSpace(f.Category) == "" {
		return errors.New("카테고리를 입력해주세요")
	}
	return nil
}

// ── 이벤트 검증 ──

// ValidateEvent는 이벤트 기간 설정의 유효성 및 길이 제한을 검증합니다.
func ValidateEvent(e *Event) error {
	if strings.TrimSpace(e.Title) == "" {
		return errors.New("제목을 입력해주세요")
	}
	if len(e.Title) > 100 {
		return errors.New("제목은 100자 이내로 입력해주세요")
	}
	if strings.TrimSpace(e.Description) == "" {
		return errors.New("설명을 입력해주세요")
	}
	if len([]rune(e.Description)) > 500 {
		return errors.New("설명은 500자 이내로 입력해주세요")
	}
	if e.StartDate.IsZero() {
		return errors.New("시작일을 설정해주세요")
	}
	if e.EndDate.IsZero() {
		return errors.New("종료일을 설정해주세요")
	}
	// 종료일은 반드시 시작일보다 이후여야 합니다.
	if !e.EndDate.After(e.StartDate) {
		return errors.New("종료일은 시작일보다 이후여야 합니다")
	}
	return nil
}

// ── 문의 검증 ──

// validInquiryCategories는 1:1 문의에서 허용되는 카테고리 목록입니다.
var validInquiryCategories = map[string]bool{
	"order": true, "delivery": true, "refund": true,
	"tradein": true, "account": true, "etc": true,
}

// ValidateInquiry는 고객 문의 작성 시 카테고리 유효성, 필수 필드, 길이 제한을 확인합니다.
func ValidateInquiry(category, subject, content string) error {
	if !validInquiryCategories[category] {
		return errors.New("유효하지 않은 카테고리입니다")
	}
	if strings.TrimSpace(subject) == "" {
		return errors.New("제목을 입력해주세요")
	}
	if len(subject) > 200 {
		return errors.New("제목은 200자 이내로 입력해주세요")
	}
	if strings.TrimSpace(content) == "" {
		return errors.New("내용을 입력해주세요")
	}
	if len([]rune(content)) > 200 {
		return errors.New("내용은 200자 이내로 입력해주세요")
	}
	return nil
}

// validInquiryTransitions는 1:1 문의의 상태 흐름을 정의합니다.
var validInquiryTransitions = map[string][]string{
	"PENDING":  {"ANSWERED", "CLOSED"}, // 답변 대기 -> 답변 완료 또는 종료 가능
	"ANSWERED": {"CLOSED"},             // 답변 완료 -> 종료 가능
	// CLOSED는 최종 상태
	"CLOSED": {},
}

// ValidateInquiryClose는 문의를 '종료(CLOSED)' 상태로 바꿀 수 있는지 검증합니다.
func ValidateInquiryClose(currentStatus string) error {
	allowed, ok := validInquiryTransitions[currentStatus]
	if !ok {
		return fmt.Errorf("알 수 없는 문의 상태: %q", currentStatus)
	}
	if len(allowed) == 0 {
		return fmt.Errorf("이미 종료된 문의입니다")
	}
	for _, s := range allowed {
		if s == "CLOSED" {
			return nil
		}
	}
	return fmt.Errorf("%s 상태에서는 문의를 종료할 수 없습니다", currentStatus)
}
