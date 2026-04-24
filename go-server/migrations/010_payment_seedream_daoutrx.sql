-- Migration 010: Payment.SeedreamDaouTrx 필드 추가
-- Phase 4: Cancel/Refund 호출 시 키움 trxId 파라미터 캐시.
-- 값 출처:
--   (a) GET /api/v1/vaccount?orderNo=X 응답 items[0].daouTrx
--   (b) VAccountCancelled / DepositCancelDeposited 웹훅 payload
-- Partial unique not required — Seedream 쪽에서 DaouTrx 고유성 보장.
-- 참조: docs/superpowers/plans/2026-04-23-seedream-payment-phase-4-cancel-refund.md

-- ─────────────────────────────────────────────────────────
-- 1. Payments.SeedreamDaouTrx 컬럼 추가 (nullable additive)
--    NVARCHAR(20) — Seedream 기존 Seedream* 컬럼들과 동일 dialect.
--    awaiting_bank_selection 단계에서는 NULL (은행선택 완료 시점에 값 세팅).
-- ─────────────────────────────────────────────────────────
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('Payments') AND name = 'SeedreamDaouTrx'
)
BEGIN
    ALTER TABLE Payments ADD SeedreamDaouTrx NVARCHAR(20) NULL;
    PRINT 'Added Payments.SeedreamDaouTrx';
END
ELSE
    PRINT 'Payments.SeedreamDaouTrx already exists - skipping';
GO

-- ─────────────────────────────────────────────────────────
-- 2. Filtered index (감사 추적 / Reconcile 조회)
--    Partial: NULL 제외하여 awaiting_bank_selection 단계 행 인덱스 부담 절감.
-- ─────────────────────────────────────────────────────────
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('Payments') AND name = 'IX_Payments_SeedreamDaouTrx'
)
BEGIN
    CREATE INDEX IX_Payments_SeedreamDaouTrx
        ON Payments(SeedreamDaouTrx)
        WHERE SeedreamDaouTrx IS NOT NULL;
    PRINT 'Created IX_Payments_SeedreamDaouTrx';
END
ELSE
    PRINT 'IX_Payments_SeedreamDaouTrx already exists - skipping';
GO

PRINT 'Migration 010 complete.';
GO
