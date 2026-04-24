-- Migration 013: UX_Payments_OrderId_Pending filtered unique index 의 WHERE 절
-- 에 Method='VIRTUAL_ACCOUNT_SEEDREAM' 필터 추가.
--
-- 배경 (정합성 검증 2026-04-24, 설계 이슈 #3):
--   migration 011 이 생성한 인덱스는 Method 와 무관하게 "OrderId 당 PENDING Payment 1건" 을
--   강제하여 장래 CASH/VA 병행 시나리오 또는 legacy CASH 주문 재활용 시 unique violation
--   가능. 현재는 한 주문이 한 가지 결제 수단만 쓰므로 영향 없지만 방어적 범위 축소.
--
-- 전략:
--   - DROP + CREATE 패턴 (MSSQL 은 filtered index 의 WHERE 절 ALTER 불가)
--   - 기존 인덱스가 없거나 이미 새 필터로 존재하면 NO-OP
--   - race 방어는 유지: Method='VIRTUAL_ACCOUNT_SEEDREAM' + Status='PENDING' 조합으로
--     Seedream VA 중복 발급만 정확히 차단.
--
-- 작성: 2026-04-24
-- 대상: dbo.Payments
-- Idempotent: 반복 실행 안전.

SET NOCOUNT ON;

-- 1) 기존 index 가 있으면 DROP — migration 011 버전을 덮어씀.
IF EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'UX_Payments_OrderId_Pending'
      AND object_id = OBJECT_ID('dbo.Payments')
)
BEGIN
    DROP INDEX UX_Payments_OrderId_Pending ON dbo.Payments;
    PRINT 'Dropped legacy UX_Payments_OrderId_Pending (migration 011)';
END

-- 2) Method 필터 포함 filtered unique index 재생성.
--    filter_definition 은 sys.indexes 에 저장되므로 장래 변경 시 쿼리로 확인 가능.
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'UX_Payments_OrderId_Pending'
      AND object_id = OBJECT_ID('dbo.Payments')
)
BEGIN
    CREATE UNIQUE INDEX UX_Payments_OrderId_Pending
        ON dbo.Payments (OrderId)
        WHERE Status = 'PENDING' AND Method = 'VIRTUAL_ACCOUNT_SEEDREAM';
    PRINT 'Created UX_Payments_OrderId_Pending (filtered: Status=PENDING AND Method=VIRTUAL_ACCOUNT_SEEDREAM)';
END
ELSE
    PRINT 'UX_Payments_OrderId_Pending already exists after DROP — unexpected';
