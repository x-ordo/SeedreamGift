-- Migration 009: Seedreampay 자체 발행 상품권 스키마
-- Phase 1: 순수 additive — 기존 컬럼 DROP 없음
-- 참조: docs/superpowers/specs/2026-04-22-seedreampay-voucher-design.md §11

-- ─────────────────────────────────────────────────────────
-- 1. Brand insert
-- ─────────────────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM Brands WHERE Code='SEEDREAMPAY')
BEGIN
    INSERT INTO Brands (Code, Name, Color, [Order])
    VALUES ('SEEDREAMPAY', '씨드림페이', '#3182F6', 99);
    PRINT 'Inserted Brand: SEEDREAMPAY';
END
ELSE
    PRINT 'Brand SEEDREAMPAY already exists - skipping';
GO

-- ─────────────────────────────────────────────────────────
-- 2. VoucherCodes 컬럼 추가 (nullable additive)
-- ─────────────────────────────────────────────────────────
IF COL_LENGTH('VoucherCodes','SerialNo') IS NULL
BEGIN
    ALTER TABLE VoucherCodes ADD SerialNo NVARCHAR(20) NULL;
    PRINT 'Added VoucherCodes.SerialNo';
END
GO

IF COL_LENGTH('VoucherCodes','SecretHash') IS NULL
BEGIN
    ALTER TABLE VoucherCodes ADD SecretHash CHAR(64) NULL;
    PRINT 'Added VoucherCodes.SecretHash';
END
GO

IF COL_LENGTH('VoucherCodes','RedeemedOrderId') IS NULL
BEGIN
    ALTER TABLE VoucherCodes ADD RedeemedOrderId INT NULL;
    PRINT 'Added VoucherCodes.RedeemedOrderId';
END
GO

IF COL_LENGTH('VoucherCodes','RedeemedIp') IS NULL
BEGIN
    ALTER TABLE VoucherCodes ADD RedeemedIp NVARCHAR(45) NULL;
    PRINT 'Added VoucherCodes.RedeemedIp';
END
GO

-- ─────────────────────────────────────────────────────────
-- 3. Filtered UNIQUE index (SerialNo)
-- ─────────────────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='UX_VoucherCode_SerialNo')
BEGIN
    CREATE UNIQUE INDEX UX_VoucherCode_SerialNo
        ON VoucherCodes(SerialNo) WHERE SerialNo IS NOT NULL;
    PRINT 'Created UX_VoucherCode_SerialNo';
END
ELSE
    PRINT 'UX_VoucherCode_SerialNo already exists - skipping';
GO

-- ─────────────────────────────────────────────────────────
-- 4. Products 4개 권종 insert (idempotent MERGE)
-- ─────────────────────────────────────────────────────────
MERGE Products AS target
USING (VALUES
    ('SEEDREAMPAY','씨드림페이 1,000원권',   1000, 'API','SEEDREAMPAY','1000'),
    ('SEEDREAMPAY','씨드림페이 10,000원권', 10000, 'API','SEEDREAMPAY','10000'),
    ('SEEDREAMPAY','씨드림페이 100,000원권',100000,'API','SEEDREAMPAY','100000'),
    ('SEEDREAMPAY','씨드림페이 500,000원권',500000,'API','SEEDREAMPAY','500000')
) AS src (Brand, Name, Price, FulfillmentType, ProviderCode, ProviderProductCode)
ON target.Brand = src.Brand AND target.ProviderProductCode = src.ProviderProductCode
WHEN NOT MATCHED THEN
    INSERT (Brand, Name, Price, DiscountRate, TradeInRate,
            FulfillmentType, ProviderCode, ProviderProductCode)
    VALUES (src.Brand, src.Name, src.Price, 0, 0,
            src.FulfillmentType, src.ProviderCode, src.ProviderProductCode);
PRINT 'Seedreampay Products merged (4 denominations)';
GO
