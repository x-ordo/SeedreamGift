-- Migration 012: Order 의 deadline 관련 3 컬럼 공식화 + Order.Status 컬럼 크기 확보.
--
-- 배경 (정합성 검증 2026-04-24):
--   Go domain/order.go:47-51 에 정의된 PaymentDeadlineAt / WithdrawalDeadlineAt /
--   DigitalDeliveryAt 3 컬럼이 Prisma schema / 기존 Go migrations / GORM AutoMigrate
--   어디에도 공식 기록이 없어 신규 환경 배포 시 런타임 오류가 발생할 수 있음.
--   실제 사용처:
--     - order_service.go:660   CancelExpiredOrders     WHERE PaymentDeadlineAt < now
--     - vaccount_svc.go:188    Issue                    UPDATE PaymentDeadlineAt
--     - vaccount_svc.go:344    Resume                   UPDATE PaymentDeadlineAt
--     - order_test.go:149      TestCreateOrder_Success  assert.NotNil PaymentDeadlineAt/WithdrawalDeadlineAt
--
--   Order.Status 크기도 함께 확장: Prisma VARCHAR(12) 에서 AMOUNT_MISMATCH(15자)
--   / REFUND_PAID(11자) 등 Phase 3-5 신규 enum 값을 안전하게 수용하려면 VARCHAR(20)
--   필요 (Go domain order.go:23 size:20 일치).
--
-- 작성: 2026-04-24
-- 대상: dbo.Orders
-- Idempotent: 모든 DDL 이 IF NOT EXISTS / 값 확인 가드 — 반복 실행 안전.
--
-- 동기화: server/prisma/schema.prisma 도 동일 컬럼·크기 추가 (별도 작업).

SET NOCOUNT ON;

-- 1) PaymentDeadlineAt — VA 입금 기한 / 무통장 입금 기한.
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.Orders') AND name = 'PaymentDeadlineAt'
)
BEGIN
    ALTER TABLE dbo.Orders ADD PaymentDeadlineAt DATETIME2 NULL;
    PRINT 'Added Orders.PaymentDeadlineAt (DATETIME2 NULL)';
END
ELSE
    PRINT 'Orders.PaymentDeadlineAt already exists — skip';

-- 2) WithdrawalDeadlineAt — 주문 취소 가능 기한.
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.Orders') AND name = 'WithdrawalDeadlineAt'
)
BEGIN
    ALTER TABLE dbo.Orders ADD WithdrawalDeadlineAt DATETIME2 NULL;
    PRINT 'Added Orders.WithdrawalDeadlineAt (DATETIME2 NULL)';
END
ELSE
    PRINT 'Orders.WithdrawalDeadlineAt already exists — skip';

-- 3) DigitalDeliveryAt — 디지털 상품 발송 시각.
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.Orders') AND name = 'DigitalDeliveryAt'
)
BEGIN
    ALTER TABLE dbo.Orders ADD DigitalDeliveryAt DATETIME2 NULL;
    PRINT 'Added Orders.DigitalDeliveryAt (DATETIME2 NULL)';
END
ELSE
    PRINT 'Orders.DigitalDeliveryAt already exists — skip';

-- 4) CancelExpiredOrders 및 SeedreamExpiryService 가 PaymentDeadlineAt 로 스캔하므로
--    인덱스 추가 (status + deadline 조합). Filtered index 로 활성 주문만 대상.
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_Orders_Status_PaymentDeadlineAt'
      AND object_id = OBJECT_ID('dbo.Orders')
)
BEGIN
    CREATE INDEX IX_Orders_Status_PaymentDeadlineAt
        ON dbo.Orders (Status, PaymentDeadlineAt)
        WHERE PaymentDeadlineAt IS NOT NULL;
    PRINT 'Created IX_Orders_Status_PaymentDeadlineAt (filtered)';
END
ELSE
    PRINT 'IX_Orders_Status_PaymentDeadlineAt already exists — skip';

-- 5) Orders.Status 컬럼 크기를 VARCHAR(20) 으로 확장 (Phase 3-5 enum 수용).
--    migration 008 이 이미 VARCHAR(20) 로 확장했을 가능성이 높지만, Prisma 가
--    VARCHAR(12) 로 강제하므로 안전하게 재확장. 이미 VARCHAR(20) 이상이면 NO-OP.
DECLARE @CurrentLen INT = (
    SELECT CAST(c.max_length AS INT)
    FROM sys.columns c
    WHERE c.object_id = OBJECT_ID('dbo.Orders')
      AND c.name      = 'Status'
);

IF @CurrentLen IS NULL
BEGIN
    PRINT 'Orders.Status column not found — unexpected state';
END
ELSE IF @CurrentLen < 20
BEGIN
    ALTER TABLE dbo.Orders ALTER COLUMN Status VARCHAR(20) NOT NULL;
    PRINT 'Extended Orders.Status to VARCHAR(20)';
END
ELSE
    PRINT 'Orders.Status already >= VARCHAR(20) — skip';
