---
title: Seedream 연동을 위한 Go API 수정사항 정리
date: 2026-04-23
status: working document
branch: feat/seedreampay-voucher-p1-schema
related:
  - docs/seedreamapi_docs/2026-04-21-giftcard-site-seedream-api-integration.md
  - docs/seedreamapi_docs/onboarding.md
  - docs/superpowers/specs/2026-04-22-seedream-payment-integration-design.md
  - docs/superpowers/plans/2026-04-22-seedream-payment-phase-3-webhook-state-machine.md
  - config/nginx/nginx205.conf
---

# Seedream 연동 Go API 수정사항

nginx 경로(`/webhook/seedream`) 를 131 Go API(:52201) 로 프록시하도록 설정 완료된 상태에서,
**API 측에서 실제 구현되어야 할 변경사항**을 페이즈별로 정리.

## §0. 요약 한 줄

> **현재 브랜치(`feat/seedreampay-voucher-p1-schema`) 는 상품권 PIN 발급 로직이며, Seedream 결제 연동은 별도 작업 라인이다.** Seedream 결제 Phase 3(웹훅 수신) 이 아직 구현되지 않아 `POST /webhook/seedream` 는 현재 404. nginx 적용과 동시에 Phase 3 착수 필요.

---

## §1. SSL 인증서 배포

### 1.1. 현재 stage 상태 (`deploy/ssl/`)

AlphaSign 에서 발급받은 4개 파일이 staging 폴더에 있음:

| 파일 | 크기 | 용도 |
|------|------|------|
| `www_seedreamgift.com.key` | 1.7 KB | **개인키** (PRIVATE — 절대 커밋 금지) |
| `www_seedreamgift.com_cert.crt` | 2.3 KB | 서버 인증서 (리프) |
| `www_seedreamgift.com_chain_cert.crt` | 2.0 KB | 중간 CA 체인 |
| `www_seedreamgift.com_root_cert.crt` | 2.0 KB | 루트 CA (참고용) |

### 1.2. nginx 가 기대하는 형식

`nginx205.conf:255-256` 는 PEM 통합 형식 기대:

```nginx
ssl_certificate     C:/nginx/ssl/seedreamgift.com/fullchain.pem;
ssl_certificate_key C:/nginx/ssl/seedreamgift.com/privkey.pem;
```

### 1.3. 변환 + 배포 절차

**로컬(stage)** 에서 변환:

```powershell
# fullchain.pem = 리프 인증서 + 중간 체인 (순서 중요)
Get-Content deploy\ssl\www_seedreamgift.com_cert.crt, `
            deploy\ssl\www_seedreamgift.com_chain_cert.crt `
  | Set-Content -Encoding ASCII deploy\ssl\fullchain.pem

# privkey.pem = 개인키 (그대로 리네임)
Copy-Item deploy\ssl\www_seedreamgift.com.key deploy\ssl\privkey.pem
```

**Server 205** 에 배포 (scp 또는 RDP 복사):

```powershell
# 서버 205 에서
New-Item -ItemType Directory -Force -Path C:\nginx\ssl\seedreamgift.com
Copy-Item fullchain.pem C:\nginx\ssl\seedreamgift.com\
Copy-Item privkey.pem   C:\nginx\ssl\seedreamgift.com\
# 권한: Administrators + SYSTEM 만 read. Everyone 제거.
icacls C:\nginx\ssl\seedreamgift.com\privkey.pem /inheritance:r
icacls C:\nginx\ssl\seedreamgift.com\privkey.pem /grant "SYSTEM:R" "Administrators:R"

# 검증
cd C:\nginx
.\nginx.exe -t     # configuration check
.\nginx.exe -s reload
```

### 1.4. 커밋 정책

| 파일 | 커밋? |
|------|------|
| `deploy/ssl/*.key` · `privkey.pem` | ❌ 절대 금지 |
| `deploy/ssl/*.crt` · `fullchain.pem` | ⚠ 공개값이지만 권장 안 함 |
| `deploy/ssl/README.md` (변환 절차 문서) | ✅ 권장 |

`.gitignore` 에 `deploy/ssl/*.key`, `deploy/ssl/privkey.pem`, `deploy/ssl/*.pem` 추가 필요.

---

## §2. API 수정 현황 스냅샷

### 2.1. 이미 구현됨 (main 병합 완료)

| 항목 | 파일 | 도입 커밋 |
|------|------|----------|
| Seedream VAccount DTO 타입 | `internal/infra/seedream/types.go` | `f0e6e5d` |
| `reservedIndex2` 매핑 + invariant | `internal/infra/seedream/reserved.go` | `a04918b` |
| 에러코드 → Go sentinel 매핑 | `internal/infra/seedream/errors.go` | `6f237a9` |
| REST 클라이언트 `IssueVAccount` | `internal/infra/seedream/client.go` | `34069a5` |
| 웹훅 HMAC-SHA256 검증 유틸 | `internal/infra/seedream/webhook_verify.go` | `becde78` |
| 웹훅 EventType 상수 + payload struct | `internal/infra/seedream/webhook_types.go` | `2657263` |
| `Payment` 도메인 Seedream 필드 | `internal/domain/payment_seedream_fields_test.go` 참조 | (이전) |
| `WebhookReceipt` 도메인 모델 (멱등 수신) | `internal/domain/webhook_receipt.go` | (이전) |
| 환경 설정 필드 | `internal/config/*.go` (SEEDREAM_API_KEY 등) | `9a4b119` |

### 2.2. 현재 브랜치 (`feat/seedreampay-voucher-p1-schema`)

**주의**: 이 브랜치는 **Seedream 결제 연동과 직접 관련이 없다**. 상품권 PIN 발급(SeedreamPay Voucher) 로직이다.

| 항목 | 파일 |
|------|------|
| VoucherCode 스키마 확장 (SerialNo/SecretHash/Redeemed*) | `internal/domain/voucher_code.go` |
| Seedreampay issuer/codes | `internal/infra/issuance/seedreampay_*.go` |
| Seedreampay 서비스 | `internal/app/services/seedreampay_svc.go` |
| 핸들러 + 라우터 + 통합 테스트 | `internal/api/handlers/seedreampay_handler*.go` |
| 마이그레이션 009 | (마이그레이션 파일) |

이 브랜치가 main 에 병합되면 Seedream 결제 Phase 2/3 작업이 병렬로 진행 가능.

### 2.3. 아직 미구현 (Seedream 결제 연동)

#### Phase 2 잔여 — Client 발급 플로우
- [ ] `POST /api/v1/payment/seedream/initiate` 핸들러 (주문 → `IssueVAccount` 호출 → `targetUrl + formData` 반환)
- [ ] 기존 `IPaymentProvider` + `MockPaymentProvider` + `TossPaymentProvider` 제거 (D2)
- [ ] `payment_service.go` 334줄 전체를 Seedream 전용으로 재작성
- [ ] 프론트엔드 HTML auto-submit 페이지 (`/payment/redirect?token=...`) — `formData.TOKEN` DB·로그 절대 저장 금지 (D5)

#### Phase 3 잔여 — 웹훅 수신 + 상태머신 (**nginx 적용과 같이 필수**)
- [ ] `internal/api/handlers/seedream_webhook_handler.go` — HTTP 진입점
- [ ] `internal/app/services/vaccount_state.go` — 순수 상태 전이 함수
- [ ] `internal/app/services/vaccount_webhook_svc.go` — dispatch 레이어
- [ ] `internal/infra/workqueue/webhook_job.go` — 비동기 job 타입
- [ ] `internal/routes/register.go` — `/webhook/seedream` 등록 (`/api/v1` **밖** root 라우트)
- [ ] DI 컨테이너에 `WebhookWorkerPool` 추가

**처리 이벤트 3종 (Phase 3 범위)**:
- `vaccount.requested` (no-op, 수신 로그만)
- `vaccount.issued` (Order PENDING → ISSUED, 계좌번호 저장)
- `vaccount.deposited` (Order → PAID, Voucher SOLD, Ledger 기록)

**미지원 이벤트 방어**: 알 수 없는 `X-Seedream-Event` → 200 반환 + no-op (5xx 금지).

#### Phase 4 잔여 — 취소/환불 + 나머지 4개 이벤트
- [ ] `POST /api/v1/payment/seedream/cancel` — 발급 취소(`VACCOUNT-ISSUECAN`)
- [ ] `POST /api/v1/payment/seedream/refund` — 환불(`BANK`)
- [ ] 웹훅 이벤트 추가 처리:
  - `payment.canceled` (가맹점 요청 취소)
  - `vaccount.deposit_canceled` (환불 성공)
  - `vaccount.cancelled` (외부 자동 취소 — 영국식 L 두 개)
  - `deposit_cancel.deposited` (환불 VA 입금 확인)
- [ ] 상태 전이 확장: `ISSUED → CANCELLED`, `PAID → REFUNDED`, `REFUNDED → REFUND_PAID`

#### Phase 5 잔여 — Reconcile + 만료
- [ ] 10분 주기 Reconcile cron (`GET /api/v1/vaccount?orderNo=` 대조)
- [ ] 1분 주기 만료 타이머 (`depositEndDateAt` 지난 PENDING → EXPIRED)

---

## §3. 환경변수 추가·확인

### 3.1. 이미 정의됨 (`9a4b119` 에서 추가)

| 키 | 값(예시) | 용도 |
|---|---|---|
| `SEEDREAM_API_KEY` | (32+ 바이트 hex) | Seedream PROD 호출 인증 |
| `SEEDREAM_API_BASE` | `https://api.seedreamapi.kr` | Seedream PROD base URL |
| `SEEDREAM_WEBHOOK_SECRET` | (32+ 바이트 hex) | **웹훅 HMAC 검증** — onboarding.md §2 생성값 |
| `SEEDREAM_RECONCILE_INTERVAL` | `10m` | Phase 5 |
| `SEEDREAM_EXPIRY_INTERVAL` | `1m` | Phase 5 |

### 3.2. 추가 권장

| 키 | 값 | 용도 |
|---|---|---|
| `SEEDREAM_API_KEY_TEST` | (32+ 바이트 hex) | TEST 환경 분리 |
| `SEEDREAM_API_BASE_TEST` | `https://test.seedreamapi.kr` | TEST base URL |
| `SEEDREAM_WEBHOOK_SECRET_TEST` | (별도 발급) | TEST 웹훅 HMAC |
| `SEEDREAM_CALLER_ID` | `giftsite-prod` (Ops 결정값) | 로그 매칭 |

### 3.3. 보관 위치

- **개발**: `.env` (`.gitignore` 포함 확인)
- **운영 131 서버**: Windows Credential Manager 또는 NSSM environment variables (`nssm set SeedreamGiftAPI AppEnvironmentExtra SEEDREAM_API_KEY=...`)
- **평문 금지**: 디스크에 `.env` 로 두되 NTFS 권한을 NSSM 실행 계정으로 제한

---

## §4. nginx ↔ Go API 계약

nginx205.conf 의 `/webhook/seedream` location 이 Go API 에 요구하는 계약:

| 항목 | 값 | 비고 |
|------|-----|------|
| **라우트** | `POST /webhook/seedream` (`= exact match`) | `/api/v1/` 접두사 **없음** |
| **소스 IP** | `103.97.209.194` (Seedream 아웃바운드) | nginx 가 1차 차단. `deny all`. |
| **요청 버퍼링** | 전체 body | `proxy_request_buffering on` 로 HMAC 검증 안전성 확보 |
| **응답 시한** | **10초** 내 200 | Seedream §8.6.5. 이상 시 재시도 트리거 |
| **응답 본문** | 무시됨 | 어떤 내용이든 상태코드만 봄 |
| **헤더** | `X-Seedream-Event`, `X-Seedream-Delivery-Id`, `X-Signature` | Go 쪽에서 검증 |

### 4.1. 핸들러 필수 동작 순서

```
1. X-Signature 헤더 → HMAC-SHA256(SEEDREAM_WEBHOOK_SECRET, body) 비교
   ↳ 불일치: 500 반환 (§8.6.3 — 4xx 금지, 4xx 는 즉시 DLQ 됨)
2. WebhookReceipt INSERT (DeliveryID PK, OnConflict DoNothing)
   ↳ 이미 존재: 즉시 200 (멱등 no-op)
3. workqueue.WebhookJob enqueue (비동기)
4. 즉시 200 반환
── (이후 워커가 상태 전이 적용 + ProcessedAt 업데이트) ──
```

---

## §5. 배포 순서

**nginx 를 먼저 켜면 404 폭탄** — 아래 순서 엄수.

```
1. [Go API] Phase 3 핸들러 구현 + 테스트
       ↓
2. [Go API] 131 에 배포 — 52201 에서 POST /webhook/seedream 이 200 반환
       ↓
3. [Go API] localhost 에서 smoke test:
       curl -X POST http://127.0.0.1:52201/webhook/seedream \
         -H "X-Signature: <valid HMAC>" \
         -H "X-Seedream-Event: vaccount.requested" \
         -d '{...}'  → 200
       ↓
4. [nginx 205] SSL 배포 (§1.3) + 설정 reload
       ↓
5. [nginx 205] 외부에서 smoke test:
       curl -X POST https://seedreamgift.com/webhook/seedream   → 403 (화이트리스트 차단)
       ↓
6. [Seedream Ops] Partners.WebhookURL 등록 요청 (onboarding.md §3.1)
       ↓
7. [Seedream TEST] 테스트 발급 1건 진행 → vaccount.issued · vaccount.deposited 수신 확인
       ↓
8. [모니터링] logs/seedream_webhook.log 에 200 응답 기록 확인
```

---

## §6. 리스크 · 주의

### 6.1. 현재 구현 공백으로 인한 리스크

| 리스크 | 영향 | 완화 |
|---|---|---|
| Phase 3 미구현 상태에서 nginx 만 활성화 | `/webhook/seedream` 가 404 — Seedream 재시도 폭주 → DLQ | Partners.WebhookURL 등록은 **Phase 3 배포 후** |
| Phase 4 미구현 상태에서 취소 웹훅 수신 | Unknown event → 200 no-op (안전) | Phase 4 병행 진행 권장 |
| Reconcile 미구현 상태에서 웹훅 유실 | 주문 상태 영구 미동기화 | Phase 5 우선순위 조정 필요 |

### 6.2. 설계 결정 사항 (참조)

상세 근거: `docs/superpowers/specs/2026-04-22-seedream-payment-integration-design.md` §1 Decisions Log.

- **D2**: 기존 `IPaymentProvider` 전면 삭제. Mock/Toss Provider 제거.
- **D3**: `orderNo = Order.OrderCode` 재사용. 신규 컬럼 불필요.
- **D4**: "HMAC 검증 → 멱등 INSERT → enqueue → 즉시 200" 패턴.
- **D5**: `formData.TOKEN` DB·로그 절대 저장 금지 (1회용 브라우저 토큰).
- **D6**: Reconcile 10분 / 만료 감지 1분.

### 6.3. 로그 마스킹

Phase 3 추가 시 `pkg/logger/masking.go` (또는 동등) 에 신규 규칙 필요:
- `SEEDREAM_WEBHOOK_SECRET` 값
- `formData.TOKEN` (§5.4.3 1회용)
- `X-API-Key` 헤더 값
- `SigningSecret` 키 회전 값

---

## §7. 다음 액션 우선순위

1. **[이번 브랜치 병합 후]** Phase 3 (웹훅 수신) 실행 — 계획서는 `docs/superpowers/plans/2026-04-22-seedream-payment-phase-3-webhook-state-machine.md` 에 Task 단위로 상세화되어 있음
2. **Phase 4** (취소/환불) 즉시 후행 — 미구현 시 VACCOUNT 결제 후 환불 불가능
3. **Phase 5** (Reconcile/만료) — 운영 안정성 (웹훅 유실 보완)
4. **Phase 2 잔여** (Client 발급 플로우) — 현재 Mock Provider 라도 돌고 있으면 후순위 가능

병렬화 기준: Phase 3 · 4 는 같은 상태머신 확장이라 **한 개발자가 순차** 진행이 안전. Phase 5 는 독립 cron job 이라 다른 개발자 병행 가능.
