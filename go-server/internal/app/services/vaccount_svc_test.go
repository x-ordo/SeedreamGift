package services

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	"seedream-gift-server/internal/domain"
	"seedream-gift-server/internal/infra/seedream"

	"github.com/glebarez/sqlite"
	"github.com/shopspring/decimal"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

// seedreamClientStub 는 테스트용 Seedream Client 대역입니다.
type seedreamClientStub struct {
	issueFn func(context.Context, seedream.VAccountIssueRequest, string, string) (*seedream.VAccountIssueResponse, error)
}

func (s *seedreamClientStub) IssueVAccount(
	ctx context.Context,
	req seedream.VAccountIssueRequest,
	idem, trace string,
) (*seedream.VAccountIssueResponse, error) {
	return s.issueFn(ctx, req, idem, trace)
}

// setupIssueTestDB 는 Issue 테스트용 in-memory SQLite 데이터베이스를 준비합니다.
// test_helpers_test.go 의 setupTestDB() 와 이름이 겹치지 않도록 접두어 추가.
func setupIssueTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&domain.Order{}, &domain.Payment{}, &domain.User{}, &domain.OrderItem{}))
	return db
}

func seedOrderForIssue(t *testing.T, db *gorm.DB, status string) *domain.Order {
	t.Helper()
	code := "ORD-TEST-1"
	o := &domain.Order{
		UserID: 42, Status: status, Source: "USER",
		TotalAmount: domain.NewNumericDecimal(decimal.NewFromInt(50000)),
		OrderCode:   &code,
	}
	require.NoError(t, db.Create(o).Error)
	return o
}

func TestVAccountService_Issue_Success(t *testing.T) {
	db := setupIssueTestDB(t)
	order := seedOrderForIssue(t, db, "PENDING")

	stub := &seedreamClientStub{
		issueFn: func(ctx context.Context, req seedream.VAccountIssueRequest, idem, trace string) (*seedream.VAccountIssueResponse, error) {
			// RESERVED 왕복은 호출자가 검증하므로 stub 도 올바른 값을 반환
			return &seedream.VAccountIssueResponse{
				ID: 102847, OrderNo: req.OrderNo, Amount: req.Amount,
				Status: "PENDING", Phase: "awaiting_bank_selection",
				TargetURL: "https://testpg.kiwoompay.co.kr/x",
				FormData:  map[string]string{"TOKEN": "t-1"},
				ReservedIndex1: req.ReservedIndex1, ReservedIndex2: req.ReservedIndex2, ReservedString: req.ReservedString,
				DepositEndDate:   req.DepositEndDate,
				DepositEndDateAt: time.Now().Add(30 * time.Minute).UTC(),
			}, nil
		},
	}

	svc := NewVAccountService(db, stub, zap.NewNop())
	caller := CallerContext{UserID: 42, Role: "USER", TraceID: "trace-t1"}

	result, err := svc.Issue(context.Background(), caller, order.ID, "P")
	require.NoError(t, err)
	assert.Equal(t, "https://testpg.kiwoompay.co.kr/x", result.TargetURL)
	assert.Equal(t, "t-1", result.FormData["TOKEN"])
	assert.Equal(t, int64(102847), result.SeedreamVAccountID)

	// Payment 레코드 생성 확인
	var payments []domain.Payment
	require.NoError(t, db.Where("OrderId = ?", order.ID).Find(&payments).Error)
	require.Len(t, payments, 1)
	assert.Equal(t, "PENDING", payments[0].Status)
	require.NotNil(t, payments[0].SeedreamPhase)
	assert.Equal(t, "awaiting_bank_selection", *payments[0].SeedreamPhase)
	require.NotNil(t, payments[0].SeedreamVAccountID)
	assert.Equal(t, int64(102847), *payments[0].SeedreamVAccountID)
	require.NotNil(t, payments[0].SeedreamIdempotencyKey)
	assert.Equal(t, "gift:vaccount:ORD-TEST-1", *payments[0].SeedreamIdempotencyKey)

	// TOKEN 이 DB 에 저장되지 않았는지 확인 (설계 D5)
	// (Payment 엔티티에 FormData 저장 칼럼이 없으므로 구조적으로 불가능)
}

func TestVAccountService_Issue_OwnershipUser(t *testing.T) {
	db := setupIssueTestDB(t)
	order := seedOrderForIssue(t, db, "PENDING")

	stub := &seedreamClientStub{issueFn: func(context.Context, seedream.VAccountIssueRequest, string, string) (*seedream.VAccountIssueResponse, error) {
		t.Fatal("should not be called on ownership failure")
		return nil, nil
	}}

	svc := NewVAccountService(db, stub, zap.NewNop())
	// UserID 불일치
	caller := CallerContext{UserID: 99, Role: "USER"}
	_, err := svc.Issue(context.Background(), caller, order.ID, "P")
	assert.Error(t, err)
	assert.Contains(t, strings.ToLower(err.Error()), "권한")
}

func TestVAccountService_Issue_WrongOrderStatus(t *testing.T) {
	db := setupIssueTestDB(t)
	order := seedOrderForIssue(t, db, "PAID")

	stub := &seedreamClientStub{issueFn: func(context.Context, seedream.VAccountIssueRequest, string, string) (*seedream.VAccountIssueResponse, error) {
		t.Fatal("should not be called")
		return nil, nil
	}}

	svc := NewVAccountService(db, stub, zap.NewNop())
	caller := CallerContext{UserID: 42, Role: "USER"}
	_, err := svc.Issue(context.Background(), caller, order.ID, "P")
	assert.Error(t, err)
}

func TestVAccountService_Issue_DuplicatePending_ReturnsConflict(t *testing.T) {
	// 빠른 경로: 같은 주문에 이미 PENDING Payment 가 있으면 Seedream 호출 없이 Conflict.
	db := setupIssueTestDB(t)
	order := seedOrderForIssue(t, db, "PENDING")

	// 기존 PENDING Payment 선행 생성
	phase := "awaiting_bank_selection"
	existing := &domain.Payment{
		OrderID: order.ID, Method: "VIRTUAL_ACCOUNT_SEEDREAM",
		Amount: order.TotalAmount, Status: "PENDING", SeedreamPhase: &phase,
	}
	require.NoError(t, db.Create(existing).Error)

	stub := &seedreamClientStub{issueFn: func(context.Context, seedream.VAccountIssueRequest, string, string) (*seedream.VAccountIssueResponse, error) {
		t.Fatal("fast-path 에서 Conflict 반환돼야 — Seedream 호출 금지")
		return nil, nil
	}}

	svc := NewVAccountService(db, stub, zap.NewNop())
	caller := CallerContext{UserID: 42, Role: "USER"}
	_, err := svc.Issue(context.Background(), caller, order.ID, "P")

	require.Error(t, err)
	assert.Contains(t, err.Error(), "진행 중")
}

func TestVAccountService_Issue_RaceDetectedInTransaction(t *testing.T) {
	// 경계 race: 빠른 경로는 통과했으나 Seedream 호출 동안 다른 스레드가 Payment 를
	// 만들어버린 시나리오. 트랜잭션 안 재확인이 이를 감지해 Conflict 반환해야 함.
	db := setupIssueTestDB(t)
	order := seedOrderForIssue(t, db, "PENDING")

	stub := &seedreamClientStub{
		issueFn: func(ctx context.Context, req seedream.VAccountIssueRequest, idem, trace string) (*seedream.VAccountIssueResponse, error) {
			// "Seedream 호출 중" 에 다른 경로가 먼저 Payment 를 삽입했다고 가정 — 테스트에서는
			// stub 콜백 안에서 직접 DB 삽입.
			phase := "awaiting_bank_selection"
			p := &domain.Payment{
				OrderID: order.ID, Method: "VIRTUAL_ACCOUNT_SEEDREAM",
				Amount: order.TotalAmount, Status: "PENDING", SeedreamPhase: &phase,
			}
			require.NoError(t, db.Create(p).Error)

			return &seedream.VAccountIssueResponse{
				ID: 999, OrderNo: req.OrderNo, Status: "PENDING", Phase: "awaiting_bank_selection",
				TargetURL:        "https://x",
				ReservedIndex1:   req.ReservedIndex1,
				ReservedIndex2:   req.ReservedIndex2,
				ReservedString:   req.ReservedString,
				DepositEndDateAt: time.Now().Add(30 * time.Minute).UTC(),
			}, nil
		},
	}

	svc := NewVAccountService(db, stub, zap.NewNop())
	caller := CallerContext{UserID: 42, Role: "USER"}
	_, err := svc.Issue(context.Background(), caller, order.ID, "P")

	require.Error(t, err)
	assert.Contains(t, err.Error(), "진행 중")

	// Payment 가 하나만 있어야 함 (race 로 우승한 쪽만)
	var count int64
	require.NoError(t, db.Model(&domain.Payment{}).Where("OrderId = ?", order.ID).Count(&count).Error)
	assert.Equal(t, int64(1), count, "Payment 는 1건만 존재해야 함 (race 방어)")
}

func TestVAccountService_Resume_CancelsOldAndIssuesNew(t *testing.T) {
	// Resume: 기존 PENDING Payment 가 있을 때 CANCELLED 처리하고 새 VA 발급.
	db := setupIssueTestDB(t)
	order := seedOrderForIssue(t, db, "PENDING")

	// 기존 PENDING Payment 시드
	oldPhase := "awaiting_bank_selection"
	oldIdem := "gift:vaccount:ORD-TEST-1"
	oldExpires := time.Now().Add(-1 * time.Minute)
	oldPayment := &domain.Payment{
		OrderID: order.ID, Method: "VIRTUAL_ACCOUNT_SEEDREAM",
		Amount: order.TotalAmount, Status: "PENDING",
		SeedreamPhase: &oldPhase, SeedreamIdempotencyKey: &oldIdem,
		ExpiresAt: &oldExpires,
	}
	require.NoError(t, db.Create(oldPayment).Error)

	stub := &seedreamClientStub{
		issueFn: func(ctx context.Context, req seedream.VAccountIssueRequest, idem, trace string) (*seedream.VAccountIssueResponse, error) {
			// 재시도 key 는 :retry: 를 포함해야 함
			assert.Contains(t, idem, ":retry:")
			return &seedream.VAccountIssueResponse{
				ID: 99999, OrderNo: req.OrderNo, Amount: req.Amount,
				Status: "PENDING", Phase: "awaiting_bank_selection",
				TargetURL: "https://retry.kiwoompay/x",
				FormData:  map[string]string{"TOKEN": "retry-tok"},
				ReservedIndex1: req.ReservedIndex1,
				ReservedIndex2: req.ReservedIndex2,
				ReservedString: req.ReservedString,
				DepositEndDateAt: time.Now().Add(30 * time.Minute).UTC(),
			}, nil
		},
	}

	svc := NewVAccountService(db, stub, zap.NewNop())
	caller := CallerContext{UserID: 42, Role: "USER", TraceID: "trace-retry"}

	result, err := svc.Resume(context.Background(), caller, order.ID, "P")
	require.NoError(t, err)
	assert.Equal(t, "https://retry.kiwoompay/x", result.TargetURL)
	assert.Equal(t, int64(99999), result.SeedreamVAccountID)

	// 기존 Payment 는 CANCELLED
	var gotOld domain.Payment
	require.NoError(t, db.First(&gotOld, oldPayment.ID).Error)
	assert.Equal(t, "CANCELLED", gotOld.Status)
	require.NotNil(t, gotOld.CancelledAt)
	require.NotNil(t, gotOld.FailReason)

	// 새 Payment 가 하나 더 PENDING 으로 존재
	var pendingCount int64
	require.NoError(t, db.Model(&domain.Payment{}).
		Where("OrderId = ? AND Status = 'PENDING'", order.ID).Count(&pendingCount).Error)
	assert.Equal(t, int64(1), pendingCount)
}

func TestVAccountService_Resume_RejectsTerminalOrder(t *testing.T) {
	// Resume: 주문이 종료 상태면 재시도 거부.
	db := setupIssueTestDB(t)
	order := seedOrderForIssue(t, db, "CANCELLED")

	stub := &seedreamClientStub{issueFn: func(context.Context, seedream.VAccountIssueRequest, string, string) (*seedream.VAccountIssueResponse, error) {
		t.Fatal("종료 상태에서 Seedream 호출 금지")
		return nil, nil
	}}

	svc := NewVAccountService(db, stub, zap.NewNop())
	caller := CallerContext{UserID: 42, Role: "USER"}
	_, err := svc.Resume(context.Background(), caller, order.ID, "P")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "재결제")
}

func TestVAccountService_Issue_ReservedRoundTripViolation(t *testing.T) {
	db := setupIssueTestDB(t)
	order := seedOrderForIssue(t, db, "PENDING")

	stub := &seedreamClientStub{
		issueFn: func(ctx context.Context, req seedream.VAccountIssueRequest, idem, trace string) (*seedream.VAccountIssueResponse, error) {
			// Seedream 회귀 버그 시나리오: 잘못된 reservedIndex1 반환
			return &seedream.VAccountIssueResponse{
				ID: 1, OrderNo: req.OrderNo, Status: "PENDING", Phase: "awaiting_bank_selection",
				TargetURL:        "https://x",
				ReservedIndex1:   "WRONG_VALUE", // ← 위반
				ReservedIndex2:   req.ReservedIndex2,
				ReservedString:   req.ReservedString,
				DepositEndDateAt: time.Now().Add(30 * time.Minute).UTC(),
			}, nil
		},
	}

	svc := NewVAccountService(db, stub, zap.NewNop())
	caller := CallerContext{UserID: 42, Role: "USER"}
	_, err := svc.Issue(context.Background(), caller, order.ID, "P")

	require.Error(t, err)
	assert.True(t, errors.Is(err, seedream.ErrReservedRoundTripViolation))
}
