-- Post-migration verification (migrations 008~013 적용 확인)
-- Runner: 각 SELECT 결과가 한 batch 의 단일 row 로 출력됩니다.

-- 1) Orders deadline 컬럼 3개 (012 적용 확인)
SELECT COUNT(*) AS deadline_cols_present
FROM sys.columns
WHERE object_id = OBJECT_ID('dbo.Orders')
  AND name IN ('PaymentDeadlineAt','WithdrawalDeadlineAt','DigitalDeliveryAt');
-- expected: 3

-- 2) Orders.Status 크기 = 20 (008 + 012 guard)
SELECT max_length AS orders_status_size
FROM sys.columns
WHERE object_id = OBJECT_ID('dbo.Orders') AND name = 'Status';
-- expected: 20

-- 3) UX_Payments_OrderId_Pending filter 정의 (011 → 013 교체 확인)
SELECT filter_definition AS payments_pending_filter
FROM sys.indexes
WHERE object_id = OBJECT_ID('dbo.Payments')
  AND name = 'UX_Payments_OrderId_Pending';
-- expected: ([Status]='PENDING' AND [Method]='VIRTUAL_ACCOUNT_SEEDREAM')

-- 4) Orders filtered index (012 추가)
SELECT COUNT(*) AS orders_deadline_idx_present
FROM sys.indexes
WHERE object_id = OBJECT_ID('dbo.Orders')
  AND name = 'IX_Orders_Status_PaymentDeadlineAt';
-- expected: 1

-- 5) Payments.SeedreamDaouTrx 컬럼 + index (010 적용 확인)
SELECT
  (SELECT COUNT(*) FROM sys.columns
   WHERE object_id = OBJECT_ID('dbo.Payments') AND name = 'SeedreamDaouTrx') AS daoutrx_col,
  (SELECT COUNT(*) FROM sys.indexes
   WHERE object_id = OBJECT_ID('dbo.Payments') AND name = 'IX_Payments_SeedreamDaouTrx') AS daoutrx_idx;
-- expected: 1, 1

-- 6) WebhookReceipts + ReconcileCursors 테이블 (008)
SELECT
  (SELECT COUNT(*) FROM sys.tables WHERE name = 'WebhookReceipts')      AS webhook_receipts_table,
  (SELECT COUNT(*) FROM sys.tables WHERE name = 'SeedreamReconcileCursors') AS reconcile_cursors_table,
  (SELECT COUNT(*) FROM dbo.SeedreamReconcileCursors) AS reconcile_seed_rows;
-- expected: 1, 1, 1

-- 7) VoucherCodes Seedreampay 컬럼 + index (009)
SELECT
  (SELECT COUNT(*) FROM sys.columns WHERE object_id = OBJECT_ID('dbo.VoucherCodes')
   AND name IN ('SerialNo','SecretHash','RedeemedOrderId','RedeemedIp')) AS seedreampay_cols,
  (SELECT COUNT(*) FROM sys.indexes  WHERE object_id = OBJECT_ID('dbo.VoucherCodes')
   AND name = 'UX_VoucherCode_SerialNo') AS seedreampay_serial_idx;
-- expected: 4, 1
