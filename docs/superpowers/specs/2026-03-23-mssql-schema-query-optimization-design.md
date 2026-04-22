# MSSQL 스키마 & 쿼리 전면 최적화 설계

## 배경

Go 서버(Gin + GORM + MSSQL) 데이터베이스 레이어에 성능 병목과 스키마 결함이 있음:
- 복합 인덱스 누락 10곳 (주요 WHERE 절에 인덱스 없음)
- SELECT * 과다 사용 (목록 조회에서 대용량 컬럼 포함)
- FK 제약조건 미설정 (GORM 관계만, DB 레벨 무결성 없음)
- Preload 과잉 (필요 없는 필드까지 로드)
- UPDLOCK 쿼리에서 SELECT * 사용 (락 범위 과대)

외주 판매 제품이므로, 마이그레이션 SQL 스크립트를 납품 자산으로 활용.

## 범위

1. 인덱스 최적화 (복합 인덱스 + INCLUDE 커버링)
2. GORM 쿼리 최적화 (Select 명시, Preload 제한, 검색 개선, UPDLOCK 쿼리 최적화)
3. FK 제약조건 추가 (데이터 무결성, ON DELETE NO ACTION 원칙)
4. 마이그레이션 SQL 스크립트 생성 (고아 데이터 정리 + WITH NOCHECK 패턴)

---

## 1. 인덱스 최적화

### 1A. 복합 인덱스 10개 추가

```sql
-- 1. 주문 목록: WHERE UserId = ? ORDER BY Id DESC (GetMyOrders)
CREATE NONCLUSTERED INDEX IX_Orders_UserId
ON Orders(UserId)
INCLUDE (Status, TotalAmount, OrderCode, CreatedAt, PaymentMethod);

-- 2. 일일 한도 체크: WHERE UserId = ? AND CreatedAt >= ? (CheckLimit)
CREATE NONCLUSTERED INDEX IX_Orders_UserId_CreatedAt
ON Orders(UserId, CreatedAt)
INCLUDE (TotalAmount, Status);

-- 3. 바우처 할당 (UPDLOCK 핫쿼리): WHERE ProductId = ? AND Status = 'AVAILABLE'
--    UPDLOCK 시 Id만 SELECT하므로 INCLUDE 불필요 (seek만 수행)
CREATE NONCLUSTERED INDEX IX_VoucherCodes_ProductId_Status
ON VoucherCodes(ProductId, Status);

-- 4. 바우처 크론 만료: WHERE Status = 'AVAILABLE' AND ExpiredAt < ?
CREATE NONCLUSTERED INDEX IX_VoucherCodes_Status_ExpiredAt
ON VoucherCodes(Status, ExpiredAt);

-- 5. 매입 조회: WHERE UserId = ? ORDER BY Id DESC (GetMyTradeIns)
CREATE NONCLUSTERED INDEX IX_TradeIns_UserId
ON TradeIns(UserId)
INCLUDE (Status, PayoutAmount, ProductBrand, ProductName, CreatedAt);

-- 6. 상품 목록: WHERE IsActive = 1 (+ BrandCode 필터)
CREATE NONCLUSTERED INDEX IX_Products_BrandCode_IsActive
ON Products(BrandCode, IsActive)
INCLUDE (Name, Price, BuyPrice, DiscountRate, TradeInRate, AllowTradeIn, ImageUrl, Type);

-- 7. 결제 확인: WHERE OrderId = ? AND Status = ?
CREATE NONCLUSTERED INDEX IX_Payments_OrderId_Status
ON Payments(OrderId, Status);

-- 8. 문의 조회: WHERE UserId = ? AND Status = ?
CREATE NONCLUSTERED INDEX IX_Inquiries_UserId_Status
ON Inquiries(UserId, Status)
INCLUDE (Category, Subject, CreatedAt);

-- 9. 선물 크론 만료: WHERE Status = 'SENT' AND ExpiresAt < ?
CREATE NONCLUSTERED INDEX IX_Gifts_Status_ExpiresAt
ON Gifts(Status, ExpiresAt);

-- 10. 감사로그 아카이빙: WHERE IsArchived = ? AND CreatedAt < ?
CREATE NONCLUSTERED INDEX IX_AuditLogs_IsArchived_CreatedAt
ON AuditLogs(IsArchived, CreatedAt);
```

### 1B. 기존 중복 인덱스 정리

복합 인덱스 추가 후 단일 컬럼 인덱스가 중복되는 경우 제거:

```sql
-- Payments: OrderId, Status 개별 인덱스 → 복합으로 대체
DROP INDEX IF EXISTS IX_Payments_OrderId ON Payments;
DROP INDEX IF EXISTS IX_Payments_Status ON Payments;

-- Inquiries: UserId, Status 개별 인덱스 → 복합으로 대체
DROP INDEX IF EXISTS IX_Inquiries_UserId ON Inquiries;
DROP INDEX IF EXISTS IX_Inquiries_Status ON Inquiries;
```

### 1C. GORM 모델 인덱스 태그

GORM 인덱스 태그는 **문서화 목적**으로만 추가. AutoMigrate는 미사용이므로 실제 인덱스 생성은 SQL 스크립트에서 수행.

---

## 2. GORM 쿼리 최적화

### 2A. SELECT * -> Select 명시

GORM 기존 컨벤션(variadic)을 따라 작성:

| 서비스 함수 | 파일 | 변경 |
|------------|------|------|
| `GetMyOrders` | order_service.go | `.Select("Id", "OrderCode", "UserId", "TotalAmount", "Status", "PaymentMethod", "CreatedAt")` |
| `GetProducts` (목록) | product_service.go | `.Select("Id", "BrandCode", "Name", "Price", "DiscountRate", "BuyPrice", "TradeInRate", "AllowTradeIn", "ImageUrl", "IsActive", "Type", "CreatedAt")` |
| `GetNotices` (목록) | content_service.go | `.Select("Id", "Title", "IsActive", "ViewCount", "CreatedAt")` (Content 제외) |
| `GetFaqs` (목록) | content_service.go | `.Select("Id", "Question", "Category", "Order", "IsActive", "HelpfulCount", "CreatedAt")` (Answer 제외) |
| `GetMyTradeIns` | tradein_service.go | `.Select("Id", "UserId", "ProductId", "ProductName", "ProductBrand", "Quantity", "PayoutAmount", "Status", "CreatedAt")` |
| AuditLog 목록 | admin 서비스 | OldValue/NewValue 제외 (상세에서만) |

> Select()는 부모 쿼리에만 영향. Preload 서브쿼리에는 별도 Select 필요.

### 2B. Preload 최적화

**규칙: Preload 콜백에서 반드시 FK/PK 컬럼 포함** (누락 시 GORM이 관계 매핑 실패)

```go
// 주문 목록 — OrderItems는 FK(OrderId) + PK(Id) 필수 포함
db.Preload("OrderItems", func(db *gorm.DB) *gorm.DB {
    return db.Select("Id", "OrderId", "ProductId", "Quantity", "Price")
}).Preload("OrderItems.Product", func(db *gorm.DB) *gorm.DB {
    return db.Select("Id", "Name", "BrandCode", "Price", "ImageUrl")
}).Find(&orders)

// Admin 주문 상세 — User 비밀번호/개인정보 제외
db.Preload("User", func(db *gorm.DB) *gorm.DB {
    return db.Select("Id", "Email", "Name", "Phone", "Role", "KycStatus")
})

// 선물 목록 — Sender 최소 필드 (FK: Id 필수)
db.Preload("Sender", func(db *gorm.DB) *gorm.DB {
    return db.Select("Id", "Name", "Email")
})
```

### 2C. UPDLOCK 쿼리 최적화

```go
// Before: SELECT * (모든 컬럼 락)
tx.Raw("SELECT TOP(?) * FROM VoucherCodes WITH (UPDLOCK, READPAST) WHERE ProductId = ? AND Status = 'AVAILABLE'", needed, productID)

// After: Id만 SELECT (락 범위 최소화, 이후 Id 기반 UPDATE)
tx.Raw("SELECT TOP(?) Id FROM VoucherCodes WITH (UPDLOCK, READPAST) WHERE ProductId = ? AND Status = 'AVAILABLE'", needed, productID)
```

이후 코드에서 voucherIDs를 추출하여 UPDATE에 사용하는 패턴은 동일하게 유지.

### 2D. 검색 최적화

```go
// Before: 양방향 LIKE (인덱스 미사용)
db.Where("(Email LIKE ? OR Name LIKE ?)", "%query%", "%query%")

// After: 이메일은 전방 일치 (인덱스 활용), 이름은 양방향 LIKE
db.Where("Email LIKE ? OR Name LIKE ?", query+"%", "%"+query+"%")
```

### 2E. Count 쿼리

현재 `base_repository.go`의 Count 패턴은 GORM이 `SELECT COUNT(*)` 생성 → **이미 최적**. 변경 불필요.

---

## 3. FK 제약조건

**원칙: 모든 FK는 ON DELETE NO ACTION (기본값)**. 금융 데이터에서 CASCADE 삭제는 위험.

**예외**: CartItems, RefreshTokens만 ON DELETE CASCADE (사용자 탈퇴 시 자동 정리 필요).

```sql
-- 주문 → 사용자
ALTER TABLE Orders WITH NOCHECK ADD CONSTRAINT FK_Orders_Users
  FOREIGN KEY (UserId) REFERENCES Users(Id);
ALTER TABLE Orders CHECK CONSTRAINT FK_Orders_Users;

-- 주문 아이템 → 주문 (NO ACTION: 주문 삭제 시 아이템 보존)
ALTER TABLE OrderItems WITH NOCHECK ADD CONSTRAINT FK_OrderItems_Orders
  FOREIGN KEY (OrderId) REFERENCES Orders(Id);
ALTER TABLE OrderItems CHECK CONSTRAINT FK_OrderItems_Orders;

-- 주문 아이템 → 상품
ALTER TABLE OrderItems WITH NOCHECK ADD CONSTRAINT FK_OrderItems_Products
  FOREIGN KEY (ProductId) REFERENCES Products(Id);
ALTER TABLE OrderItems CHECK CONSTRAINT FK_OrderItems_Products;

-- 바우처 → 상품
ALTER TABLE VoucherCodes WITH NOCHECK ADD CONSTRAINT FK_VoucherCodes_Products
  FOREIGN KEY (ProductId) REFERENCES Products(Id);
ALTER TABLE VoucherCodes CHECK CONSTRAINT FK_VoucherCodes_Products;

-- 바우처 → 주문 (nullable FK)
ALTER TABLE VoucherCodes WITH NOCHECK ADD CONSTRAINT FK_VoucherCodes_Orders
  FOREIGN KEY (OrderId) REFERENCES Orders(Id);
ALTER TABLE VoucherCodes CHECK CONSTRAINT FK_VoucherCodes_Orders;

-- 장바구니 → 사용자 (CASCADE: 탈퇴 시 장바구니 자동 삭제)
ALTER TABLE CartItems WITH NOCHECK ADD CONSTRAINT FK_CartItems_Users
  FOREIGN KEY (UserId) REFERENCES Users(Id) ON DELETE CASCADE;
ALTER TABLE CartItems CHECK CONSTRAINT FK_CartItems_Users;

-- 장바구니 → 상품
ALTER TABLE CartItems WITH NOCHECK ADD CONSTRAINT FK_CartItems_Products
  FOREIGN KEY (ProductId) REFERENCES Products(Id);
ALTER TABLE CartItems CHECK CONSTRAINT FK_CartItems_Products;

-- 선물 → 주문
ALTER TABLE Gifts WITH NOCHECK ADD CONSTRAINT FK_Gifts_Orders
  FOREIGN KEY (OrderId) REFERENCES Orders(Id);
ALTER TABLE Gifts CHECK CONSTRAINT FK_Gifts_Orders;

-- 선물 → 보내는/받는 사람
ALTER TABLE Gifts WITH NOCHECK ADD CONSTRAINT FK_Gifts_Sender
  FOREIGN KEY (SenderId) REFERENCES Users(Id);
ALTER TABLE Gifts CHECK CONSTRAINT FK_Gifts_Sender;
ALTER TABLE Gifts WITH NOCHECK ADD CONSTRAINT FK_Gifts_Receiver
  FOREIGN KEY (ReceiverId) REFERENCES Users(Id);
ALTER TABLE Gifts CHECK CONSTRAINT FK_Gifts_Receiver;

-- 매입 → 사용자
ALTER TABLE TradeIns WITH NOCHECK ADD CONSTRAINT FK_TradeIns_Users
  FOREIGN KEY (UserId) REFERENCES Users(Id);
ALTER TABLE TradeIns CHECK CONSTRAINT FK_TradeIns_Users;

-- 매입 → 상품
ALTER TABLE TradeIns WITH NOCHECK ADD CONSTRAINT FK_TradeIns_Products
  FOREIGN KEY (ProductId) REFERENCES Products(Id);
ALTER TABLE TradeIns CHECK CONSTRAINT FK_TradeIns_Products;

-- 결제 → 주문
ALTER TABLE Payments WITH NOCHECK ADD CONSTRAINT FK_Payments_Orders
  FOREIGN KEY (OrderId) REFERENCES Orders(Id);
ALTER TABLE Payments CHECK CONSTRAINT FK_Payments_Orders;

-- 환불 → 주문
ALTER TABLE Refunds WITH NOCHECK ADD CONSTRAINT FK_Refunds_Orders
  FOREIGN KEY (OrderId) REFERENCES Orders(Id);
ALTER TABLE Refunds CHECK CONSTRAINT FK_Refunds_Orders;

-- 문의 → 사용자
ALTER TABLE Inquiries WITH NOCHECK ADD CONSTRAINT FK_Inquiries_Users
  FOREIGN KEY (UserId) REFERENCES Users(Id);
ALTER TABLE Inquiries CHECK CONSTRAINT FK_Inquiries_Users;

-- 리프레시 토큰 → 사용자 (CASCADE: 탈퇴 시 세션 자동 삭제)
ALTER TABLE RefreshTokens WITH NOCHECK ADD CONSTRAINT FK_RefreshTokens_Users
  FOREIGN KEY (UserId) REFERENCES Users(Id) ON DELETE CASCADE;
ALTER TABLE RefreshTokens CHECK CONSTRAINT FK_RefreshTokens_Users;
```

---

## 4. 마이그레이션 스크립트

**파일**: `scripts/schema-optimize.sql`

### 실행 순서:
1. 고아 데이터 확인 (FK 추가 전 필수)
2. FK 제약조건 추가 (WITH NOCHECK → CHECK)
3. 인덱스 추가 (IF NOT EXISTS)
4. 중복 인덱스 제거
5. 검증 쿼리

### 고아 데이터 확인 (FK 추가 전 반드시 실행):

```sql
-- 고아 주문 아이템 확인
SELECT oi.Id, oi.OrderId FROM OrderItems oi
LEFT JOIN Orders o ON oi.OrderId = o.Id WHERE o.Id IS NULL;

-- 고아 바우처 확인
SELECT vc.Id, vc.OrderId FROM VoucherCodes vc
LEFT JOIN Orders o ON vc.OrderId = o.Id WHERE vc.OrderId IS NOT NULL AND o.Id IS NULL;

-- 고아 장바구니 확인
SELECT ci.Id, ci.UserId FROM CartItems ci
LEFT JOIN Users u ON ci.UserId = u.Id WHERE u.Id IS NULL;
```

### 주의사항:
- MSSQL Standard Edition: `CREATE INDEX`는 오프라인 작업. 트래픽 적은 시간대에 실행
- `WITH NOCHECK`으로 FK 추가 후 `CHECK CONSTRAINT`로 검증 (락 최소화)
- AutoMigrate 미사용이므로 GORM 인덱스 태그와 SQL 스크립트 충돌 없음

---

## 5. Go 코드 변경 파일 목록

| 파일 | 변경 내용 |
|------|----------|
| `internal/domain/order.go` | 인덱스 태그 추가 (문서화용) |
| `internal/domain/voucher.go` | 인덱스 태그 추가 |
| `internal/domain/tradein.go` | 인덱스 태그 추가 |
| `internal/domain/product.go` | 인덱스 태그 추가 |
| `internal/domain/inquiry.go` | 인덱스 태그 추가 |
| `internal/app/services/order_service.go` | Select 명시, Preload 최적화, UPDLOCK SELECT Id만 |
| `internal/app/services/product_service.go` | 목록 Select 명시 |
| `internal/app/services/cart_service.go` | (변경 최소 — 이미 Select 사용) |
| `internal/app/services/tradein_service.go` | 목록 Select 명시 |
| `internal/app/services/gift_service.go` | 검색 최적화 (전방일치), Preload 제한 |
| `internal/app/services/content_service.go` | 목록 Content/Answer 제외 |
| `internal/app/services/admin_order_svc.go` | Preload User 필드 제한 |
| `scripts/schema-optimize.sql` | 신규: 마이그레이션 SQL |

## 검증

```bash
# Go 문법 검증 (빌드는 wails build 필수, 문법만 go vet)
cd go-server && go vet ./...

# SQL 스크립트 실행 (SSMS 또는 sqlcmd)
sqlcmd -S server -d database -i scripts/schema-optimize.sql

# 인덱스 확인
SELECT name, type_desc FROM sys.indexes WHERE object_id = OBJECT_ID('Orders');
SELECT name, type_desc FROM sys.indexes WHERE object_id = OBJECT_ID('VoucherCodes');

# FK 확인
SELECT name, type_desc FROM sys.foreign_keys WHERE parent_object_id = OBJECT_ID('OrderItems');

# 실행 계획 확인 (주요 쿼리)
SET STATISTICS IO ON;
SELECT Id, OrderCode, TotalAmount, Status FROM Orders WHERE UserId = 1 ORDER BY Id DESC;
```
