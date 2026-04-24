package services

import (
	"context"
	"errors"
	"fmt"
	"time"

	"seedream-gift-server/internal/domain"
	"seedream-gift-server/internal/infra/seedream"
	"seedream-gift-server/pkg/apperror"

	"go.uber.org/zap"
	"gorm.io/gorm"
)

// kstLoc (Asia/Seoul) 는 admin_order_svc.go 에 package-level 로 정의됨 — 재사용.

// CallerContext 는 3계층 권한 경계 강제용 호출자 정보입니다.
// handler 에서 구성해 service 에 전달.
type CallerContext struct {
	UserID    int     // 로그인된 유저 ID
	Role      string  // "USER" | "PARTNER" | "ADMIN"
	PartnerID *string // Role=="PARTNER" 일 때만 세팅
	TraceID   string  // 양측 로그 조인용
}

// IssuerClient 는 VAccountService 가 의존하는 Seedream Client 의 하위집합입니다.
// 테스트에서 mock 하기 위한 인터페이스 경계 — seedream.Client 가 이 인터페이스를
// 만족합니다 (메서드 시그니처 일치). Phase 4 의 CancelClient 와 동일한 패턴.
type IssuerClient interface {
	IssueVAccount(
		ctx context.Context,
		req seedream.VAccountIssueRequest,
		idempotencyKey, traceID string,
	) (*seedream.VAccountIssueResponse, error)
}

// 컴파일 타임 guard — seedream.Client 가 IssuerClient 인터페이스를 만족함을 보장.
// 시그니처 drift 가 발생하면 빌드가 깨지도록 강제.
var _ IssuerClient = (*seedream.Client)(nil)

// VAccountService 는 Seedream VA 발급/취소/환불 오케스트레이션을 담당합니다.
// Phase 2 에서는 Issue 만 구현 — Cancel/Refund 는 Phase 4 (CancelService 로 분리).
type VAccountService struct {
	db     *gorm.DB
	client IssuerClient
	logger *zap.Logger
}

// NewVAccountService 는 VAccountService 를 생성합니다.
func NewVAccountService(db *gorm.DB, client IssuerClient, logger *zap.Logger) *VAccountService {
	if logger == nil {
		logger = zap.NewNop()
	}
	return &VAccountService{db: db, client: client, logger: logger}
}

// IssueResult 는 Issue 성공 시 handler 에 반환되는 구조입니다.
// TargetURL + FormData 는 브라우저 auto-submit form 렌더용 (설계 D5 — 서버 저장 금지).
type IssueResult struct {
	SeedreamVAccountID int64             `json:"seedreamVAccountId"`
	TargetURL          string            `json:"targetUrl"`
	FormData           map[string]string `json:"formData"`
	DepositEndDateAt   time.Time         `json:"depositEndDateAt"`
	OrderCode          string            `json:"orderCode"`
}

// Issue 는 주문에 대해 Seedream LINK 모드 VA 발급을 요청합니다.
//
// 책임:
//  1. 주문 조회 + 소유권 검증 (3계층 권한 경계).
//  2. Order.Status == PENDING 검증.
//  3. 중복 PENDING Payment 가드.
//  4. reservedIndex2 계산 (Role + PartnerID 기반).
//  5. Seedream IssueVAccount 호출.
//  6. RESERVED 왕복 불변식 검증 — 위반 시 ErrReservedRoundTripViolation.
//  7. Payment 레코드 생성 + Order.PaymentDeadlineAt 업데이트 (단일 트랜잭션).
//
// 주의: TargetURL/FormData(TOKEN) 은 Payment DB 에 저장하지 않고 호출자에게만 반환.
func (s *VAccountService) Issue(
	ctx context.Context,
	caller CallerContext,
	orderID int,
	deviceType string, // "P" | "M"
) (*IssueResult, error) {
	// 1) 주문 로드 + 소유권 검증
	var order domain.Order
	if err := s.db.WithContext(ctx).First(&order, orderID).Error; err != nil {
		return nil, apperror.NotFound("주문을 찾을 수 없습니다")
	}
	if err := checkOrderOwnership(caller, &order); err != nil {
		return nil, err
	}

	// 2) 상태 검증
	if order.Status != domain.OrderStatusPending {
		return nil, apperror.Validation(fmt.Sprintf("현재 주문 상태(%s)에서는 결제를 시작할 수 없습니다", order.Status))
	}
	if order.OrderCode == nil || *order.OrderCode == "" {
		return nil, apperror.Internal("주문 코드가 비어있습니다", nil)
	}

	// 3) 중복 발급 방지 — 같은 주문에 PENDING Payment 이미 있으면 재발급 안 함
	var existing domain.Payment
	err := s.db.WithContext(ctx).Where("OrderId = ? AND Status = 'PENDING'", orderID).First(&existing).Error
	if err == nil {
		return nil, apperror.Conflict("이미 결제가 진행 중입니다")
	}

	// 4) reservedIndex2 계산
	reservedIndex2, err := seedream.ReservedIndex2For(caller.Role, caller.PartnerID)
	if err != nil {
		return nil, apperror.Validation(err.Error())
	}

	// 5) depositEndDate = now + 30min (KST, YYYYMMDDhhmmss)
	depositEndDate := time.Now().In(kstLoc).Add(30 * time.Minute).Format("20060102150405")

	// 6) Idempotency-Key = "gift:vaccount:{OrderCode}"
	idempotencyKey := fmt.Sprintf("gift:vaccount:%s", *order.OrderCode)

	// 7) Seedream 호출
	req := seedream.VAccountIssueRequest{
		OrderNo:        *order.OrderCode,
		Amount:         order.TotalAmount.Decimal.IntPart(),
		ProductName:    "상품권 주문 " + *order.OrderCode, // 추후 상품별 맞춤 네임 (Phase 4+)
		Type:           deviceType,
		IssueMode:      seedream.IssueModeLink,
		ProductType:    seedream.ProductTypeFixed,
		BillType:       seedream.BillTypeFixed,
		ReservedIndex1: seedream.ReservedIndex1Fixed,
		ReservedIndex2: reservedIndex2,
		ReservedString: seedream.ReservedStringFixed,
		DepositEndDate: depositEndDate,
	}
	resp, err := s.client.IssueVAccount(ctx, req, idempotencyKey, caller.TraceID)
	if err != nil {
		return nil, err
	}

	// 8) RESERVED 왕복 검증 — 위반 시 Seedream 회귀 버그, Ops 에스컬레이션
	if err := seedream.AssertReservedInvariant(reservedIndex2, seedream.ReservedFields{
		ReservedIndex1: resp.ReservedIndex1,
		ReservedIndex2: resp.ReservedIndex2,
		ReservedString: resp.ReservedString,
	}); err != nil {
		s.logger.Error("seedream RESERVED 왕복 위반",
			zap.String("orderCode", *order.OrderCode),
			zap.String("traceId", caller.TraceID),
			zap.Error(err))
		return nil, err // sentinel 포함
	}

	// 9) Payment 레코드 생성 — 트랜잭션 안에서 Order.PaymentDeadlineAt 도 업데이트
	phase := resp.Phase
	vaID := resp.ID
	err = s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		p := &domain.Payment{
			OrderID:                orderID,
			Method:                 "VIRTUAL_ACCOUNT_SEEDREAM",
			Amount:                 order.TotalAmount,
			Status:                 "PENDING",
			SeedreamVAccountID:     &vaID,
			SeedreamPhase:          &phase,
			SeedreamIdempotencyKey: &idempotencyKey,
			ExpiresAt:              &resp.DepositEndDateAt,
		}
		// awaiting_bank_selection 단계에서는 BankCode / AccountNumber / DaouTrx / DepositorName 가
		// 모두 nil 이지만, Seedream 응답에 값이 있으면 (예: 테스트 stub) 캐시 해 둠.
		// 실제 운영에서 이 필드들은 VAccountStateService 가 webhook 수신 시 채움.
		if resp.BankCode != nil {
			p.BankCode = resp.BankCode
		}
		if resp.AccountNumber != nil {
			p.AccountNumber = resp.AccountNumber
		}
		if resp.DepositorName != nil {
			p.DepositorName = resp.DepositorName
		}
		if resp.DaouTrx != nil {
			p.SeedreamDaouTrx = resp.DaouTrx
		}
		if err := tx.Create(p).Error; err != nil {
			return err
		}
		// Order.PaymentDeadlineAt 업데이트 (Status 는 PENDING 유지)
		return tx.Model(&order).Update("PaymentDeadlineAt", resp.DepositEndDateAt).Error
	})
	if err != nil {
		return nil, fmt.Errorf("payment insert: %w", err)
	}

	return &IssueResult{
		SeedreamVAccountID: resp.ID,
		TargetURL:          resp.TargetURL,
		FormData:           resp.FormData,
		DepositEndDateAt:   resp.DepositEndDateAt,
		OrderCode:          *order.OrderCode,
	}, nil
}

// checkOrderOwnership 은 3계층 소유권 경계를 강제합니다.
//   - ADMIN: 전수 허용.
//   - PARTNER: Phase 2 에서는 미지원 (Phase 4 에서 Order.PartnerID 또는
//     reservedIndex2 기반 매핑 추가 후 허용).
//   - USER: Order.UserID == caller.UserID 일 때만 허용.
func checkOrderOwnership(caller CallerContext, order *domain.Order) error {
	switch caller.Role {
	case "ADMIN":
		return nil // 전수 허용
	case "PARTNER":
		if caller.PartnerID == nil {
			return apperror.Forbidden("파트너 ID가 필요합니다 (권한)")
		}
		// TODO(Phase 4): Order 에 PartnerID 필드가 없는 경우 reservedIndex2 기반 조회 필요.
		// 현 시점엔 PARTNER 발급 경로 사용 여부 미확정 — 안전하게 거부.
		return apperror.Forbidden("PARTNER 발급은 Phase 4 에서 지원합니다 (권한)")
	case "USER":
		if order.UserID != caller.UserID {
			return apperror.Forbidden("주문에 대한 접근 권한이 없습니다")
		}
		return nil
	default:
		return apperror.Forbidden("알 수 없는 호출자 권한: " + caller.Role)
	}
}

// _ 는 errors.Is 링크를 유지하기 위한 placeholder (현재 사용 없음)
var _ = errors.New
