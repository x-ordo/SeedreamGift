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
