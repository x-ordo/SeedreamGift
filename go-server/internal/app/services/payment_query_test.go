package services

import (
	"testing"
	"time"

	"seedream-gift-server/internal/domain"

	"gorm.io/gorm"
)

// setupPaymentQueryTestDB는 PaymentQuery 테스트용 DB를 준비합니다.
// User, Brand, Product, Order, OrderItem, Payment를 AutoMigrate합니다.
func setupPaymentQueryTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	db := setupTestDB()
	if err := db.AutoMigrate(
		&domain.User{},
		&domain.Brand{},
		&domain.Product{},
		&domain.Order{},
		&domain.OrderItem{},
		&domain.Payment{},
	); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	return db
}

// seedPaymentTestData는 파트너 A, B의 상품과 각각의 주문·결제를 생성합니다.
// 반환: (partnerA.ID, partnerB.ID, customer.ID)
func seedPaymentTestData(t *testing.T, db *gorm.DB) (int, int, int) {
	t.Helper()
	pA := domain.User{Email: "pa@ex.com", Name: strPtr("PA"), Role: "PARTNER", Password: "x"}
	pB := domain.User{Email: "pb@ex.com", Name: strPtr("PB"), Role: "PARTNER", Password: "x"}
	cu := domain.User{Email: "cu@ex.com", Name: strPtr("Cu"), Role: "USER", Password: "x"}
	if err := db.Create(&pA).Error; err != nil {
		t.Fatalf("create pA: %v", err)
	}
	if err := db.Create(&pB).Error; err != nil {
		t.Fatalf("create pB: %v", err)
	}
	if err := db.Create(&cu).Error; err != nil {
		t.Fatalf("create cu: %v", err)
	}

	// Brand (Product FK 충족)
	if err := db.Create(&domain.Brand{Code: "X", Name: "X_brand", IsActive: true}).Error; err != nil {
		t.Fatalf("create brand: %v", err)
	}

	// Products: A의 상품 / B의 상품
	paID := pA.ID
	pbID := pB.ID
	prodA := domain.Product{
		BrandCode: "X", Name: "A상품",
		PartnerID: &paID,
		Price:     domain.NewNumericDecimalFromInt(10000),
		BuyPrice:  domain.NewNumericDecimalFromInt(10000),
		IsActive:  true,
	}
	prodB := domain.Product{
		BrandCode: "X", Name: "B상품",
		PartnerID: &pbID,
		Price:     domain.NewNumericDecimalFromInt(20000),
		BuyPrice:  domain.NewNumericDecimalFromInt(20000),
		IsActive:  true,
	}
	if err := db.Create(&prodA).Error; err != nil {
		t.Fatalf("create prodA: %v", err)
	}
	if err := db.Create(&prodB).Error; err != nil {
		t.Fatalf("create prodB: %v", err)
	}

	// Order A (A의 상품) — 성공 결제
	oA := domain.Order{
		UserID:      cu.ID,
		OrderCode:   strPtr("ORD-A-0001"),
		TotalAmount: domain.NewNumericDecimalFromInt(10000),
		Status:      "PAID",
	}
	if err := db.Create(&oA).Error; err != nil {
		t.Fatalf("create oA: %v", err)
	}
	if err := db.Create(&domain.OrderItem{
		OrderID: oA.ID, ProductID: prodA.ID, Quantity: 1,
		Price: domain.NewNumericDecimalFromInt(10000),
	}).Error; err != nil {
		t.Fatalf("create oi A: %v", err)
	}
	if err := db.Create(&domain.Payment{
		OrderID: oA.ID, Method: "CARD", Status: "SUCCESS",
		Amount: domain.NewNumericDecimalFromInt(10000),
	}).Error; err != nil {
		t.Fatalf("create payment A: %v", err)
	}

	// Order B (B의 상품) — 실패 결제
	oB := domain.Order{
		UserID:      cu.ID,
		OrderCode:   strPtr("ORD-B-0001"),
		TotalAmount: domain.NewNumericDecimalFromInt(20000),
		Status:      "PENDING",
	}
	if err := db.Create(&oB).Error; err != nil {
		t.Fatalf("create oB: %v", err)
	}
	if err := db.Create(&domain.OrderItem{
		OrderID: oB.ID, ProductID: prodB.ID, Quantity: 1,
		Price: domain.NewNumericDecimalFromInt(20000),
	}).Error; err != nil {
		t.Fatalf("create oi B: %v", err)
	}
	if err := db.Create(&domain.Payment{
		OrderID: oB.ID, Method: "CARD", Status: "FAILED",
		Amount: domain.NewNumericDecimalFromInt(20000),
	}).Error; err != nil {
		t.Fatalf("create payment B: %v", err)
	}

	return pA.ID, pB.ID, cu.ID
}

// TestListPayments_AdminSeesAll: 어드민은 전체 결제를 조회합니다.
func TestListPayments_AdminSeesAll(t *testing.T) {
	db := setupPaymentQueryTestDB(t)
	_, _, _ = seedPaymentTestData(t, db)

	svc := NewPaymentQueryService(db)
	resp, err := svc.ListPayments(PaymentScopeAdmin, PaymentQueryFilters{
		Page: 1, PageSize: 20,
		From: time.Now().AddDate(0, 0, -1),
		To:   time.Now().AddDate(0, 0, 1),
	})
	if err != nil {
		t.Fatalf("ListPayments admin: %v", err)
	}
	if resp.Total != 2 {
		t.Errorf("admin total = %d, want 2", resp.Total)
	}
	if len(resp.Items) != 2 {
		t.Errorf("admin items len = %d, want 2", len(resp.Items))
	}
}

// TestListPayments_PartnerScopeIsolation: 파트너 A는 A의 결제만, B는 B의 결제만 본다.
func TestListPayments_PartnerScopeIsolation(t *testing.T) {
	db := setupPaymentQueryTestDB(t)
	pA, pB, _ := seedPaymentTestData(t, db)

	svc := NewPaymentQueryService(db)
	from := time.Now().AddDate(0, 0, -1)
	to := time.Now().AddDate(0, 0, 1)

	respA, err := svc.ListPayments(PaymentScopePartner, PaymentQueryFilters{
		Page: 1, PageSize: 20, PartnerUserID: pA, From: from, To: to,
	})
	if err != nil {
		t.Fatalf("partner A: %v", err)
	}
	if respA.Total != 1 {
		t.Errorf("partner A total = %d, want 1", respA.Total)
	}
	if len(respA.Items) != 1 {
		t.Fatalf("partner A items len = %d, want 1", len(respA.Items))
	}
	if respA.Items[0].Status != "SUCCESS" {
		t.Errorf("partner A item status = %s, want SUCCESS", respA.Items[0].Status)
	}

	respB, err := svc.ListPayments(PaymentScopePartner, PaymentQueryFilters{
		Page: 1, PageSize: 20, PartnerUserID: pB, From: from, To: to,
	})
	if err != nil {
		t.Fatalf("partner B: %v", err)
	}
	if respB.Total != 1 {
		t.Errorf("partner B total = %d, want 1", respB.Total)
	}

	// A와 B가 같은 paymentId를 보면 격리 실패
	if len(respA.Items) > 0 && len(respB.Items) > 0 && respA.Items[0].PaymentID == respB.Items[0].PaymentID {
		t.Errorf("tenant leak: A saw payment %d, B saw payment %d (same!)", respA.Items[0].PaymentID, respB.Items[0].PaymentID)
	}
}

// TestListPayments_PartnerMaskingApplied: Partner 응답은 고객명·이메일·실패사유가 nil.
func TestListPayments_PartnerMaskingApplied(t *testing.T) {
	db := setupPaymentQueryTestDB(t)
	pA, _, _ := seedPaymentTestData(t, db)

	svc := NewPaymentQueryService(db)
	resp, err := svc.ListPayments(PaymentScopePartner, PaymentQueryFilters{
		Page: 1, PageSize: 20, PartnerUserID: pA,
		From: time.Now().AddDate(0, 0, -1),
		To:   time.Now().AddDate(0, 0, 1),
	})
	if err != nil {
		t.Fatalf("partner: %v", err)
	}
	if len(resp.Items) == 0 {
		t.Fatal("no items to verify masking")
	}
	if resp.Items[0].CustomerName != nil {
		t.Errorf("Partner CustomerName must be nil, got %v", *resp.Items[0].CustomerName)
	}
	if resp.Items[0].CustomerEmail != nil {
		t.Errorf("Partner CustomerEmail must be nil, got %v", *resp.Items[0].CustomerEmail)
	}
	if resp.Items[0].FailReason != nil {
		t.Errorf("Partner FailReason must be nil, got %v", *resp.Items[0].FailReason)
	}
}

// TestListPayments_SummaryIgnoresStatusFilter:
// status="SUCCESS" 필터가 리스트에는 적용되지만 summary는 전체 기준이다.
func TestListPayments_SummaryIgnoresStatusFilter(t *testing.T) {
	db := setupPaymentQueryTestDB(t)
	_, _, _ = seedPaymentTestData(t, db)

	svc := NewPaymentQueryService(db)
	resp, err := svc.ListPayments(PaymentScopeAdmin, PaymentQueryFilters{
		Page: 1, PageSize: 20,
		Status: "SUCCESS",
		From:   time.Now().AddDate(0, 0, -1),
		To:     time.Now().AddDate(0, 0, 1),
	})
	if err != nil {
		t.Fatalf("admin filtered: %v", err)
	}
	if resp.Total != 1 {
		t.Errorf("filtered list total = %d, want 1", resp.Total)
	}
	if resp.Summary.TotalCount != 2 {
		t.Errorf("summary TotalCount = %d, want 2 (ignores status filter)", resp.Summary.TotalCount)
	}
	if resp.Summary.SuccessCount != 1 {
		t.Errorf("summary SuccessCount = %d, want 1", resp.Summary.SuccessCount)
	}
	if resp.Summary.FailedCount != 1 {
		t.Errorf("summary FailedCount = %d, want 1", resp.Summary.FailedCount)
	}
}
