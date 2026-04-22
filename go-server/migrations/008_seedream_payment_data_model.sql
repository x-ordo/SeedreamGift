-- Migration 008: Seedream API 결제 통합 데이터 모델
-- Phase 1: 순수 additive — 기존 컬럼 DROP 없음 (PaymentKey DROP 은 Phase 6 로 연기)
-- 참조: docs/superpowers/specs/2026-04-22-seedream-payment-integration-design.md §4

-- ─────────────────────────────────────────────────────────
-- 1. Orders.Status 컬럼 크기 12 → 20 (ISSUED/EXPIRED/AMOUNT_MISMATCH 수용)
-- ─────────────────────────────────────────────────────────
IF EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('Orders')
      AND name = 'Status'
      AND max_length = 12 * 2  -- NVARCHAR 는 UTF-16 이므로 12자 = 24바이트
)
BEGIN
    ALTER TABLE Orders ALTER COLUMN Status NVARCHAR(20) NOT NULL;
    PRINT 'Orders.Status expanded to NVARCHAR(20)';
END
ELSE
BEGIN
    PRINT 'Orders.Status already at NVARCHAR(20) or later — skipping';
END
GO

-- ─────────────────────────────────────────────────────────
-- 2. Payments 테이블에 Seedream 필드 3개 추가 (vendor-prefixed 컬럼명)
-- ─────────────────────────────────────────────────────────
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('Payments') AND name = 'SeedreamVAccountId'
)
BEGIN
    ALTER TABLE Payments ADD SeedreamVAccountId BIGINT NULL;
    PRINT 'Added Payments.SeedreamVAccountId';
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('Payments') AND name = 'SeedreamPhase'
)
BEGIN
    ALTER TABLE Payments ADD SeedreamPhase NVARCHAR(30) NULL;
    PRINT 'Added Payments.SeedreamPhase';
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('Payments') AND name = 'SeedreamIdempotencyKey'
)
BEGIN
    ALTER TABLE Payments ADD SeedreamIdempotencyKey NVARCHAR(200) NULL;
    PRINT 'Added Payments.SeedreamIdempotencyKey';
END
GO

-- SeedreamVAccountId 인덱스 (단건 조회 용도)
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('Payments') AND name = 'IX_Payments_SeedreamVAccountId'
)
BEGIN
    CREATE INDEX IX_Payments_SeedreamVAccountId
        ON Payments(SeedreamVAccountId)
        WHERE SeedreamVAccountId IS NOT NULL;
    PRINT 'Created IX_Payments_SeedreamVAccountId';
END
GO

-- ─────────────────────────────────────────────────────────
-- 3. WebhookReceipts 테이블 (웹훅 멱등 수신 로그)
-- ─────────────────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'WebhookReceipts')
BEGIN
    CREATE TABLE WebhookReceipts (
        DeliveryId   BIGINT        NOT NULL PRIMARY KEY,    -- Seedream WebhookDeliveries.Id
        Event        NVARCHAR(50)  NOT NULL,
        EventId      NVARCHAR(36)  NULL,                    -- payload.eventId (uuid)
        OrderNo      NVARCHAR(50)  NULL,
        ReceivedAt   DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
        ProcessedAt  DATETIME2     NULL,
        RawBody      NVARCHAR(MAX) NULL
    );
    PRINT 'Created WebhookReceipts table';

    CREATE INDEX IX_WebhookReceipts_EventId ON WebhookReceipts(EventId)
        WHERE EventId IS NOT NULL;
    PRINT 'Created IX_WebhookReceipts_EventId';

    CREATE INDEX IX_WebhookReceipts_OrderNo ON WebhookReceipts(OrderNo)
        WHERE OrderNo IS NOT NULL;
    PRINT 'Created IX_WebhookReceipts_OrderNo';

    CREATE INDEX IX_WebhookReceipts_ReceivedAt ON WebhookReceipts(ReceivedAt DESC);
    PRINT 'Created IX_WebhookReceipts_ReceivedAt';
END
GO

-- ─────────────────────────────────────────────────────────
-- 4. SeedreamReconcileCursors 테이블 (싱글턴 Reconcile 커서)
-- ─────────────────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'SeedreamReconcileCursors')
BEGIN
    CREATE TABLE SeedreamReconcileCursors (
        Id           INT           NOT NULL PRIMARY KEY DEFAULT 1,
        LastSyncAt   DATETIME2     NOT NULL DEFAULT '1970-01-01',
        LastRunAt    DATETIME2     NOT NULL DEFAULT '1970-01-01',
        LastErrorAt  DATETIME2     NULL,
        LastError    NVARCHAR(500) NULL,
        CONSTRAINT CK_SeedreamReconcileCursors_Singleton CHECK (Id = 1)
    );
    PRINT 'Created SeedreamReconcileCursors table';

    -- Seed 싱글턴 row. 최초 Reconcile 은 이 LastSyncAt 시점부터 조회.
    INSERT INTO SeedreamReconcileCursors (Id, LastSyncAt, LastRunAt)
    VALUES (1, SYSUTCDATETIME(), SYSUTCDATETIME());
    PRINT 'Inserted singleton ReconcileCursor seed row';
END
GO

PRINT 'Migration 008 complete.';
GO
