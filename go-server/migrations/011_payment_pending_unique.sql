-- Migration 011: Seedream VA 동시 발급 race 의 DB 레벨 최종 방어.
--
-- 같은 Order 에 대해 PENDING 상태 Payment 가 동시에 두 개 생성되는 것을 막음.
-- MSSQL filtered unique index 로 구현 — CANCELLED/PAID/FAILED 등 완료 상태는 여러 개 허용.
--
-- 애플리케이션 레벨에서는 vaccount_svc.go 가 빠른 경로 SELECT + 트랜잭션 안 재확인으로
-- race 를 이미 상당 부분 차단. 이 index 는 그 마지막 방어선 (defense in depth).
--
-- 작성: 2026-04-24 (Phase 5 후 ux/race 보강)
-- 대상 테이블: dbo.Payments
--
-- Idempotent: 이미 존재하면 skip.

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'UX_Payments_OrderId_Pending'
      AND object_id = OBJECT_ID('dbo.Payments')
)
BEGIN
    CREATE UNIQUE INDEX UX_Payments_OrderId_Pending
    ON dbo.Payments (OrderId)
    WHERE Status = 'PENDING';

    PRINT 'Created UX_Payments_OrderId_Pending filtered unique index';
END
ELSE
BEGIN
    PRINT 'UX_Payments_OrderId_Pending already exists — skipping';
END
