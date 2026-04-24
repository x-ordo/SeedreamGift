# 씨드림페이 상품권 Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 씨드림기프트 몰 내부에서 1회 사용 가능한 씨드림 자체 발행 상품권(씨드림페이)을 구매·발급·사용·환불할 수 있는 백엔드 시스템을 구축한다.

**Architecture:** 기존 `VoucherIssuer` 인터페이스에 `SeedreampayIssuer` 구현체를 추가하여 `FulfillmentService` 파이프라인을 그대로 재사용한다. 내부 이슈어는 외부 HTTP 호출 대신 DB 트랜잭션으로 `VoucherCode` 레코드를 생성하며, 공개 코드(SerialNo)와 비밀 코드(Secret)를 분리하여 Secret은 peppered SHA-256 해시만 저장한다. 사용(redeem)은 `Status='SOLD'→'USED'` 상태 전이 자체를 낙관적 락 토큰(CAS)으로 활용한다.

**Tech Stack:** Go 1.21+, Gin, GORM v2 (MSSQL), Redis(락아웃), testify, `sqlmock`/`miniredis` for unit tests, `httptest` for handler tests

**Reference Spec:** `docs/superpowers/specs/2026-04-22-seedreampay-voucher-design.md`

**Branch Strategy** (from spec §12):

| 브랜치 | 담당 Task |
|--------|-----------|
| `feat/seedreampay-voucher-p1-schema` | Task 1–2 |
| `feat/seedreampay-voucher-p1-issuer` | Task 3–6 |
| `feat/seedreampay-voucher-p1-redeem` | Task 7–12 |

각 브랜치가 끝나면 독립 PR. 다음 브랜치는 이전 브랜치 머지 후 기반에서 분기.

---

## File Structure

### Created
```
go-server/migrations/009_seedreampay_schema.sql
go-server/internal/infra/issuance/seedreampay_codes.go
go-server/internal/infra/issuance/seedreampay_codes_test.go
go-server/internal/infra/issuance/seedreampay_issuer.go
go-server/internal/infra/issuance/seedreampay_issuer_test.go
go-server/internal/infra/lockout/lockout_guard.go
go-server/internal/infra/lockout/lockout_guard_test.go
go-server/internal/app/services/seedreampay_svc.go
go-server/internal/app/services/seedreampay_svc_test.go
go-server/internal/api/handlers/seedreampay_handler.go
go-server/internal/api/handlers/seedreampay_handler_test.go
go-server/internal/api/handlers/admin_seedreampay_handler.go
go-server/test/integration/seedreampay_lifecycle_test.go
```

### Modified
```
go-server/internal/domain/voucher.go                  # add SerialNo/SecretHash/RedeemedOrderId/RedeemedIp
go-server/internal/routes/container.go                # DI-register SeedreampayIssuer, LockoutGuard, service, handlers
go-server/internal/routes/router.go                   # wire /api/v1/seedreampay/* + /admin/seedreampay/*
go-server/internal/cron/scheduler.go                  # add @daily MarkExpiredVouchers
```

### File Responsibility Summary

| File | Responsibility |
|------|----------------|
| `seedreampay_codes.go` | `GenerateSerialNo(faceValue)` + `GenerateSecret()` — pure functions, no DB |
| `seedreampay_issuer.go` | `VoucherIssuer` 구현체. DB 트랜잭션으로 VoucherCode n개 생성 |
| `lockout_guard.go` | Redis 기반 `(serial, ip)` 카운터 + 블록 (fail-open) |
| `seedreampay_svc.go` | `GetVoucherBySerial` / `VerifySecret` / `Redeem` / `Refund` / `MarkExpiredVouchers` |
| `seedreampay_handler.go` | 사용자 API (조회·검증·사용·환불) |
| `admin_seedreampay_handler.go` | 관리자 API (목록·발급 이력 필터) |
| `seedreampay_lifecycle_test.go` | 주문→결제→발급→사용→만료까지 end-to-end |

---

## Prerequisites

- [ ] **P0: 설계 스펙 재독**

스펙 §4–§11을 다시 훑어 용어·필드명·상태값을 머리에 정확히 올려둘 것. 이 플랜의 모든 리터럴(예: `"SEEDREAMPAY"`, `"SOLD"`)은 스펙과 1:1 일치한다.

- [ ] **P1: 개발 환경 확인**

```bash
go version          # 1.21+
# MSSQL test DB 접속 가능한지 (.env.test 의 DATABASE_URL)
go test ./internal/infra/seedream/ -run TestClient -count=1   # 기존 테스트 통과 확인
```

- [ ] **P2: Redis 준비**

로컬 Redis (기본 localhost:6379) 또는 `miniredis` (테스트용) 중 어느 쪽을 쓸지 결정. 이 플랜은 **프로덕션은 Redis**, **테스트는 miniredis**를 전제.

```bash
go get github.com/alicebob/miniredis/v2
go get github.com/redis/go-redis/v9
```

- [ ] **P3: 브랜치 생성**

```bash
git checkout main
git pull
git checkout -b feat/seedreampay-voucher-p1-schema
```

---

# Phase A: Schema 브랜치

## Task 1: DB 마이그레이션 009 작성

**Files:**
- Create: `go-server/migrations/009_seedreampay_schema.sql`

**Branch:** `feat/seedreampay-voucher-p1-schema`

- [ ] **Step 1: 마이그레이션 파일 작성 (idempotent)**

```sql
-- Migration 009: Seedreampay 자체 발행 상품권 스키마
-- Phase 1: 순수 additive — 기존 컬럼 DROP 없음
-- 참조: docs/superpowers/specs/2026-04-22-seedreampay-voucher-design.md §11.1

-- ─────────────────────────────────────────────────────────
-- 1. Brand insert
-- ─────────────────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM Brands WHERE Code='SEEDREAMPAY')
BEGIN
    -- UpdatedAt 은 Prisma @updatedAt 관리 대상이라 DB default 없음 → 명시 필요
    INSERT INTO Brands (Code, Name, Color, [Order], UpdatedAt)
    VALUES ('SEEDREAMPAY', '씨드림페이', '#3182F6', 99, GETDATE());
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
    ALTER TABLE VoucherCodes ADD SerialNo NVARCHAR(32) NULL;
    PRINT 'Added VoucherCodes.SerialNo';
END
ELSE
    PRINT 'VoucherCodes.SerialNo already exists - skipping';
GO

IF COL_LENGTH('VoucherCodes','SecretHash') IS NULL
BEGIN
    ALTER TABLE VoucherCodes ADD SecretHash CHAR(64) NULL;
    PRINT 'Added VoucherCodes.SecretHash';
END
ELSE
    PRINT 'VoucherCodes.SecretHash already exists - skipping';
GO

IF COL_LENGTH('VoucherCodes','RedeemedOrderId') IS NULL
BEGIN
    ALTER TABLE VoucherCodes ADD RedeemedOrderId INT NULL;
    PRINT 'Added VoucherCodes.RedeemedOrderId';
END
ELSE
    PRINT 'VoucherCodes.RedeemedOrderId already exists - skipping';
GO

IF COL_LENGTH('VoucherCodes','RedeemedIp') IS NULL
BEGIN
    ALTER TABLE VoucherCodes ADD RedeemedIp NVARCHAR(45) NULL;
    PRINT 'Added VoucherCodes.RedeemedIp';
END
ELSE
    PRINT 'VoucherCodes.RedeemedIp already exists - skipping';
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
) AS src (BrandCode, Name, Price, FulfillmentType, ProviderCode, ProviderProductCode)
ON target.BrandCode = src.BrandCode AND target.ProviderProductCode = src.ProviderProductCode
WHEN NOT MATCHED THEN
    -- UpdatedAt 은 Prisma @updatedAt 관리 대상이라 DB default 없음 → 명시 필요
    INSERT (BrandCode, Name, Price, BuyPrice, DiscountRate, TradeInRate,
            FulfillmentType, ProviderCode, ProviderProductCode, UpdatedAt)
    VALUES (src.BrandCode, src.Name, src.Price, src.Price, 0, 0,
            src.FulfillmentType, src.ProviderCode, src.ProviderProductCode, GETDATE());
PRINT 'Seedreampay Products merged (4 denominations)';
GO
```

- [ ] **Step 2: 로컬 MSSQL에서 마이그레이션 실행**

기존 runner를 사용:

```powershell
cd go-server
.\migration-runner.exe -migration=migrations\009_seedreampay_schema.sql
```

Expected: 각 `PRINT` 메시지 출력 + 에러 0.

- [ ] **Step 3: 멱등성 검증 (두 번째 실행)**

같은 명령어 재실행. Expected: "already exists - skipping" 로그. 새 row 생성 0.

- [ ] **Step 4: DB 상태 검증 쿼리**

```sql
SELECT COUNT(*) FROM Brands WHERE Code='SEEDREAMPAY';             -- 1
SELECT COUNT(*) FROM Products WHERE BrandCode='SEEDREAMPAY';      -- 4
SELECT COL_LENGTH('VoucherCodes','SerialNo'),
       COL_LENGTH('VoucherCodes','SecretHash'),
       COL_LENGTH('VoucherCodes','RedeemedOrderId'),
       COL_LENGTH('VoucherCodes','RedeemedIp');                   -- 모두 not NULL
SELECT name FROM sys.indexes WHERE name='UX_VoucherCode_SerialNo';-- 1행
```

Expected: 모든 쿼리 예상값 일치.

- [ ] **Step 5: Commit**

```bash
git add go-server/migrations/009_seedreampay_schema.sql
git commit -m "feat(migration): add 009 seedreampay voucher schema"
```

---

## Task 2: VoucherCode 도메인 구조체 확장

**Files:**
- Modify: `go-server/internal/domain/voucher.go`
- Create: `go-server/internal/domain/voucher_seedreampay_test.go`

**Branch:** `feat/seedreampay-voucher-p1-schema` (동일)

- [ ] **Step 1: 실패 테스트 먼저 작성**

```go
// go-server/internal/domain/voucher_seedreampay_test.go
package domain

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestVoucherCode_HasSeedreampayFields(t *testing.T) {
	serial := "SEED-10K1-X7AB-K9PD-M3QY"
	hash := "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
	orderID := 42
	ip := "203.0.113.7"

	vc := VoucherCode{
		SerialNo:        &serial,
		SecretHash:      &hash,
		RedeemedOrderID: &orderID,
		RedeemedIP:      &ip,
	}

	require.Equal(t, "SEED-10K1-X7AB-K9PD-M3QY", *vc.SerialNo)
	require.Equal(t, 64, len(*vc.SecretHash))
	require.Equal(t, 42, *vc.RedeemedOrderID)
	require.Equal(t, "203.0.113.7", *vc.RedeemedIP)
}
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

```bash
cd go-server
go test ./internal/domain/ -run TestVoucherCode_HasSeedreampayFields -v
```

Expected: FAIL — `SerialNo`, `SecretHash`, `RedeemedOrderID`, `RedeemedIP` 필드 미존재.

- [ ] **Step 3: `voucher.go` 에 필드 4개 추가**

```go
// go-server/internal/domain/voucher.go — VoucherCode struct 안, CreatedAt 위쪽에 추가
SerialNo         *string `gorm:"column:SerialNo;size:32" json:"serialNo,omitempty"`
SecretHash       *string `gorm:"column:SecretHash;size:64" json:"-"`
RedeemedOrderID  *int    `gorm:"column:RedeemedOrderId" json:"redeemedOrderId,omitempty"`
RedeemedIP       *string `gorm:"column:RedeemedIp;size:45" json:"redeemedIp,omitempty"`
```

**중요**: `SecretHash` 는 `json:"-"` — API 응답에 절대 직렬화되지 않도록. 스펙 §13 보안 체크리스트.

- [ ] **Step 4: 테스트 통과 확인**

```bash
go test ./internal/domain/ -run TestVoucherCode_HasSeedreampayFields -v
```

Expected: PASS.

- [ ] **Step 5: 전체 도메인 테스트 회귀 확인**

```bash
go test ./internal/domain/ -count=1
```

Expected: 모든 기존 테스트 PASS.

- [ ] **Step 6: Commit**

```bash
git add go-server/internal/domain/voucher.go go-server/internal/domain/voucher_seedreampay_test.go
git commit -m "feat(domain): add Seedreampay fields to VoucherCode (SerialNo/SecretHash/Redeemed*)"
```

- [ ] **Step 7: PR로 머지**

```bash
git push -u origin feat/seedreampay-voucher-p1-schema
gh pr create --title "Seedreampay P1: schema (migration 009 + domain fields)" --body "$(cat <<'EOF'
## Summary
- Migration 009 adds Brand/Products/VoucherCode columns + filtered UNIQUE index
- Domain struct extended with SerialNo / SecretHash / RedeemedOrderID / RedeemedIP

## Test plan
- [ ] Run migration 009 locally — idempotent on second run
- [ ] `go test ./internal/domain/ -count=1` passes

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

PR 머지 후 main 기반으로 다음 브랜치 분기:

```bash
git checkout main
git pull
git checkout -b feat/seedreampay-voucher-p1-issuer
```

---

# Phase B: Issuer 브랜치

## Task 3: SerialNo/Secret 코드 생성기 (순수 함수)

**Files:**
- Create: `go-server/internal/infra/issuance/seedreampay_codes.go`
- Create: `go-server/internal/infra/issuance/seedreampay_codes_test.go`

**Branch:** `feat/seedreampay-voucher-p1-issuer`

- [ ] **Step 1: 실패 테스트 먼저 작성 (code format)**

```go
// go-server/internal/infra/issuance/seedreampay_codes_test.go
package issuance

import (
	"regexp"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

var serialPattern = regexp.MustCompile(`^SEED-(1K01|10K1|100K|500K)-[23456789ABCDEFGHJKMNPQRSTVWXYZ]{4}-[23456789ABCDEFGHJKMNPQRSTVWXYZ]{4}-[23456789ABCDEFGHJKMNPQRSTVWXYZ]{4}$`)

func TestGenerateSerialNo_FormatByFaceValue(t *testing.T) {
	cases := map[int]string{
		1000:   "1K01",
		10000:  "10K1",
		100000: "100K",
		500000: "500K",
	}
	for faceValue, wantTag := range cases {
		got, err := GenerateSerialNo(faceValue)
		require.NoError(t, err)
		require.True(t, serialPattern.MatchString(got), "unexpected format: %s", got)
		require.Contains(t, got, "-"+wantTag+"-", "tag mismatch for %d: %s", faceValue, got)
	}
}

func TestGenerateSerialNo_UnknownFaceValue(t *testing.T) {
	_, err := GenerateSerialNo(7777)
	require.ErrorIs(t, err, ErrUnknownFaceValue)
}

func TestGenerateSerialNo_NoAmbiguousChars(t *testing.T) {
	// 0, O, 1, I, L, U 는 알파벳에 포함되면 안 된다
	forbidden := []string{"0", "O", "I", "L", "U"}
	for i := 0; i < 200; i++ {
		serial, err := GenerateSerialNo(10000)
		require.NoError(t, err)
		// 접두사 "SEED-10K1-" 이후의 난수+체크섬 영역만 검사
		random := strings.TrimPrefix(serial, "SEED-10K1-")
		random = strings.ReplaceAll(random, "-", "")
		for _, f := range forbidden {
			require.NotContains(t, random, f, "forbidden char %s in %s", f, serial)
		}
	}
}

func TestGenerateSecret_Length12Numeric(t *testing.T) {
	re := regexp.MustCompile(`^\d{12}$`)
	for i := 0; i < 100; i++ {
		s, err := GenerateSecret()
		require.NoError(t, err)
		require.True(t, re.MatchString(s), "expected 12-digit numeric, got: %s", s)
	}
}

func TestGenerateSecret_Distribution(t *testing.T) {
	// 100번 생성하면 고유값이 98개 이상 나와야 한다 (충돌 극히 드묾)
	seen := map[string]bool{}
	for i := 0; i < 100; i++ {
		s, err := GenerateSecret()
		require.NoError(t, err)
		seen[s] = true
	}
	require.GreaterOrEqual(t, len(seen), 98)
}
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

```bash
go test ./internal/infra/issuance/ -run TestGenerateSerialNo -v -count=1
```

Expected: FAIL — 함수·에러값 미정의.

- [ ] **Step 3: 최소 구현 작성**

```go
// go-server/internal/infra/issuance/seedreampay_codes.go
package issuance

import (
	"crypto/rand"
	"errors"
	"fmt"
	"hash/crc32"
	"math/big"
)

// 혼동 문자(0/O/1/I/L/U) 제외한 32-char alphabet. Crockford Base32 유사.
const serialAlphabet = "23456789ABCDEFGHJKMNPQRSTVWXYZ" // 길이 확인: 30 — 아래 padTo32 에서 보강

var ErrUnknownFaceValue = errors.New("unknown face value")

// faceValueTag 는 씨드림페이 지원 권종의 4자 태그 매핑입니다. 스펙 §5.1.
var faceValueTag = map[int]string{
	1000:   "1K01",
	10000:  "10K1",
	100000: "100K",
	500000: "500K",
}

// alphabet 은 30자이지만 "5자로 모자라 2자 추가" 조정 없이 그대로 30-char uniform 선택.
// (난수 32자 필요 없음 — base "30 중 고르기"가 동일 난수 품질을 보장함.)

// GenerateSerialNo 는 권종별 공개 코드를 생성한다. 형식:
//	SEED-{tag}-{nnnn}-{nnnn}-{cccc}  (접두사 + 4그룹)
// tag  = 권종 태그(1K01/10K1/100K/500K)
// nnnn = crypto/rand 난수 4자
// cccc = 체크섬 4자 (CRC32 base30 투영)
func GenerateSerialNo(faceValue int) (string, error) {
	tag, ok := faceValueTag[faceValue]
	if !ok {
		return "", fmt.Errorf("%w: %d", ErrUnknownFaceValue, faceValue)
	}
	r1, err := randomChars(4)
	if err != nil {
		return "", err
	}
	r2, err := randomChars(4)
	if err != nil {
		return "", err
	}
	body := fmt.Sprintf("SEED-%s-%s-%s", tag, r1, r2)
	sum := crc32.ChecksumIEEE([]byte(body))
	checksum := checksumChars(sum, 4)
	return body + "-" + checksum, nil
}

func randomChars(n int) (string, error) {
	out := make([]byte, n)
	max := big.NewInt(int64(len(serialAlphabet)))
	for i := 0; i < n; i++ {
		idx, err := rand.Int(rand.Reader, max)
		if err != nil {
			return "", err
		}
		out[i] = serialAlphabet[idx.Int64()]
	}
	return string(out), nil
}

func checksumChars(sum uint32, n int) string {
	out := make([]byte, n)
	base := uint32(len(serialAlphabet))
	for i := 0; i < n; i++ {
		out[i] = serialAlphabet[sum%base]
		sum /= base
	}
	return string(out)
}

// GenerateSecret 는 12자리 숫자 비밀 코드를 생성한다. crypto/rand 로 uniform [0, 10^12).
func GenerateSecret() (string, error) {
	max := big.NewInt(1_000_000_000_000)
	n, err := rand.Int(rand.Reader, max)
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%012d", n.Int64()), nil
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
go test ./internal/infra/issuance/ -run "TestGenerateSerialNo|TestGenerateSecret" -v -count=1
```

Expected: 모든 테스트 PASS.

- [ ] **Step 5: Peppered hash 헬퍼 추가 + 테스트**

같은 파일에 함수 추가:

```go
// go-server/internal/infra/issuance/seedreampay_codes.go 하단에 추가
import "crypto/sha256"
import "encoding/hex"

// SecretHash 는 peppered SHA-256 해시를 계산한다. pepper = serialNo.
// 스펙 §5.2.
func SecretHash(secret, serialNo string) string {
	h := sha256.Sum256([]byte(secret + ":" + serialNo))
	return hex.EncodeToString(h[:])
}
```

테스트 추가 (`seedreampay_codes_test.go` 하단):

```go
func TestSecretHash_Deterministic(t *testing.T) {
	h1 := SecretHash("482917365021", "SEED-10K1-AAAA-BBBB-CCCC")
	h2 := SecretHash("482917365021", "SEED-10K1-AAAA-BBBB-CCCC")
	require.Equal(t, h1, h2)
	require.Len(t, h1, 64)
}

func TestSecretHash_DifferentSerialDifferentHash(t *testing.T) {
	h1 := SecretHash("482917365021", "SEED-10K1-AAAA-BBBB-CCCC")
	h2 := SecretHash("482917365021", "SEED-10K1-XXXX-YYYY-ZZZZ")
	require.NotEqual(t, h1, h2)
}
```

```bash
go test ./internal/infra/issuance/ -run TestSecretHash -v -count=1
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add go-server/internal/infra/issuance/seedreampay_codes.go \
        go-server/internal/infra/issuance/seedreampay_codes_test.go
git commit -m "feat(seedreampay): add SerialNo/Secret generators + peppered SHA-256 hash"
```

---

## Task 4: SeedreampayIssuer 구현 (VoucherIssuer interface)

**Files:**
- Create: `go-server/internal/infra/issuance/seedreampay_issuer.go`
- Create: `go-server/internal/infra/issuance/seedreampay_issuer_test.go`

**Branch:** `feat/seedreampay-voucher-p1-issuer` (동일)

- [ ] **Step 1: 실패 테스트 작성 (sqlmock 기반)**

```go
// go-server/internal/infra/issuance/seedreampay_issuer_test.go
package issuance

import (
	"context"
	"regexp"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/sqlserver"
	"gorm.io/gorm"

	"seedream-gift-server/internal/app/interfaces"
)

func newMockGorm(t *testing.T) (*gorm.DB, sqlmock.Sqlmock) {
	t.Helper()
	sqlDB, mock, err := sqlmock.New(sqlmock.QueryMatcherOption(sqlmock.QueryMatcherRegexp))
	require.NoError(t, err)
	db, err := gorm.Open(sqlserver.New(sqlserver.Config{
		Conn:              sqlDB,
		DisableDatetimePrecision: true,
	}), &gorm.Config{})
	require.NoError(t, err)
	return db, mock
}

func TestSeedreampayIssuer_Issue_Success(t *testing.T) {
	db, mock := newMockGorm(t)
	fixed := time.Date(2026, 4, 23, 10, 0, 0, 0, time.UTC)
	issuer := NewSeedreampayIssuer(db, func() time.Time { return fixed })

	mock.ExpectBegin()
	// SerialNo 충돌 없음을 가정 — INSERT 2회 (Quantity=2)
	mock.ExpectExec(regexp.QuoteMeta(`INSERT INTO "VoucherCodes"`)).
		WillReturnResult(sqlmock.NewResult(1, 1))
	mock.ExpectExec(regexp.QuoteMeta(`INSERT INTO "VoucherCodes"`)).
		WillReturnResult(sqlmock.NewResult(2, 1))
	mock.ExpectCommit()

	out, err := issuer.Issue(context.Background(), interfaces.IssueRequest{
		ProductCode: "10000",
		Quantity:    2,
		OrderCode:   "ORD-001",
		ProductID:   7,
		OrderID:     42,
	})
	require.NoError(t, err)
	require.Len(t, out, 2)
	for _, v := range out {
		require.NotEmpty(t, v.PinCode)        // 원본 Secret 전달됨
		require.NotEmpty(t, v.TransactionRef) // SerialNo
		require.Regexp(t, `^SEED-10K1-`, v.TransactionRef)
		require.Regexp(t, `^\d{12}$`, v.PinCode)
	}
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestSeedreampayIssuer_Issue_InvalidFaceValue(t *testing.T) {
	db, _ := newMockGorm(t)
	issuer := NewSeedreampayIssuer(db, time.Now)
	_, err := issuer.Issue(context.Background(), interfaces.IssueRequest{
		ProductCode: "9999", // 미지원 권종
		Quantity:    1,
	})
	require.ErrorIs(t, err, ErrUnknownFaceValue)
}

func TestSeedreampayIssuer_Issue_QuantityZero(t *testing.T) {
	db, _ := newMockGorm(t)
	issuer := NewSeedreampayIssuer(db, time.Now)
	_, err := issuer.Issue(context.Background(), interfaces.IssueRequest{
		ProductCode: "10000",
		Quantity:    0,
	})
	require.Error(t, err)
}

func TestSeedreampayIssuer_ProviderCode(t *testing.T) {
	db, _ := newMockGorm(t)
	issuer := NewSeedreampayIssuer(db, time.Now)
	require.Equal(t, "SEEDREAMPAY", issuer.ProviderCode())
}
```

**의존성 준비:**
```bash
go get github.com/DATA-DOG/go-sqlmock
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
go test ./internal/infra/issuance/ -run TestSeedreampayIssuer -v -count=1
```

Expected: FAIL — `NewSeedreampayIssuer` 미정의.

- [ ] **Step 3: Issuer 구현**

```go
// go-server/internal/infra/issuance/seedreampay_issuer.go
package issuance

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"time"

	"gorm.io/gorm"

	"seedream-gift-server/internal/app/interfaces"
	"seedream-gift-server/internal/domain"
	"seedream-gift-server/pkg/logger"
	"go.uber.org/zap"
)

const (
	providerCodeSeedreampay = "SEEDREAMPAY"
	voucherStatusSold       = "SOLD"
	serialCollisionRetries  = 3
	validityYears           = 5
)

// ErrSerialCollision 은 SerialNo 충돌이 재시도 한도를 넘었을 때 반환된다.
var ErrSerialCollision = errors.New("serialNo collision exceeded retry limit")

// SeedreampayIssuer 는 씨드림기프트 내부에서 직접 상품권을 발행하는 VoucherIssuer 구현체다.
// 외부 HTTP 호출이 없으므로 httpClient/circuit breaker/apiKey 를 주입받지 않는다.
type SeedreampayIssuer struct {
	db  *gorm.DB
	now func() time.Time
}

func NewSeedreampayIssuer(db *gorm.DB, now func() time.Time) *SeedreampayIssuer {
	if now == nil {
		now = time.Now
	}
	return &SeedreampayIssuer{db: db, now: now}
}

func (s *SeedreampayIssuer) ProviderCode() string { return providerCodeSeedreampay }

// Issue 는 DB 트랜잭션 안에서 VoucherCode 를 n 개 생성한다. 성공 시 원본 Secret 을
// IssuedVoucher.PinCode 에 담아 1회만 호출자에게 전달한다.
func (s *SeedreampayIssuer) Issue(ctx context.Context, req interfaces.IssueRequest) ([]interfaces.IssuedVoucher, error) {
	if req.Quantity < 1 || req.Quantity > 100 {
		return nil, fmt.Errorf("quantity out of range: %d", req.Quantity)
	}
	faceValue, err := strconv.Atoi(req.ProductCode)
	if err != nil {
		return nil, fmt.Errorf("invalid ProductCode %q: %w", req.ProductCode, err)
	}
	if _, ok := faceValueTag[faceValue]; !ok {
		return nil, fmt.Errorf("%w: %d", ErrUnknownFaceValue, faceValue)
	}

	now := s.now()
	expiresAt := now.AddDate(validityYears, 0, 0)
	var out []interfaces.IssuedVoucher

	err = s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		for i := 0; i < req.Quantity; i++ {
			serial, err := s.generateSerialWithRetry(tx, faceValue)
			if err != nil {
				return err
			}
			secret, err := GenerateSecret()
			if err != nil {
				return err
			}
			hash := SecretHash(secret, serial)

			vc := &domain.VoucherCode{
				ProductID:  req.ProductID,
				SerialNo:   &serial,
				SecretHash: &hash,
				Status:     voucherStatusSold,
				OrderID:    intPtr(req.OrderID),
				SoldAt:     timePtr(now),
				ExpiredAt:  timePtr(expiresAt),
			}
			if err := tx.Create(vc).Error; err != nil {
				return fmt.Errorf("create VoucherCode: %w", err)
			}
			logger.Log.Info("seedreampay.issue.ok",
				zap.String("serialNo", serial),
				zap.Int("faceValue", faceValue),
				zap.String("orderCode", req.OrderCode),
			)
			out = append(out, interfaces.IssuedVoucher{
				PinCode:        secret,
				TransactionRef: serial,
			})
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return out, nil
}

func (s *SeedreampayIssuer) generateSerialWithRetry(tx *gorm.DB, faceValue int) (string, error) {
	for attempt := 1; attempt <= serialCollisionRetries; attempt++ {
		serial, err := GenerateSerialNo(faceValue)
		if err != nil {
			return "", err
		}
		var exists int64
		if err := tx.Model(&domain.VoucherCode{}).
			Where("SerialNo = ?", serial).
			Count(&exists).Error; err != nil {
			return "", fmt.Errorf("check serial collision: %w", err)
		}
		if exists == 0 {
			return serial, nil
		}
		logger.Log.Warn("seedreampay.serial.collision",
			zap.Int("attempt", attempt),
			zap.String("serialPrefix", serial[:9]),
		)
	}
	return "", ErrSerialCollision
}

func intPtr(n int) *int            { return &n }
func timePtr(t time.Time) *time.Time { return &t }
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
go test ./internal/infra/issuance/ -run TestSeedreampayIssuer -v -count=1
```

Expected: 모든 테스트 PASS.

- [ ] **Step 5: Commit**

```bash
git add go-server/internal/infra/issuance/seedreampay_issuer.go \
        go-server/internal/infra/issuance/seedreampay_issuer_test.go \
        go-server/go.mod go-server/go.sum
git commit -m "feat(seedreampay): add SeedreampayIssuer with in-tx voucher creation"
```

---

## Task 5: DI 연결 (container.go)

**Files:**
- Modify: `go-server/internal/routes/container.go`

**Branch:** `feat/seedreampay-voucher-p1-issuer` (동일)

- [ ] **Step 1: container.go 에서 issuers 맵 위치 찾기**

```bash
grep -n "issuers\s*:=\|issuers\[" go-server/internal/routes/container.go
```

- [ ] **Step 2: SeedreampayIssuer 등록**

기존 `giftmoaIssuer` / `expayIssuer` 등록 직후에 한 줄 추가:

```go
// go-server/internal/routes/container.go — NewHandlers() 안, issuers 맵 생성 부근
seedreampayIssuer := issuance.NewSeedreampayIssuer(db, time.Now)
issuers[seedreampayIssuer.ProviderCode()] = seedreampayIssuer
```

- [ ] **Step 3: 빌드·단위테스트 회귀**

```bash
cd go-server
go build ./...
go test ./internal/routes/... -count=1
go test ./internal/app/services/... -count=1
```

Expected: 에러 0, 테스트 PASS.

- [ ] **Step 4: Commit + PR**

```bash
git add go-server/internal/routes/container.go
git commit -m "feat(di): register SeedreampayIssuer in issuers map"

git push -u origin feat/seedreampay-voucher-p1-issuer
gh pr create --title "Seedreampay P1: issuer (code gen + DB-tx issuer + DI)" --body "$(cat <<'EOF'
## Summary
- SerialNo / Secret generators (Task 3)
- SeedreampayIssuer that creates VoucherCode rows inside a single DB tx (Task 4)
- DI registration in container.go (Task 5)

## Test plan
- [ ] `go test ./internal/infra/issuance/ -count=1` passes (sqlmock-based)
- [ ] `go build ./...` succeeds
- [ ] E2E issue test from next branch exercises this end-to-end

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

PR 머지 후:

```bash
git checkout main
git pull
git checkout -b feat/seedreampay-voucher-p1-redeem
```

---

# Phase C: Redeem 브랜치

## Task 6: LockoutGuard (Redis 기반)

**Files:**
- Create: `go-server/internal/infra/lockout/lockout_guard.go`
- Create: `go-server/internal/infra/lockout/lockout_guard_test.go`

**Branch:** `feat/seedreampay-voucher-p1-redeem`

- [ ] **Step 1: miniredis 의존성 추가**

```bash
cd go-server
go get github.com/alicebob/miniredis/v2
```

- [ ] **Step 2: 실패 테스트 먼저**

```go
// go-server/internal/infra/lockout/lockout_guard_test.go
package lockout

import (
	"context"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/redis/go-redis/v9"
	"github.com/stretchr/testify/require"
)

func newTestGuard(t *testing.T) (*Guard, *miniredis.Miniredis) {
	t.Helper()
	mr := miniredis.RunT(t)
	rdb := redis.NewClient(&redis.Options{Addr: mr.Addr()})
	g := NewGuard(rdb, 5, 15*time.Minute)
	return g, mr
}

func TestGuard_IncrementSerial_ThresholdReached_Blocks(t *testing.T) {
	g, _ := newTestGuard(t)
	ctx := context.Background()
	serial := "SEED-10K1-AAAA-BBBB-CCCC"

	for i := 1; i <= 4; i++ {
		blocked, err := g.RegisterSerialFailure(ctx, serial)
		require.NoError(t, err)
		require.False(t, blocked, "should not block before threshold, i=%d", i)
	}
	blocked, err := g.RegisterSerialFailure(ctx, serial)
	require.NoError(t, err)
	require.True(t, blocked, "5th failure should block")

	isBlocked, err := g.IsSerialBlocked(ctx, serial)
	require.NoError(t, err)
	require.True(t, isBlocked)
}

func TestGuard_IncrementIP_IndependentFromSerial(t *testing.T) {
	g, _ := newTestGuard(t)
	ctx := context.Background()
	ip := "203.0.113.9"

	for i := 1; i <= 5; i++ {
		_, err := g.RegisterIPFailure(ctx, ip)
		require.NoError(t, err)
	}
	blocked, err := g.IsIPBlocked(ctx, ip)
	require.NoError(t, err)
	require.True(t, blocked)
}

func TestGuard_FailOpen_WhenRedisDown(t *testing.T) {
	rdb := redis.NewClient(&redis.Options{Addr: "127.0.0.1:1"}) // 미연결 포트
	g := NewGuard(rdb, 5, 15*time.Minute)
	ctx, cancel := context.WithTimeout(context.Background(), 200*time.Millisecond)
	defer cancel()

	blocked, err := g.IsSerialBlocked(ctx, "SEED-X-1-2-3")
	// fail-open: Redis 장애라도 락아웃을 "블록되지 않음"으로 간주
	require.NoError(t, err)
	require.False(t, blocked)
}
```

- [ ] **Step 3: 테스트 실패 확인**

```bash
go test ./internal/infra/lockout/ -v -count=1
```

Expected: FAIL — Guard 미정의.

- [ ] **Step 4: Guard 구현**

```go
// go-server/internal/infra/lockout/lockout_guard.go
package lockout

import (
	"context"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
)

// Guard 는 Redis 기반 serial/IP 락아웃 구현이다.
// Redis 장애 시 fail-open (블록 안 된 것으로 응답).
type Guard struct {
	rdb       *redis.Client
	threshold int
	ttl       time.Duration
}

func NewGuard(rdb *redis.Client, threshold int, ttl time.Duration) *Guard {
	return &Guard{rdb: rdb, threshold: threshold, ttl: ttl}
}

func (g *Guard) RegisterSerialFailure(ctx context.Context, serial string) (blocked bool, err error) {
	return g.registerFailure(ctx, fmt.Sprintf("seedreampay:lockout:serial:%s", serial),
		fmt.Sprintf("seedreampay:lockout:block:serial:%s", serial))
}

func (g *Guard) RegisterIPFailure(ctx context.Context, ip string) (blocked bool, err error) {
	return g.registerFailure(ctx, fmt.Sprintf("seedreampay:lockout:ip:%s", ip),
		fmt.Sprintf("seedreampay:lockout:block:ip:%s", ip))
}

func (g *Guard) IsSerialBlocked(ctx context.Context, serial string) (bool, error) {
	return g.isBlocked(ctx, fmt.Sprintf("seedreampay:lockout:block:serial:%s", serial))
}

func (g *Guard) IsIPBlocked(ctx context.Context, ip string) (bool, error) {
	return g.isBlocked(ctx, fmt.Sprintf("seedreampay:lockout:block:ip:%s", ip))
}

func (g *Guard) registerFailure(ctx context.Context, counterKey, blockKey string) (bool, error) {
	n, err := g.rdb.Incr(ctx, counterKey).Result()
	if err != nil {
		// fail-open: Redis 장애 시 락아웃 비활성 (가용성 우선)
		return false, nil
	}
	// 첫 증가 시에만 TTL 설정 (INCR 은 TTL 초기화 안 함)
	if n == 1 {
		_ = g.rdb.Expire(ctx, counterKey, g.ttl).Err()
	}
	if int(n) >= g.threshold {
		_ = g.rdb.Set(ctx, blockKey, 1, g.ttl).Err()
		return true, nil
	}
	return false, nil
}

func (g *Guard) isBlocked(ctx context.Context, blockKey string) (bool, error) {
	n, err := g.rdb.Exists(ctx, blockKey).Result()
	if err != nil {
		// fail-open
		return false, nil
	}
	return n > 0, nil
}
```

- [ ] **Step 5: 테스트 통과 확인**

```bash
go test ./internal/infra/lockout/ -v -count=1
```

Expected: 모든 테스트 PASS.

- [ ] **Step 6: Commit**

```bash
git add go-server/internal/infra/lockout/ go-server/go.mod go-server/go.sum
git commit -m "feat(lockout): add Redis-backed Guard (fail-open, serial+IP counters)"
```

---

## Task 7: SeedreampayService — GetVoucherBySerial + VerifySecret

**Files:**
- Create: `go-server/internal/app/services/seedreampay_svc.go`
- Create: `go-server/internal/app/services/seedreampay_svc_test.go`

**Branch:** `feat/seedreampay-voucher-p1-redeem` (동일)

- [ ] **Step 1: 실패 테스트 작성**

```go
// go-server/internal/app/services/seedreampay_svc_test.go
package services

import (
	"context"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/sqlserver"
	"gorm.io/gorm"

	"seedream-gift-server/internal/domain"
	"seedream-gift-server/internal/infra/issuance"
)

func newMockGormSvc(t *testing.T) (*gorm.DB, sqlmock.Sqlmock) {
	t.Helper()
	sqlDB, mock, err := sqlmock.New(sqlmock.QueryMatcherOption(sqlmock.QueryMatcherRegexp))
	require.NoError(t, err)
	db, err := gorm.Open(sqlserver.New(sqlserver.Config{Conn: sqlDB}), &gorm.Config{})
	require.NoError(t, err)
	return db, mock
}

func TestSeedreampay_GetVoucherBySerial_NotFound(t *testing.T) {
	db, mock := newMockGormSvc(t)
	mock.ExpectQuery(`SELECT .* FROM "VoucherCodes"`).
		WithArgs("SEED-10K1-X-Y-Z", 1).
		WillReturnRows(sqlmock.NewRows([]string{"Id"}))
	svc := NewSeedreampayService(db, nil, nil, time.Now)

	_, err := svc.GetVoucherBySerial(context.Background(), "SEED-10K1-X-Y-Z")
	require.ErrorIs(t, err, ErrVoucherNotFound)
}

func TestSeedreampay_GetVoucherBySerial_ReturnsView(t *testing.T) {
	db, mock := newMockGormSvc(t)
	now := time.Date(2026, 4, 23, 12, 0, 0, 0, time.UTC)
	expires := now.AddDate(5, 0, 0)
	mock.ExpectQuery(`SELECT .* FROM "VoucherCodes"`).
		WillReturnRows(sqlmock.NewRows([]string{"Id", "SerialNo", "Status", "CreatedAt", "ExpiredAt", "ProductId"}).
			AddRow(100, "SEED-10K1-AAAA-BBBB-CCCC", "SOLD", now, expires, 7))
	// Product join for faceValue
	mock.ExpectQuery(`SELECT .* FROM "Products"`).
		WillReturnRows(sqlmock.NewRows([]string{"Id", "Price"}).AddRow(7, 10000))

	svc := NewSeedreampayService(db, nil, nil, func() time.Time { return now })
	view, err := svc.GetVoucherBySerial(context.Background(), "SEED-10K1-AAAA-BBBB-CCCC")
	require.NoError(t, err)
	require.Equal(t, "SEED-10K1-AAAA-BBBB-CCCC", view.SerialNo)
	require.Equal(t, 10000, view.FaceValue)
	require.Equal(t, "SOLD", view.Status)
}

func TestSeedreampay_VerifySecret_Match(t *testing.T) {
	db, _ := newMockGormSvc(t)
	svc := NewSeedreampayService(db, nil, nil, time.Now)

	serial := "SEED-10K1-X7AB-K9PD-M3QY"
	secret := "482917365021"
	hash := issuance.SecretHash(secret, serial)

	ok := svc.VerifySecretAgainst(secret, serial, hash)
	require.True(t, ok)

	ok = svc.VerifySecretAgainst("000000000000", serial, hash)
	require.False(t, ok)
}
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
go test ./internal/app/services/ -run TestSeedreampay -v -count=1
```

Expected: FAIL.

- [ ] **Step 3: 서비스 뼈대 + 두 메서드 구현**

```go
// go-server/internal/app/services/seedreampay_svc.go
package services

import (
	"context"
	"crypto/subtle"
	"errors"
	"time"

	"gorm.io/gorm"

	"seedream-gift-server/internal/domain"
	"seedream-gift-server/internal/infra/issuance"
	"seedream-gift-server/internal/infra/lockout"
	"seedream-gift-server/internal/shared/payment"
)

var (
	ErrVoucherNotFound     = errors.New("voucher not found")
	ErrVoucherAlreadyUsed  = errors.New("voucher already used")
	ErrVoucherExpired      = errors.New("voucher expired")
	ErrVoucherRefunded     = errors.New("voucher refunded")
	ErrSecretMismatch      = errors.New("secret mismatch")
	ErrRefundWindowExpired = errors.New("refund window expired")
	ErrLockedOut           = errors.New("too many attempts — locked out")
)

type SeedreampayService struct {
	db       *gorm.DB
	lockout  *lockout.Guard
	payments payment.Provider // 환불을 위한 결제 어댑터
	now      func() time.Time
}

func NewSeedreampayService(
	db *gorm.DB,
	lo *lockout.Guard,
	pp payment.Provider,
	now func() time.Time,
) *SeedreampayService {
	if now == nil {
		now = time.Now
	}
	return &SeedreampayService{db: db, lockout: lo, payments: pp, now: now}
}

// VoucherView 는 API 응답용 축약 뷰. SecretHash/RedeemedIp 등 내부 필드는 제외.
type VoucherView struct {
	SerialNo  string    `json:"serialNo"`
	FaceValue int       `json:"faceValue"`
	Status    string    `json:"status"`
	IssuedAt  time.Time `json:"issuedAt"`
	ExpiresAt time.Time `json:"expiresAt"`
}

// getVoucherRow 는 내부 헬퍼: 전체 VoucherCode 도메인 레코드 반환 (Redeem/Refund 에서 사용).
func (s *SeedreampayService) getVoucherRow(ctx context.Context, serial string) (*domain.VoucherCode, error) {
	var vc domain.VoucherCode
	err := s.db.WithContext(ctx).Where("SerialNo = ?", serial).First(&vc).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, ErrVoucherNotFound
	}
	if err != nil {
		return nil, err
	}
	return &vc, nil
}

// GetVoucherBySerial 는 공개 코드로 상품권 정보를 조회하여 안전한 View 로 반환한다.
// SecretHash 등 민감 필드는 노출하지 않는다.
func (s *SeedreampayService) GetVoucherBySerial(ctx context.Context, serial string) (*VoucherView, error) {
	vc, err := s.getVoucherRow(ctx, serial)
	if err != nil {
		return nil, err
	}
	var product domain.Product
	if err := s.db.WithContext(ctx).Where("Id = ?", vc.ProductID).First(&product).Error; err != nil {
		return nil, err
	}
	var expires time.Time
	if vc.ExpiredAt != nil {
		expires = *vc.ExpiredAt
	}
	serialOut := ""
	if vc.SerialNo != nil {
		serialOut = *vc.SerialNo
	}
	return &VoucherView{
		SerialNo:  serialOut,
		FaceValue: int(product.Price),
		Status:    vc.Status,
		IssuedAt:  vc.CreatedAt,
		ExpiresAt: expires,
	}, nil
}

// VerifySecretAgainst 는 해시 비교만 수행 (상수시간). 조회·상태 전이 없음.
func (s *SeedreampayService) VerifySecretAgainst(secret, serial, storedHash string) bool {
	calc := issuance.SecretHash(secret, serial)
	return subtle.ConstantTimeCompare([]byte(calc), []byte(storedHash)) == 1
}
```

**참고**: `payment.Provider` 인터페이스의 실제 패키지 경로는 기존 코드베이스에서 확인 필요 — 동일 이름이 없으면 `interfaces.IPaymentProvider` 등 기존 심볼 그대로 사용. 첫 컴파일 시 import 실패하면 아래 수정:

```bash
grep -rn "IPaymentProvider\|payment.Provider" go-server/internal/ | head -5
```

발견된 실제 경로를 사용.

- [ ] **Step 4: 테스트 통과 확인**

```bash
go test ./internal/app/services/ -run TestSeedreampay -v -count=1
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add go-server/internal/app/services/seedreampay_svc.go \
        go-server/internal/app/services/seedreampay_svc_test.go
git commit -m "feat(seedreampay): add service with GetVoucherBySerial + VerifySecret"
```

---

## Task 8: SeedreampayService — Redeem (상태 CAS)

**Files:**
- Modify: `go-server/internal/app/services/seedreampay_svc.go`
- Modify: `go-server/internal/app/services/seedreampay_svc_test.go`

**Branch:** `feat/seedreampay-voucher-p1-redeem` (동일)

- [ ] **Step 1: 실패 테스트 추가 (happy path + CAS race)**

```go
// go-server/internal/app/services/seedreampay_svc_test.go — 하단에 추가
func TestSeedreampay_Redeem_HappyPath(t *testing.T) {
	db, mock := newMockGormSvc(t)
	svc := NewSeedreampayService(db, nil, nil, func() time.Time {
		return time.Date(2026, 4, 23, 12, 0, 0, 0, time.UTC)
	})

	serial := "SEED-10K1-X7AB-K9PD-M3QY"
	secret := "482917365021"
	hash := issuance.SecretHash(secret, serial)
	now := time.Date(2026, 4, 23, 12, 0, 0, 0, time.UTC)
	expires := now.AddDate(5, 0, 0)

	mock.ExpectBegin()
	mock.ExpectQuery(`SELECT .* FROM "VoucherCodes"`).
		WithArgs(serial, 1).
		WillReturnRows(sqlmock.NewRows([]string{"Id", "SerialNo", "SecretHash", "Status", "ExpiredAt", "ProductId"}).
			AddRow(100, serial, hash, "SOLD", expires, 7))
	// CAS UPDATE
	mock.ExpectExec(`UPDATE "VoucherCodes" SET .* WHERE .* AND "Status" = \?`).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectCommit()

	res, err := svc.Redeem(context.Background(), RedeemInput{
		SerialNo:   serial,
		Secret:     secret,
		UserID:     42,
		UsageOrder: 999,
		ClientIP:   "203.0.113.1",
	})
	require.NoError(t, err)
	require.Equal(t, serial, res.SerialNo)
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestSeedreampay_Redeem_RaceLost(t *testing.T) {
	db, mock := newMockGormSvc(t)
	svc := NewSeedreampayService(db, nil, nil, time.Now)

	serial := "SEED-10K1-X7AB-K9PD-M3QY"
	secret := "482917365021"
	hash := issuance.SecretHash(secret, serial)
	expires := time.Now().Add(time.Hour)

	mock.ExpectBegin()
	mock.ExpectQuery(`SELECT .* FROM "VoucherCodes"`).
		WithArgs(serial, 1).
		WillReturnRows(sqlmock.NewRows([]string{"Id", "SerialNo", "SecretHash", "Status", "ExpiredAt", "ProductId"}).
			AddRow(100, serial, hash, "SOLD", expires, 7))
	// CAS UPDATE 가 0 행 영향 — 다른 스레드가 먼저 USED 로 바꿈
	mock.ExpectExec(`UPDATE "VoucherCodes" SET .* WHERE .* AND "Status" = \?`).
		WillReturnResult(sqlmock.NewResult(0, 0))
	mock.ExpectRollback()

	_, err := svc.Redeem(context.Background(), RedeemInput{
		SerialNo: serial, Secret: secret, UserID: 42, UsageOrder: 999, ClientIP: "203.0.113.1",
	})
	require.ErrorIs(t, err, ErrVoucherAlreadyUsed)
}

func TestSeedreampay_Redeem_SecretMismatch(t *testing.T) {
	db, mock := newMockGormSvc(t)
	svc := NewSeedreampayService(db, nil, nil, time.Now)

	serial := "SEED-10K1-X7AB-K9PD-M3QY"
	correctSecret := "482917365021"
	hash := issuance.SecretHash(correctSecret, serial)

	mock.ExpectBegin()
	mock.ExpectQuery(`SELECT .* FROM "VoucherCodes"`).
		WithArgs(serial, 1).
		WillReturnRows(sqlmock.NewRows([]string{"Id", "SerialNo", "SecretHash", "Status", "ExpiredAt", "ProductId"}).
			AddRow(100, serial, hash, "SOLD", time.Now().Add(time.Hour), 7))
	mock.ExpectRollback()

	_, err := svc.Redeem(context.Background(), RedeemInput{
		SerialNo: serial, Secret: "000000000000", UserID: 42, UsageOrder: 999, ClientIP: "203.0.113.1",
	})
	require.ErrorIs(t, err, ErrSecretMismatch)
}
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
go test ./internal/app/services/ -run "TestSeedreampay_Redeem" -v -count=1
```

Expected: FAIL — `RedeemInput`, `Redeem()` 미정의.

- [ ] **Step 3: `Redeem()` 구현**

기존 `seedreampay_svc.go` 에 추가:

```go
// go-server/internal/app/services/seedreampay_svc.go — 하단에 추가

type RedeemInput struct {
	SerialNo   string
	Secret     string
	UserID     int
	UsageOrder int    // 사용처 주문 ID (= RedeemedOrderId)
	ClientIP   string
}

type RedeemResult struct {
	SerialNo      string
	AmountApplied int
}

// Redeem 은 공개코드+비밀코드 쌍을 검증하고 상품권을 USED 상태로 전환한다.
// 상태 전이 자체(SOLD→USED)를 CAS 토큰으로 활용하여 동시 요청에서 한 번만 성공.
func (s *SeedreampayService) Redeem(ctx context.Context, in RedeemInput) (*RedeemResult, error) {
	var result *RedeemResult

	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var vc domain.VoucherCode
		if err := tx.Where("SerialNo = ?", in.SerialNo).First(&vc).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrVoucherNotFound
			}
			return err
		}

		// 상태 가드
		switch vc.Status {
		case "USED":
			return ErrVoucherAlreadyUsed
		case "EXPIRED":
			return ErrVoucherExpired
		case "REFUNDED":
			return ErrVoucherRefunded
		case "SOLD":
			// 진행 가능
		default:
			return ErrVoucherNotFound
		}

		// 만료 가드
		if vc.ExpiredAt != nil && vc.ExpiredAt.Before(s.now()) {
			return ErrVoucherExpired
		}

		// 비밀코드 검증
		if vc.SecretHash == nil || !s.VerifySecretAgainst(in.Secret, in.SerialNo, *vc.SecretHash) {
			return ErrSecretMismatch
		}

		// 액면가 계산 — Product join
		var product domain.Product
		if err := tx.Where("Id = ?", vc.ProductID).First(&product).Error; err != nil {
			return err
		}
		faceValue := int(product.Price)

		// CAS 전이
		now := s.now()
		usedAt := now
		res := tx.Model(&domain.VoucherCode{}).
			Where("Id = ? AND Status = ?", vc.ID, "SOLD").
			Updates(map[string]any{
				"Status":          "USED",
				"UsedAt":          &usedAt,
				"RedeemedOrderId": &in.UsageOrder,
				"RedeemedIp":      &in.ClientIP,
			})
		if res.Error != nil {
			return res.Error
		}
		if res.RowsAffected == 0 {
			return ErrVoucherAlreadyUsed // 경쟁에서 졌다
		}

		result = &RedeemResult{SerialNo: in.SerialNo, AmountApplied: faceValue}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return result, nil
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
go test ./internal/app/services/ -run "TestSeedreampay_Redeem" -v -count=1
```

Expected: 모든 케이스 PASS.

- [ ] **Step 5: Commit**

```bash
git add go-server/internal/app/services/seedreampay_svc.go \
        go-server/internal/app/services/seedreampay_svc_test.go
git commit -m "feat(seedreampay): add Redeem with state-transition CAS"
```

---

## Task 9: SeedreampayService — Refund + MarkExpired

**Files:**
- Modify: `go-server/internal/app/services/seedreampay_svc.go`
- Modify: `go-server/internal/app/services/seedreampay_svc_test.go`

**Branch:** `feat/seedreampay-voucher-p1-redeem` (동일)

- [ ] **Step 1: 테스트 추가 (환불 7일 경계 + 만료 배치)**

```go
// go-server/internal/app/services/seedreampay_svc_test.go — 하단에 추가
func TestSeedreampay_Refund_WithinWindow(t *testing.T) {
	db, mock := newMockGormSvc(t)
	now := time.Date(2026, 4, 23, 12, 0, 0, 0, time.UTC)
	createdAt := now.AddDate(0, 0, -6) // 6일 전 구매 → 7일 내
	svc := NewSeedreampayService(db, nil, nil, func() time.Time { return now })

	mock.ExpectBegin()
	mock.ExpectQuery(`SELECT .* FROM "VoucherCodes"`).
		WillReturnRows(sqlmock.NewRows([]string{"Id", "Status", "CreatedAt", "OrderId"}).
			AddRow(100, "SOLD", createdAt, 55))
	mock.ExpectExec(`UPDATE "VoucherCodes" SET .* WHERE .* AND "Status" = \?`).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectCommit()

	err := svc.Refund(context.Background(), RefundInput{
		SerialNo: "SEED-10K1-AAAA-BBBB-CCCC", RequestedBy: ActorUser, UserID: 42,
	})
	require.NoError(t, err)
}

func TestSeedreampay_Refund_WindowExpired_UserBlocked(t *testing.T) {
	db, mock := newMockGormSvc(t)
	now := time.Date(2026, 4, 23, 12, 0, 0, 0, time.UTC)
	createdAt := now.AddDate(0, 0, -8) // 8일 전 → 7일 초과
	svc := NewSeedreampayService(db, nil, nil, func() time.Time { return now })

	mock.ExpectBegin()
	mock.ExpectQuery(`SELECT .* FROM "VoucherCodes"`).
		WillReturnRows(sqlmock.NewRows([]string{"Id", "Status", "CreatedAt", "OrderId"}).
			AddRow(100, "SOLD", createdAt, 55))
	mock.ExpectRollback()

	err := svc.Refund(context.Background(), RefundInput{
		SerialNo: "SEED-10K1-AAAA-BBBB-CCCC", RequestedBy: ActorUser, UserID: 42,
	})
	require.ErrorIs(t, err, ErrRefundWindowExpired)
}

func TestSeedreampay_Refund_AdminBypassesWindow(t *testing.T) {
	db, mock := newMockGormSvc(t)
	now := time.Date(2026, 4, 23, 12, 0, 0, 0, time.UTC)
	createdAt := now.AddDate(0, 0, -30)
	svc := NewSeedreampayService(db, nil, nil, func() time.Time { return now })

	mock.ExpectBegin()
	mock.ExpectQuery(`SELECT .* FROM "VoucherCodes"`).
		WillReturnRows(sqlmock.NewRows([]string{"Id", "Status", "CreatedAt", "OrderId"}).
			AddRow(100, "SOLD", createdAt, 55))
	mock.ExpectExec(`UPDATE "VoucherCodes" SET .* WHERE .* AND "Status" = \?`).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectCommit()

	err := svc.Refund(context.Background(), RefundInput{
		SerialNo: "SEED-10K1-AAAA-BBBB-CCCC", RequestedBy: ActorAdmin, Reason: "CS 정책 보상",
	})
	require.NoError(t, err)
}

func TestSeedreampay_MarkExpiredVouchers(t *testing.T) {
	db, mock := newMockGormSvc(t)
	svc := NewSeedreampayService(db, nil, nil, time.Now)

	mock.ExpectExec(`UPDATE "VoucherCodes" SET .* WHERE .* "ProviderCode" = \? AND "Status" = \? AND "ExpiredAt" < \?`).
		WillReturnResult(sqlmock.NewResult(0, 3))

	n, err := svc.MarkExpiredVouchers(context.Background())
	require.NoError(t, err)
	require.Equal(t, int64(3), n)
}
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
go test ./internal/app/services/ -run "TestSeedreampay_Refund|TestSeedreampay_MarkExpired" -v -count=1
```

Expected: FAIL — `RefundInput`, `Refund`, `MarkExpiredVouchers` 미정의.

- [ ] **Step 3: Refund + MarkExpiredVouchers 구현**

```go
// go-server/internal/app/services/seedreampay_svc.go — 하단에 추가

type Actor int

const (
	ActorUser Actor = iota
	ActorAdmin
)

const refundWindow = 7 * 24 * time.Hour

type RefundInput struct {
	SerialNo    string
	RequestedBy Actor
	UserID      int    // ActorUser 일 때 소유자 검증용
	Reason      string // ActorAdmin 은 필수
}

// Refund 는 씨드림페이 상품권을 환불한다. 결제 원복까지 호출.
func (s *SeedreampayService) Refund(ctx context.Context, in RefundInput) error {
	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var vc domain.VoucherCode
		if err := tx.Where("SerialNo = ?", in.SerialNo).First(&vc).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrVoucherNotFound
			}
			return err
		}
		if vc.Status != "SOLD" {
			return ErrVoucherAlreadyUsed
		}
		if in.RequestedBy == ActorUser {
			if s.now().Sub(vc.CreatedAt) > refundWindow {
				return ErrRefundWindowExpired
			}
			// 소유자 검증 (Order.UserId == in.UserID) — Order 조회
			var order domain.Order
			if err := tx.Where("Id = ?", vc.OrderID).First(&order).Error; err != nil {
				return err
			}
			if order.UserID != in.UserID {
				return ErrVoucherNotFound // 정보 노출 최소화: 남의 상품권엔 "없음" 응답
			}
		}

		// CAS 전이 SOLD → REFUNDED
		now := s.now()
		res := tx.Model(&domain.VoucherCode{}).
			Where("Id = ? AND Status = ?", vc.ID, "SOLD").
			Updates(map[string]any{
				"Status":    "REFUNDED",
				"UpdatedAt": &now,
			})
		if res.Error != nil {
			return res.Error
		}
		if res.RowsAffected == 0 {
			return ErrVoucherAlreadyUsed
		}

		// 결제 원복 — payments 어댑터가 nil 이면 skip (테스트 편의)
		if s.payments != nil && vc.OrderID != nil {
			if err := s.payments.RefundByOrderID(ctx, *vc.OrderID, in.Reason); err != nil {
				return fmt.Errorf("payment refund: %w", err)
			}
		}
		return nil
	})
}

// MarkExpiredVouchers 는 만료된 SOLD 상품권을 EXPIRED 로 전이한다. 크론에서 호출.
func (s *SeedreampayService) MarkExpiredVouchers(ctx context.Context) (int64, error) {
	res := s.db.WithContext(ctx).
		Exec(`UPDATE "VoucherCodes" SET "Status" = ?, "UpdatedAt" = ?
		      WHERE EXISTS (
		        SELECT 1 FROM "Products" p WHERE p."Id" = "VoucherCodes"."ProductId"
		        AND p."ProviderCode" = ?
		      ) AND "Status" = ? AND "ExpiredAt" < ?`,
			"EXPIRED", s.now(), "SEEDREAMPAY", "SOLD", s.now())
	return res.RowsAffected, res.Error
}
```

**주의**: `payment.Provider` 인터페이스에 `RefundByOrderID(ctx, orderID int, reason string) error` 메서드가 있어야 함. 기존에 다른 이름이면 해당 이름으로 바꾸고 테스트의 mock 도 맞춰야 함. 기존 리팩터링이 필요하면 별도 subtask.

- [ ] **Step 4: 테스트 통과 확인 + 전체 서비스 회귀**

```bash
go test ./internal/app/services/ -v -count=1
```

Expected: 모든 테스트 PASS.

- [ ] **Step 5: Commit**

```bash
git add go-server/internal/app/services/seedreampay_svc.go \
        go-server/internal/app/services/seedreampay_svc_test.go
git commit -m "feat(seedreampay): add Refund (7-day window + admin override) + MarkExpiredVouchers"
```

---

## Task 10: HTTP Handler — /vouchers/:serial, /verify, /redeem, /refund

**Files:**
- Create: `go-server/internal/api/handlers/seedreampay_handler.go`
- Create: `go-server/internal/api/handlers/seedreampay_handler_test.go`

**Branch:** `feat/seedreampay-voucher-p1-redeem` (동일)

- [ ] **Step 1: 실패 테스트 작성 (httptest + gin)**

```go
// go-server/internal/api/handlers/seedreampay_handler_test.go
package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

type stubSeedreampaySvc struct {
	redeemFn func(ctx context.Context, in services.RedeemInput) (*services.RedeemResult, error)
}

func (s *stubSeedreampaySvc) Redeem(ctx context.Context, in services.RedeemInput) (*services.RedeemResult, error) {
	return s.redeemFn(ctx, in)
}
// (다른 메서드는 테스트 대상이 아니면 생략 — 실제 interface 정의에 맞춰야 함)

func TestSeedreampayHandler_Redeem_Success(t *testing.T) {
	gin.SetMode(gin.TestMode)
	h := NewSeedreampayHandler(&stubSeedreampaySvc{
		redeemFn: func(ctx context.Context, in services.RedeemInput) (*services.RedeemResult, error) {
			return &services.RedeemResult{SerialNo: in.SerialNo, AmountApplied: 10000}, nil
		},
	}, nil) // lockout guard nil — 테스트에선 패스
	r := gin.New()
	r.POST("/redeem", withFakeUser(42), h.Redeem)

	body, _ := json.Marshal(map[string]any{
		"serialNo": "SEED-10K1-AAAA-BBBB-CCCC",
		"secret":   "482917365021",
		"orderId":  999,
	})
	req := httptest.NewRequest(http.MethodPost, "/redeem", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	require.Equal(t, http.StatusOK, w.Code)
	var resp map[string]any
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	require.Equal(t, true, resp["redeemed"])
	require.Equal(t, float64(10000), resp["amountApplied"])
}

func TestSeedreampayHandler_Redeem_SecretMismatch_401(t *testing.T) {
	gin.SetMode(gin.TestMode)
	h := NewSeedreampayHandler(&stubSeedreampaySvc{
		redeemFn: func(ctx context.Context, in services.RedeemInput) (*services.RedeemResult, error) {
			return nil, services.ErrSecretMismatch
		},
	}, nil)
	r := gin.New()
	r.POST("/redeem", withFakeUser(42), h.Redeem)

	body, _ := json.Marshal(map[string]any{
		"serialNo": "SEED-10K1-AAAA-BBBB-CCCC",
		"secret":   "000000000000",
		"orderId":  999,
	})
	req := httptest.NewRequest(http.MethodPost, "/redeem", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	require.Equal(t, http.StatusUnauthorized, w.Code)
}

// withFakeUser 는 JWT 미들웨어가 세팅할 userID 를 context 에 집어넣는 테스트 헬퍼.
func withFakeUser(userID int) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Set("userID", userID)
		c.Next()
	}
}
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
go test ./internal/api/handlers/ -run TestSeedreampayHandler -v -count=1
```

Expected: FAIL — `NewSeedreampayHandler`, `h.Redeem` 미정의.

- [ ] **Step 3: Handler 구현**

```go
// go-server/internal/api/handlers/seedreampay_handler.go
package handlers

import (
	"context"
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"

	"seedream-gift-server/internal/app/services"
	"seedream-gift-server/internal/infra/lockout"
)

// SeedreampaySvc 는 핸들러가 의존하는 서비스 인터페이스. 테스트에서 mock 하기 쉽도록 정의.
type SeedreampaySvc interface {
	GetVoucherBySerial(ctx context.Context, serial string) (*services.VoucherView, error)
	Redeem(ctx context.Context, in services.RedeemInput) (*services.RedeemResult, error)
	Refund(ctx context.Context, in services.RefundInput) error
	VerifyPair(ctx context.Context, serial, secret string) error
}

type SeedreampayHandler struct {
	svc     SeedreampaySvc
	lockout *lockout.Guard
}

func NewSeedreampayHandler(svc SeedreampaySvc, lo *lockout.Guard) *SeedreampayHandler {
	return &SeedreampayHandler{svc: svc, lockout: lo}
}

// GET /api/v1/seedreampay/vouchers/:serialNo
func (h *SeedreampayHandler) Get(c *gin.Context) {
	serial := c.Param("serialNo")
	v, err := h.svc.GetVoucherBySerial(c.Request.Context(), serial)
	if errors.Is(err, services.ErrVoucherNotFound) {
		c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, v)
}

type redeemReq struct {
	SerialNo string `json:"serialNo" binding:"required"`
	Secret   string `json:"secret"   binding:"required,len=12"`
	OrderID  int    `json:"orderId"  binding:"required"`
}

// POST /api/v1/seedreampay/vouchers/redeem
func (h *SeedreampayHandler) Redeem(c *gin.Context) {
	var req redeemReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	ip := c.ClientIP()

	// 락아웃 프리-체크
	if h.lockout != nil {
		if blocked, _ := h.lockout.IsSerialBlocked(c.Request.Context(), req.SerialNo); blocked {
			c.JSON(http.StatusTooManyRequests, gin.H{"error": "locked"})
			return
		}
		if blocked, _ := h.lockout.IsIPBlocked(c.Request.Context(), ip); blocked {
			c.JSON(http.StatusTooManyRequests, gin.H{"error": "locked"})
			return
		}
	}

	userID := c.GetInt("userID")
	res, err := h.svc.Redeem(c.Request.Context(), services.RedeemInput{
		SerialNo:   req.SerialNo,
		Secret:     req.Secret,
		UserID:     userID,
		UsageOrder: req.OrderID,
		ClientIP:   ip,
	})

	switch {
	case errors.Is(err, services.ErrVoucherNotFound):
		if h.lockout != nil {
			_, _ = h.lockout.RegisterIPFailure(c.Request.Context(), ip)
		}
		c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
	case errors.Is(err, services.ErrSecretMismatch):
		if h.lockout != nil {
			_, _ = h.lockout.RegisterSerialFailure(c.Request.Context(), req.SerialNo)
		}
		c.JSON(http.StatusUnauthorized, gin.H{"error": "secret mismatch"})
	case errors.Is(err, services.ErrVoucherAlreadyUsed),
		errors.Is(err, services.ErrVoucherRefunded):
		c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
	case errors.Is(err, services.ErrVoucherExpired):
		c.JSON(http.StatusGone, gin.H{"error": "expired"})
	case err != nil:
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
	default:
		c.JSON(http.StatusOK, gin.H{
			"redeemed":      true,
			"serialNo":      res.SerialNo,
			"amountApplied": res.AmountApplied,
		})
	}
}

// POST /api/v1/seedreampay/vouchers/verify (pre-flight, 상태 변경 없음)
func (h *SeedreampayHandler) Verify(c *gin.Context) {
	var req struct {
		SerialNo string `json:"serialNo" binding:"required"`
		Secret   string `json:"secret"   binding:"required,len=12"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := h.svc.VerifyPair(c.Request.Context(), req.SerialNo, req.Secret); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"valid": false})
		return
	}
	c.JSON(http.StatusOK, gin.H{"valid": true})
}

// POST /api/v1/seedreampay/vouchers/:serialNo/refund
func (h *SeedreampayHandler) Refund(c *gin.Context) {
	serial := c.Param("serialNo")
	userID := c.GetInt("userID")
	role := c.GetString("role")

	actor := services.ActorUser
	var reason string
	if role == "ADMIN" {
		actor = services.ActorAdmin
		reason = c.DefaultQuery("reason", "")
		if reason == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "admin refund requires reason"})
			return
		}
	}

	err := h.svc.Refund(c.Request.Context(), services.RefundInput{
		SerialNo: serial, RequestedBy: actor, UserID: userID, Reason: reason,
	})
	switch {
	case errors.Is(err, services.ErrRefundWindowExpired):
		c.JSON(http.StatusBadRequest, gin.H{"error": "refund window expired"})
	case errors.Is(err, services.ErrVoucherAlreadyUsed):
		c.JSON(http.StatusConflict, gin.H{"error": "already used"})
	case errors.Is(err, services.ErrVoucherNotFound):
		c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
	case err != nil:
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
	default:
		c.JSON(http.StatusOK, gin.H{"refunded": true})
	}
}
```

**부가 서비스 메서드 `VerifyPair` 추가 필요** — Task 7 의 `VerifySecretAgainst` 는 해시 비교 전용. DB 조회와 상태 가드까지 결합한 공개 검증 API 가 필요하다:

```go
// go-server/internal/app/services/seedreampay_svc.go — 추가
func (s *SeedreampayService) VerifyPair(ctx context.Context, serial, secret string) error {
	vc, err := s.getVoucherRow(ctx, serial)
	if err != nil {
		return err
	}
	if vc.SecretHash == nil || !s.VerifySecretAgainst(secret, serial, *vc.SecretHash) {
		return ErrSecretMismatch
	}
	if vc.Status != "SOLD" {
		return ErrVoucherAlreadyUsed
	}
	if vc.ExpiredAt != nil && vc.ExpiredAt.Before(s.now()) {
		return ErrVoucherExpired
	}
	return nil
}
```

`VoucherView` 타입은 Task 7 에서 이미 도입되었으므로 재정의 불필요.

- [ ] **Step 4: 테스트 통과 확인**

```bash
go test ./internal/api/handlers/ -run TestSeedreampayHandler -v -count=1
go test ./internal/app/services/ -run TestSeedreampay -v -count=1
```

Expected: 모두 PASS.

- [ ] **Step 5: Commit**

```bash
git add go-server/internal/api/handlers/seedreampay_handler.go \
        go-server/internal/api/handlers/seedreampay_handler_test.go \
        go-server/internal/app/services/seedreampay_svc.go
git commit -m "feat(seedreampay): add user HTTP handlers (get/verify/redeem/refund) + VoucherView"
```

---

## Task 11: Admin Handler + Router 연결 + 만료 크론

**Files:**
- Create: `go-server/internal/api/handlers/admin_seedreampay_handler.go`
- Modify: `go-server/internal/routes/router.go`
- Modify: `go-server/internal/routes/container.go`
- Modify: `go-server/internal/cron/scheduler.go`

**Branch:** `feat/seedreampay-voucher-p1-redeem` (동일)

- [ ] **Step 1: Admin 목록 핸들러**

```go
// go-server/internal/api/handlers/admin_seedreampay_handler.go
package handlers

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"seedream-gift-server/internal/domain"
)

type AdminSeedreampayHandler struct {
	db *gorm.DB
}

func NewAdminSeedreampayHandler(db *gorm.DB) *AdminSeedreampayHandler {
	return &AdminSeedreampayHandler{db: db}
}

// GET /api/v1/admin/seedreampay/vouchers?status=...&page=1&size=50&serial=...
func (h *AdminSeedreampayHandler) ListVouchers(c *gin.Context) {
	status := c.Query("status")
	serial := c.Query("serial")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	size, _ := strconv.Atoi(c.DefaultQuery("size", "50"))
	if page < 1 {
		page = 1
	}
	if size < 1 || size > 200 {
		size = 50
	}

	q := h.db.WithContext(c.Request.Context()).
		Model(&domain.VoucherCode{}).
		Joins(`JOIN Products p ON p."Id" = "VoucherCodes"."ProductId"`).
		Where(`p."ProviderCode" = ?`, "SEEDREAMPAY")
	if status != "" {
		q = q.Where(`"VoucherCodes"."Status" = ?`, status)
	}
	if serial != "" {
		q = q.Where(`"VoucherCodes"."SerialNo" LIKE ?`, "%"+serial+"%")
	}
	var total int64
	if err := q.Count(&total).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	var items []domain.VoucherCode
	if err := q.Order(`"VoucherCodes"."CreatedAt" DESC`).
		Offset((page - 1) * size).Limit(size).Find(&items).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"items": items,
		"meta":  gin.H{"page": page, "size": size, "total": total},
	})
}

// GET /api/v1/admin/seedreampay/issuance-logs?page=1&size=50
func (h *AdminSeedreampayHandler) ListIssuanceLogs(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	size, _ := strconv.Atoi(c.DefaultQuery("size", "50"))
	if page < 1 {
		page = 1
	}
	if size < 1 || size > 200 {
		size = 50
	}
	var items []domain.IssuanceLog
	var total int64
	q := h.db.WithContext(c.Request.Context()).
		Model(&domain.IssuanceLog{}).
		Where(`"ProviderCode" = ?`, "SEEDREAMPAY")
	if err := q.Count(&total).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if err := q.Order(`"CreatedAt" DESC`).
		Offset((page - 1) * size).Limit(size).Find(&items).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"items": items,
		"meta":  gin.H{"page": page, "size": size, "total": total},
	})
}
```

- [ ] **Step 2: router.go 에 경로 등록**

`router.go` 의 라우트 등록 함수 (기존 패턴 찾기):

```bash
grep -n "POST.*vouchers\|Group.*seedream\|GET.*admin" go-server/internal/routes/router.go | head -20
```

기존 패턴에 맞춰 추가:

```go
// router.go — JWT 보호 그룹 안
sp := authed.Group("/seedreampay/vouchers")
{
    sp.GET("/:serialNo", seedreampayHandler.Get)
    sp.POST("/verify", seedreampayHandler.Verify)
    sp.POST("/redeem", seedreampayHandler.Redeem)
    sp.POST("/:serialNo/refund", seedreampayHandler.Refund)
}

// router.go — ADMIN 보호 그룹 안
admin := authed.Group("/admin", adminOnlyMiddleware)
{
    admin.GET("/seedreampay/vouchers", adminSeedreampayHandler.ListVouchers)
    admin.GET("/seedreampay/issuance-logs", adminSeedreampayHandler.ListIssuanceLogs)
}
```

**주의**: 실제 미들웨어 이름 (`adminOnlyMiddleware`) 은 프로젝트 관례에 맞춰 교체. `grep -n "AdminOnly\|RequireRole" go-server/internal/` 로 확인.

- [ ] **Step 3: container.go 에서 서비스·핸들러·락아웃 와이어링**

```go
// go-server/internal/routes/container.go — NewHandlers() 안

// Redis 클라이언트 (환경 변수 REDIS_ADDR 기반)
rdb := redis.NewClient(&redis.Options{Addr: cfg.RedisAddr})
lockoutGuard := lockout.NewGuard(rdb, 5, 15*time.Minute)

seedreampaySvc := services.NewSeedreampayService(db, lockoutGuard, paymentProvider, time.Now)
seedreampayHandler := handlers.NewSeedreampayHandler(seedreampaySvc, lockoutGuard)
adminSeedreampayHandler := handlers.NewAdminSeedreampayHandler(db)

return &Handlers{
    // ...기존...
    SeedreampayHandler:      seedreampayHandler,
    AdminSeedreampayHandler: adminSeedreampayHandler,
    SeedreampayService:      seedreampaySvc, // 크론에서 쓰도록 노출
}
```

`Handlers` 구조체에 필드 3개 추가. `Config` 에 `RedisAddr string` 없으면 추가 (env `REDIS_ADDR` 기본 `localhost:6379`).

- [ ] **Step 4: 크론 등록**

```go
// go-server/internal/cron/scheduler.go — 기존 AddFunc 옆

// 매일 02:00 에 씨드림페이 만료 전이
_, _ = scheduler.AddFunc("0 2 * * *", func() {
    ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
    defer cancel()
    n, err := seedreampaySvc.MarkExpiredVouchers(ctx)
    if err != nil {
        logger.Log.Error("seedreampay.expire.error", zap.Error(err))
        return
    }
    logger.Log.Info("seedreampay.expire.done", zap.Int64("expiredCount", n))
})
```

- [ ] **Step 5: 빌드 + 단위 테스트 회귀**

```bash
cd go-server
go build ./...
go test ./internal/... -count=1 -short
```

Expected: 에러 0, 테스트 PASS.

- [ ] **Step 6: Commit**

```bash
git add go-server/internal/api/handlers/admin_seedreampay_handler.go \
        go-server/internal/routes/router.go \
        go-server/internal/routes/container.go \
        go-server/internal/cron/scheduler.go
git commit -m "feat(seedreampay): wire admin handler + routes + expiry cron"
```

---

## Task 12: End-to-end 라이프사이클 통합 테스트

**Files:**
- Create: `go-server/test/integration/seedreampay_lifecycle_test.go`

**Branch:** `feat/seedreampay-voucher-p1-redeem` (동일)

- [ ] **Step 1: 통합 테스트 작성 (실 MSSQL 필요)**

```go
// go-server/test/integration/seedreampay_lifecycle_test.go
//go:build integration

package integration

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"seedream-gift-server/internal/app/interfaces"
	"seedream-gift-server/internal/app/services"
	"seedream-gift-server/internal/domain"
	"seedream-gift-server/internal/infra/issuance"
)

// TestSeedreampayLifecycle_IssueRedeemExpire 는 발급→사용→만료 전 과정을
// 실 MSSQL (test DB) 에서 검증한다.
func TestSeedreampayLifecycle_IssueRedeemExpire(t *testing.T) {
	db := requireIntegrationDB(t)   // test 헬퍼 — env DATABASE_URL_TEST 로드
	ctx := context.Background()

	// 1. Product (10,000원권) 존재 확인 (migration 009 이 선행)
	var product domain.Product
	require.NoError(t, db.Where("Brand=? AND ProviderProductCode=?", "SEEDREAMPAY", "10000").First(&product).Error)

	// 2. Issue
	issuer := issuance.NewSeedreampayIssuer(db, time.Now)
	vouchers, err := issuer.Issue(ctx, interfaces.IssueRequest{
		ProductCode: "10000",
		Quantity:    1,
		OrderCode:   "IT-ORD-001",
		ProductID:   product.ID,
		OrderID:     99999, // 테스트 전용 seed Order ID
	})
	require.NoError(t, err)
	require.Len(t, vouchers, 1)

	serial := vouchers[0].TransactionRef
	secret := vouchers[0].PinCode

	// 3. VoucherCode 가 SOLD 상태로 DB 에 존재
	var vc domain.VoucherCode
	require.NoError(t, db.Where("SerialNo=?", serial).First(&vc).Error)
	require.Equal(t, "SOLD", vc.Status)
	require.NotNil(t, vc.SecretHash)

	// 4. Redeem 성공
	svc := services.NewSeedreampayService(db, nil, nil, time.Now)
	res, err := svc.Redeem(ctx, services.RedeemInput{
		SerialNo: serial, Secret: secret, UserID: 1, UsageOrder: 88888, ClientIP: "127.0.0.1",
	})
	require.NoError(t, err)
	require.Equal(t, serial, res.SerialNo)
	require.Equal(t, 10000, res.AmountApplied)

	// 5. 두 번째 Redeem 은 409
	_, err = svc.Redeem(ctx, services.RedeemInput{
		SerialNo: serial, Secret: secret, UserID: 1, UsageOrder: 88888, ClientIP: "127.0.0.1",
	})
	require.ErrorIs(t, err, services.ErrVoucherAlreadyUsed)

	// 6. DB 상태 검증
	require.NoError(t, db.Where("SerialNo=?", serial).First(&vc).Error)
	require.Equal(t, "USED", vc.Status)
	require.NotNil(t, vc.RedeemedOrderID)
	require.Equal(t, 88888, *vc.RedeemedOrderID)

	// 정리
	require.NoError(t, db.Where("SerialNo=?", serial).Delete(&domain.VoucherCode{}).Error)
}
```

`requireIntegrationDB` 헬퍼는 `go-server/test/integration/helpers.go` 에 이미 있다면 재사용, 없으면 추가 (env `DATABASE_URL_TEST` 에서 GORM 오픈).

- [ ] **Step 2: 통합 테스트 실행**

```bash
cd go-server
DATABASE_URL_TEST="sqlserver://..." go test -tags=integration ./test/integration/ -run TestSeedreampayLifecycle -v -count=1
```

Expected: PASS (실제 MSSQL 필요).

- [ ] **Step 3: Commit**

```bash
git add go-server/test/integration/seedreampay_lifecycle_test.go
git commit -m "test(seedreampay): add integration lifecycle test (issue→redeem→used)"
```

- [ ] **Step 4: 최종 PR**

```bash
git push -u origin feat/seedreampay-voucher-p1-redeem
gh pr create --title "Seedreampay P1: redeem (lockout + service + handlers + cron + e2e)" --body "$(cat <<'EOF'
## Summary
- Redis lockout guard (fail-open, serial/IP 카운터) — Task 6
- SeedreampayService with GetBySerial / VerifyPair / Redeem (CAS) / Refund (7일) / MarkExpired — Task 7–9
- HTTP handlers (user + admin) — Task 10–11
- Daily expiry cron — Task 11
- End-to-end integration lifecycle test — Task 12

## Test plan
- [ ] `go test ./internal/... -count=1 -short` 전체 PASS
- [ ] `go test -tags=integration ./test/integration/` PASS (test DB 연결 시)
- [ ] 수동 smoke: SEEDREAMPAY 10,000원권 주문 → 결제 → VoucherCode 생성 확인 → redeem API 200 → 재시도 409
- [ ] 관찰성: 로그 `seedreampay.*` 키 확인, 만료 크론 실행 로그 확인

## Security
- [x] 비밀코드 평문 DB·로그·응답 금지 (`json:"-"` + logger 필드 필터)
- [x] Secret 발급 직후 1회만 노출 (이후 재조회 물리적 불가)
- [x] 락아웃: SerialNo 미존재 시 IP 카운터만 증가 (피해자 DoS 방지)
- [x] Redis 장애 시 fail-open

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Post-Implementation Checklist

- [ ] 스펙 §13 보안 체크리스트 8개 항목 실제 구현 확인
- [ ] 스펙 §14 범위 외 항목을 Phase 2 백로그 티켓으로 등록
- [ ] 프로덕션 배포 전 `REDIS_ADDR` 환경 변수 Server B (.env) 에 설정 확인
- [ ] 마이그레이션 009 를 production MSSQL 에 선행 실행 후 Go API 배포
- [ ] 관찰성: Grafana 대시보드에 `seedreampay_*` 지표 패널 추가 (Phase 2 여도 좋음)

---

## 자주 예상되는 실패

| 증상 | 원인 | 조치 |
|------|------|------|
| Issue 성공했지만 VoucherCode row 없음 | 트랜잭션 rollback 이 로그 없이 일어남 | `tx.Create` 에러를 반드시 wrap해 반환 중인지 확인 (Task 4 구현 참조) |
| Redeem 이 항상 `ErrSecretMismatch` | 해시 비교 방향 오류 (salt = serial vs client-input) | `SecretHash(secret, serial)` 순서가 Issue·Redeem 에서 일치하는지 확인 |
| 테스트 `TestSeedreampayIssuer_Issue_Success` 이 ExpectationsWereMet 에서 실패 | sqlmock 의 INSERT regex 가 GORM 실제 쿼리와 불일치 | `mock.ExpectExec` regex 를 더 느슨하게 또는 `QueryMatcherRegexp` 대신 `QueryMatcherEqual` 로 구체 쿼리 캡처 |
| Redis 장애 시 테스트가 타임아웃 | `IsBlocked` 가 blocking call | 컨텍스트 타임아웃 세팅 + fail-open 분기 확인 |
| 동시 redeem 테스트 flaky | CAS 경쟁이 실 DB 에서만 관측됨 | 통합 테스트에서 goroutine 2개로 동시 호출 |

---

## Spec Coverage Map

| Spec § | 구현 Task |
|--------|-----------|
| §4 데이터 모델 | Task 1 (migration), Task 2 (domain fields) |
| §5 코드 스키마 | Task 3 (generators + hash) |
| §5.3 락아웃 | Task 6 (Guard), Task 10 (handler 통합) |
| §6 상태 머신 | Task 4 (Issue creates SOLD), Task 8 (CAS SOLD→USED), Task 9 (REFUNDED, EXPIRED) |
| §6.3 환불 7일 | Task 9 (Refund) |
| §6.4 만료 | Task 9 (MarkExpiredVouchers), Task 11 (cron) |
| §7 API | Task 10 (user), Task 11 (admin) |
| §8 Issuer/DI | Task 4, Task 5 |
| §9 테스트 | Task 3·4·6·7·8·9·10 (unit), Task 12 (integration) |
| §10 Admin UI | Task 11 (backend only — UI 는 Phase 2 프론트엔드) |
| §11 마이그레이션 | Task 1 |
| §12 브랜치 전략 | Phase A/B/C 로 반영 |
| §13 보안 체크리스트 | Task 2 (`json:"-"`), Task 4 (원본 비저장), Task 10 (응답 마스킹), Post-checklist |
