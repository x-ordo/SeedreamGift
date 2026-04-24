---
title: Seedream TEST 환경 런치 Runbook
date: 2026-04-24
status: ready
audience: Ops (원격 서버 작업자)
---

# Seedream Webhook 런치 Runbook

Seedream Ops 에 TEST 환경 webhook URL 등록이 완료된 직후,
**운영자가 원격 서버에서 실행할 작업 목록**.

로컬 준비물은 이미 체크됨 (2026-04-24):
- `deploy/ssl/fullchain.pem` + `privkey.pem` 변환 완료 (leaf+chain 2 블록)
- `go-server/.env` 에 TEST 환경 secret + API key 이미 세팅
- `scripts/seedream-webhook-sign.mjs` — smoke test 용 HMAC helper 제공

---

## §1. 배포 실행 순서 (total ~15분)

### 1.1. Server C (103.97.209.131, MSSQL) — Migration 실행

SSMS 또는 `sqlcmd` 로 `SEEDREAM_GIFT_DB` 접속 후 **파일 순서대로** 실행:

```
go-server/migrations/008_seedream_payment_data_model.sql
go-server/migrations/009_seedreampay_schema.sql
go-server/migrations/010_payment_seedream_daoutrx.sql
go-server/migrations/011_payment_pending_unique.sql
go-server/migrations/012_order_deadline_columns.sql
go-server/migrations/013_payment_pending_unique_method_scope.sql
```

모두 `IF NOT EXISTS` 가드 포함 — **반복 실행 안전**. 이미 적용된 건은 PRINT 만.

검증 쿼리:
```sql
-- WebhookReceipt 테이블 존재
SELECT OBJECT_ID('dbo.WebhookReceipts') AS webhook_receipts_object_id;
-- ReconcileCursor 싱글턴 seed
SELECT * FROM dbo.ReconcileCursors;
-- Payment filtered unique index (013 적용 후 이름은 동일, filter 만 달라짐)
SELECT name, filter_definition FROM sys.indexes
WHERE object_id = OBJECT_ID('dbo.Payments') AND name = 'UX_Payments_OrderId_Pending';
-- expected: Status = 'PENDING' AND Method = 'VIRTUAL_ACCOUNT_SEEDREAM'
-- Orders.Status 크기
SELECT max_length FROM sys.columns
WHERE object_id = OBJECT_ID('dbo.Orders') AND name = 'Status';
-- expected: 20
-- Orders deadline 컬럼
SELECT COUNT(*) AS deadline_cols FROM sys.columns
WHERE object_id = OBJECT_ID('dbo.Orders')
  AND name IN ('PaymentDeadlineAt','WithdrawalDeadlineAt','DigitalDeliveryAt');
-- expected: 3
```

### 1.2. Server A (103.97.209.205, nginx/frontend) — SSL 배포 + nginx reload

**deploy/ssl/** 두 파일을 Server A 로 복사:

```powershell
# 로컬 (SeedreamGift repo root) 에서
scp deploy/ssl/fullchain.pem Administrator@103.97.209.205:C:/nginx/ssl/seedreamgift.com/
scp deploy/ssl/privkey.pem   Administrator@103.97.209.205:C:/nginx/ssl/seedreamgift.com/
```

(또는 zip → RDP → 해당 폴더 배치)

**nginx 설정 배포**:
```powershell
scp config/nginx/nginx205.conf Administrator@103.97.209.205:C:/nginx/conf/nginx.conf
```

**Server A 에서**:
```powershell
cd C:\nginx
.\nginx.exe -t                     # 구문 검증
.\nginx.exe -s reload              # 무중단 재시작
```

### 1.3. Server B (103.97.209.194, Go API) — env 배포 + 서비스 재기동

**`.env` (TEST 환경용) 를 Server B 로 배포**:
```powershell
# 로컬 repo root 에서
scp go-server/.env Administrator@103.97.209.194:C:/deploy-server/seedream-api/.env
```

> ⚠️ `.env.production` 을 쓰지 마세요 — 현재 `SEEDREAM_WEBHOOK_SECRET=""` 로 비어
> 있어 서버 부팅 시 Fatal. TEST smoke test 단계에서는 `.env` (test secret 포함) 사용.

**Server B 에서**:
```powershell
nssm stop SeedreamGiftAPI
# .env 덮어쓰기 확인
type C:\deploy-server\seedream-api\.env | findstr SEEDREAM_WEBHOOK_SECRET
# (값이 "5e03...3e32" 로 보여야 함)
nssm start SeedreamGiftAPI
```

**부팅 로그 확인** (nssm log 또는 `C:\deploy-server\seedream-api\logs\`):
```
INFO  Pre-flight 검증 시작
INFO  Pre-flight: DB 연결 OK
INFO  Pre-flight 검증 완료
INFO  Cron scheduler started
INFO  Listening on :52201
```

`Fatal: SEEDREAM_WEBHOOK_SECRET 미설정` 나오면 1.3 의 env 가 전달 안 된 것.

### 1.4. Cloudflare orange cloud 활성화 (선택)

`dash.cloudflare.com` → seedreamgift.com → DNS → A record 의 proxy (cloud) 클릭.
활성화 후 nginx 가 Cloudflare IP 에서 들어오는 `CF-Connecting-IP` 헤더를 읽도록
`nginx205.conf` 의 `set_real_ip_from` 블록이 이미 포함돼 있음.

**참고**: orange cloud 활성화 시 Seedream `103.97.209.194` 에서 오는 트래픽이
Cloudflare 를 거쳐 들어옴 — whitelist 는 `CF-Connecting-IP` 기준으로 작동해야 함
(이미 적용됨).

---

## §2. Smoke Test

### 2.1. 환경 헬스체크

```powershell
# Server B API 가 외부에서 접근 가능한지
curl https://seedreamgift.com/api/v1/health
# expected: 200 OK { "status": "ok", ... }

# webhook 경로가 미들웨어 bypass 되어 POST 받을 준비됐는지 (GET 은 405 또는 404)
curl -X POST https://seedreamgift.com/webhook/seedream -d '{}'
# expected: 400 (signature 없음) — **500/404/403 아니라 400 이어야 bypass 성공**
```

### 2.2. 로컬에서 서명된 webhook 전송

**repo root** 에서:

```bash
# PowerShell 또는 Git Bash
SEEDREAM_WEBHOOK_SECRET=5e03871191dff72179d1cf2c12d16d64c8819c4e7cc8c775ce757e951afa3e32 \
  node scripts/seedream-webhook-sign.mjs \
    --event vaccount.issued \
    --payload scripts/fixtures/vaccount-issued.sample.json \
    --send https://seedreamgift.com/webhook/seedream
```

Expected 응답:
```
HTTP 200
{"success":true,"data":{"accepted":true}, ...}
```

**실패 시 진단**:
- `400 invalid signature` → secret 값 불일치 or env 재확인
- `400 timestamp skew` → Server B 시계 드리프트 (10분 초과) — NTP 동기화
- `500` → 애플리케이션 에러. Server B 로그 확인 (이 경우 Seedream 재시도 발생 — 복구 후 자동 수렴)
- `connection refused` → nginx/Server B 미가동

### 2.3. DB 측면 검증

Smoke test 성공 후 Server C 에서:
```sql
SELECT TOP 1 * FROM dbo.WebhookReceipts ORDER BY ReceivedAt DESC;
-- expected: DeliveryId = scripts 가 생성한 랜덤 ID,
--           Event = 'vaccount.issued',
--           ProcessedAt IS NOT NULL (워커 풀에서 dispatch 완료)
```

---

## §3. 실제 TEST 주문 E2E (Task 12)

헬스체크 + smoke webhook 이 OK 면 실제 플로우:

1. `https://seedreamgift.com` 접속 → 로그인 (KYC 완료된 유저)
2. 상품권 상품 장바구니 추가 → `/checkout`
3. 결제수단 **가상계좌** 선택 → "주문하기"
4. `/checkout/redirect` 자동 submit → 키움페이 은행선택 창
5. 은행 선택 완료 → 우리 사이트로 복귀 (또는 MyPage)
6. MyPage 주문 탭 → PENDING 주문의 `PendingPaymentCard` 에 계좌번호 표시되는지 확인
7. 안내 계좌로 **소액 (1000원 정도)** 입금
8. 1분 이내 Order.Status: PENDING → ISSUED → PAID 자동 전이 확인
9. `PAID` 이후 "주문 진행 이력" 펼쳐서 VACCOUNT_ISSUED, PAYMENT_CONFIRMED 이벤트 확인

**관찰 대상 (Server B 로그)**:
- `seedream webhook received event=vaccount.issued`
- `seedream webhook dispatched`
- `vaccount.deposited 처리 완료 vouchersSold=N`

---

## §4. PROD 전환 준비 (추후)

TEST smoke 가 안정적으로 돌면:

1. Seedream Ops 에 **PROD 환경 등록 요청** (`onboarding.md §3.1` 템플릿, 환경 섹션만 `production` 으로)
2. Ops 답신 → `.env.production` 의 `SEEDREAM_WEBHOOK_SECRET` 에 prod secret 삽입
3. `.env.production` 을 Server B 로 배포 (기존 `.env` 대체)
4. PROD 용 실제 소액 주문 1건 재검증

---

## §5. 롤백

문제 발생 시 Server B 만 이전 빌드로 되돌리면 즉시 차단:
```powershell
nssm stop SeedreamGiftAPI
# 이전 빌드 zip 복원
Expand-Archive api-prev.zip -Dest C:\deploy-server\seedream-api -Force
nssm start SeedreamGiftAPI
```

Migration 은 모두 idempotent + 컬럼 추가 방향 — 이전 바이너리가 새 컬럼을 무시하면 기능만
비활성화되고 기존 기능은 영향 없음.
