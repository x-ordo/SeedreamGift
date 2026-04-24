package services

import (
	"context"
	"errors"
	"fmt"
	"regexp"
	"strings"
	"time"
	"unicode/utf8"

	"seedream-gift-server/internal/domain"
	"seedream-gift-server/internal/infra/seedream"

	"go.uber.org/zap"
	"gorm.io/gorm"
)

// CancelService 는 Seedream 취소/환불 오케스트레이션 레이어입니다.
//
// 책임:
//  1. 주문(Order) + 결제(Payment) 조회 — OrderCode AND UserID 기반 권한 결합 쿼리.
//  2. 입력 검증 — cancelReason · bankCode · accountNo 형식 확인.
//  3. DaouTrx 해석 (cache-aside):
//     Payment.SeedreamDaouTrx 가 있으면 바로 사용, 없으면 Seedream
//     GET /api/v1/vaccount 로 fallback 조회 후 Payment.SeedreamDaouTrx 에 캐시.
//  4. Seedream CancelIssued / RefundDeposited 호출.
//  5. ErrCancelAlreadyDone 매핑 — Seedream 이 이미 처리한 건은 성공으로 간주.
//
// 상태 전이는 본 서비스가 건드리지 않습니다. 실제 Order.Status 변경은
// VAccountStateService 가 Seedream 웹훅(payment.canceled / deposit.cancel.deposited)
// 수신 시 수행합니다. 동기 호출 성공은 “Seedream 쪽 접수 완료” 수준의 의미.
type CancelService struct {
	db       *gorm.DB
	seedream CancelClient
	clock    func() time.Time
	logger   *zap.Logger
}

// 컴파일 타임 guard — seedream.Client 가 CancelClient 인터페이스를 만족함을 보장.
// 시그니처 drift 가 발생하면 빌드가 깨지도록 강제.
var _ CancelClient = (*seedream.Client)(nil)

// CancelClient 는 CancelService 가 의존하는 Seedream Client 의 하위집합입니다.
// 테스트에서 mock 하기 위한 인터페이스 경계 — seedream.Client 는 이 인터페이스를
// 만족합니다 (메서드 시그니처 일치).
type CancelClient interface {
	GetVAccountByOrderNo(ctx context.Context, orderNo, traceID string) (*seedream.VAccountResult, error)
	CancelIssued(
		ctx context.Context,
		orderNo, trxID string,
		amount int64,
		reason string,
		idempotencyKey, traceID string,
	) (*seedream.CancelResponse, error)
	RefundDeposited(
		ctx context.Context,
		orderNo, trxID string,
		amount int64,
		reason, bankCode, accountNo string,
		idempotencyKey, traceID string,
	) (*seedream.CancelResponse, error)
}

// SeedreamCancelInput 은 입금 전 발급 취소 요청 입력입니다.
// 이름 prefix 는 같은 패키지의 SeedreampayService.RefundInput (voucher 환불) 과
// 충돌 회피 목적.
type SeedreamCancelInput struct {
	OrderCode    string // Orders.OrderCode (사용자 노출용 주문번호)
	CancelReason string // 5~50 rune, '^' / '[' / ']' 금지
	UserID       int    // Orders.UserId 와 비교해 권한 결합 (타인 주문 취소 방지)
}

// SeedreamRefundInput 은 입금 후 환불 요청 입력입니다.
type SeedreamRefundInput struct {
	OrderCode    string
	CancelReason string
	BankCode     string // 통합 가이드 §4.1 9개 화이트리스트 중 하나
	AccountNo    string // 숫자/하이픈 6~20자
	UserID       int
}

// SeedreamCancelResult 는 서비스 결과입니다.
// AlreadyDone=true 이면 Seedream 측 응답이 ErrCancelAlreadyDone 이었던 경우로,
// 중복 요청·재시도 등으로 이미 처리된 건입니다. 호출자(핸들러)는 이를 성공으로
// 사용자에게 리턴해야 합니다 (통합 가이드 §7.6 D-6).
type SeedreamCancelResult struct {
	Response    *seedream.CancelResponse
	AlreadyDone bool
}

// NewCancelService 는 CancelService 를 생성합니다.
// logger 가 nil 이면 Nop logger 를 사용합니다.
func NewCancelService(db *gorm.DB, client CancelClient, logger *zap.Logger) *CancelService {
	if logger == nil {
		logger = zap.NewNop()
	}
	return &CancelService{
		db:       db,
		seedream: client,
		clock:    time.Now,
		logger:   logger,
	}
}

// BankCodesCancel 은 통합 가이드 §4.1 Refund BANK payMethod 에서 허용되는
// 9개 금융기관 코드 화이트리스트입니다.
var BankCodesCancel = map[string]bool{
	"088": true, // 신한
	"004": true, // KB국민
	"020": true, // 우리
	"081": true, // 하나
	"011": true, // 농협
	"003": true, // IBK기업
	"023": true, // SC제일
	"027": true, // 한국씨티
	"032": true, // BNK부산
}

// accountNoPattern — 숫자/하이픈 6~20자.
var accountNoPattern = regexp.MustCompile(`^[0-9-]{6,20}$`)

// validateCancelReason 는 cancelReason 을 검증합니다.
//
//   - 5 ≤ rune 수 ≤ 50 (한글은 1 rune = 1자).
//   - 금지 문자: '^' '[' ']' (Seedream 측 정규식 충돌 회피, 통합 가이드 §7.3).
func validateCancelReason(reason string) error {
	reason = strings.TrimSpace(reason)
	n := utf8.RuneCountInString(reason)
	if n < 5 || n > 50 {
		return fmt.Errorf("cancelReason length must be 5-50 runes (got %d)", n)
	}
	if strings.ContainsAny(reason, "^[]") {
		return errors.New("cancelReason must not contain '^', '[', ']'")
	}
	return nil
}

// validateBankCode 는 BankCodesCancel 화이트리스트 소속 여부를 확인합니다.
func validateBankCode(code string) error {
	if !BankCodesCancel[code] {
		return fmt.Errorf("bankCode %q is not in refund whitelist (see §4.1)", code)
	}
	return nil
}

// validateAccountNo 는 계좌번호 형식을 검증합니다 (숫자·하이픈 6~20자).
func validateAccountNo(no string) error {
	if !accountNoPattern.MatchString(no) {
		return fmt.Errorf("accountNo must match ^[0-9-]{6,20}$ (got %q)", no)
	}
	return nil
}

// CancelIssued 는 입금 전 발급 취소를 오케스트레이션 합니다.
//
// 플로우:
//  1. cancelReason 검증.
//  2. Order + Payment 조회 (OrderCode AND UserId).
//  3. DaouTrx 해석 (cache-aside).
//  4. Seedream.CancelIssued 호출 (Idempotency-Key: "gift:cancel:{OrderCode}" — 원본 케이스 보존).
//  5. ErrCancelAlreadyDone 은 성공으로 매핑.
func (s *CancelService) CancelIssued(ctx context.Context, in SeedreamCancelInput) (*SeedreamCancelResult, error) {
	if err := validateCancelReason(in.CancelReason); err != nil {
		return nil, err
	}

	order, payment, err := s.loadOrderAndPayment(ctx, in.OrderCode, in.UserID)
	if err != nil {
		return nil, err
	}

	trxID, err := s.resolveDaouTrx(ctx, order.OrderCode, payment)
	if err != nil {
		return nil, err
	}

	amount := order.TotalAmount.Decimal.IntPart()
	idempotencyKey := fmt.Sprintf("gift:cancel:%s", in.OrderCode)

	resp, err := s.seedream.CancelIssued(ctx, in.OrderCode, trxID, amount, in.CancelReason, idempotencyKey, "")
	if err != nil {
		if errors.Is(err, seedream.ErrCancelAlreadyDone) {
			s.logger.Info("seedream cancel already done — treating as success",
				zap.String("orderCode", in.OrderCode))
			return &SeedreamCancelResult{AlreadyDone: true}, nil
		}
		return nil, fmt.Errorf("seedream CancelIssued: %w", err)
	}
	return &SeedreamCancelResult{Response: resp}, nil
}

// Refund 는 입금 후 환불을 오케스트레이션 합니다.
//
// Idempotency-Key 는 "gift:refund:{OrderCode}:{yyyymmddhhmmss}" (통합 가이드 §7.2, 원본 케이스) —
// 환불은 성격상 재시도 분리를 위해 timestamp 를 포함합니다.
func (s *CancelService) Refund(ctx context.Context, in SeedreamRefundInput) (*SeedreamCancelResult, error) {
	if err := validateCancelReason(in.CancelReason); err != nil {
		return nil, err
	}
	if err := validateBankCode(in.BankCode); err != nil {
		return nil, err
	}
	if err := validateAccountNo(in.AccountNo); err != nil {
		return nil, err
	}

	order, payment, err := s.loadOrderAndPayment(ctx, in.OrderCode, in.UserID)
	if err != nil {
		return nil, err
	}

	trxID, err := s.resolveDaouTrx(ctx, order.OrderCode, payment)
	if err != nil {
		return nil, err
	}

	amount := order.TotalAmount.Decimal.IntPart()
	idempSuffix := s.clock().UTC().Format("20060102150405")
	idempotencyKey := fmt.Sprintf("gift:refund:%s:%s", in.OrderCode, idempSuffix)

	resp, err := s.seedream.RefundDeposited(
		ctx,
		in.OrderCode,
		trxID,
		amount,
		in.CancelReason,
		in.BankCode,
		in.AccountNo,
		idempotencyKey,
		"",
	)
	if err != nil {
		if errors.Is(err, seedream.ErrCancelAlreadyDone) {
			s.logger.Info("seedream refund already done — treating as success",
				zap.String("orderCode", in.OrderCode))
			return &SeedreamCancelResult{AlreadyDone: true}, nil
		}
		return nil, fmt.Errorf("seedream RefundDeposited: %w", err)
	}
	return &SeedreamCancelResult{Response: resp}, nil
}

// loadOrderAndPayment 는 OrderCode AND UserId 로 Order 를 조회하고,
// 연결된 Payment 1건을 로드합니다. Payment 가 여러 건이면 가장 최근 것을 사용.
//
// 주의: UserId 결합 조회는 “타인 주문 취소” 공격을 차단합니다. 관리자 전용
// 취소 경로(별도 서비스 필요)에서는 본 함수를 쓰지 않습니다.
func (s *CancelService) loadOrderAndPayment(
	ctx context.Context, orderCode string, userID int,
) (*domain.Order, *domain.Payment, error) {
	var order domain.Order
	if err := s.db.WithContext(ctx).
		Where("OrderCode = ? AND UserId = ?", orderCode, userID).
		First(&order).Error; err != nil {
		return nil, nil, fmt.Errorf("order lookup (orderCode=%s, userId=%d): %w", orderCode, userID, err)
	}

	var payment domain.Payment
	if err := s.db.WithContext(ctx).
		Where("OrderId = ?", order.ID).
		Order("Id DESC").
		First(&payment).Error; err != nil {
		return nil, nil, fmt.Errorf("payment lookup (orderId=%d): %w", order.ID, err)
	}
	return &order, &payment, nil
}

// resolveDaouTrx 는 DaouTrx 를 cache-aside 방식으로 해석합니다.
//
//   - Payment.SeedreamDaouTrx 가 있으면 그대로 반환.
//   - 없으면 Seedream GET /api/v1/vaccount?orderNo= 로 조회해 DaouTrx 추출,
//     성공 시 Payment.SeedreamDaouTrx 에 UPDATE (캐시).
//   - 여전히 nil 이면 에러 — awaiting_bank_selection 단계이거나 Seedream 측
//     데이터 이상 가능성.
func (s *CancelService) resolveDaouTrx(
	ctx context.Context, orderCode *string, p *domain.Payment,
) (string, error) {
	if p.SeedreamDaouTrx != nil && *p.SeedreamDaouTrx != "" {
		return *p.SeedreamDaouTrx, nil
	}
	if orderCode == nil || *orderCode == "" {
		return "", errors.New("cannot resolve DaouTrx: orderCode is empty")
	}

	result, err := s.seedream.GetVAccountByOrderNo(ctx, *orderCode, "")
	if err != nil {
		return "", fmt.Errorf("seedream GetVAccountByOrderNo for DaouTrx: %w", err)
	}
	if result == nil || result.DaouTrx == nil || *result.DaouTrx == "" {
		return "", fmt.Errorf("DaouTrx not yet available for order %s "+
			"(awaiting_bank_selection 단계일 가능성 — 은행선택 전에는 취소 불가)", *orderCode)
	}

	daouTrx := *result.DaouTrx
	if err := s.db.WithContext(ctx).
		Model(&domain.Payment{}).
		Where("Id = ?", p.ID).
		Update("SeedreamDaouTrx", &daouTrx).Error; err != nil {
		// 캐시 실패는 치명적이지 않음 — 이미 DaouTrx 는 확보했으므로 warn 후 진행.
		s.logger.Warn("failed to cache DaouTrx on Payment — proceeding anyway",
			zap.Int("paymentId", p.ID),
			zap.Error(err))
	} else {
		p.SeedreamDaouTrx = &daouTrx
	}
	return daouTrx, nil
}
