---
title: Seedream Payment Phase 3 — Follow-up Items
date: 2026-04-23
updated: 2026-04-24
status: tracking (Phase 4/5 merged on current branch — many items closed)
phase: 3 (merged) + 4 (merged, `feat/seedreampay-voucher-p1-schema`) + 5 (merged, same branch)
related:
  - docs/superpowers/plans/2026-04-22-seedream-payment-phase-3-webhook-state-machine.md
  - docs/superpowers/plans/2026-04-23-seedream-payment-phase-4-cancel-refund.md
  - docs/seedreamapi_docs/api-modifications.md
---

# Phase 3 Follow-up Items

Phase 3(Seedream 웹훅 수신) 최종 통합 리뷰에서 식별된 non-blocker 개선 항목. Phase 4 / Phase 5 구현 과정에서 아래와 같이 상당수가 처리됨.

**처리 완료된 blocker** (`f19426c` 커밋):
- ✅ C-1: `SEEDREAM_WEBHOOK_SECRET` 부팅 assertion
- ✅ C-2: `/webhook/seedream` 경로 middleware 4xx bypass
- ✅ I-1: AuditMiddleware `accountNo`/`receiverName`/`depositorName` PII mask

**Phase 4/5 중 처리된 I급 항목**:
- ✅ I-2: Sync fallback context — `context.WithTimeout(Background(), 8s)` 로 수정 (`ebaf51c`)
- ✅ I-3: ApplyIssued terminal state WARN — 테스트 `TestApplyVAccountIssued_TerminalState_Warns` 포함 (`0b0a4c3`)
- ✅ I-4 (CLOSED): non-issue — Phase 3/4/5 가 단일 branch 에서 통합 머지 예정이므로 Phase 3 단독 배포 기간이 존재하지 않음. Phase 4 배포 시 ProcessedAt 이 이미 Phase 4 핸들러에서 세팅되는 구조. 원래 우려된 "Phase 3 단독 가동 중 도달한 cancel 이벤트의 replay 불가" 시나리오는 발생하지 않음.

---

## Important (I급) — Phase 4 초입 처리 권장

### ✅ I-2. Sync fallback이 gin request context 사용 — 처리됨 (`ebaf51c`)

**파일**: `go-server/internal/api/handlers/seedream_webhook_handler.go:113`

**증상**: 워커 풀 Submit 실패 시 sync fallback이 `ctx := c.Request.Context()` 을 Handle 에 전달. HTTP 응답 반환 직전 ctx 가 cancelled 되면 상태 전이가 `context canceled` 로 중단 → 500 반환 → Seedream 불필요 재시도.

**수정**:
```go
syncCtx, cancel := context.WithTimeout(context.Background(), 8*time.Second)
defer cancel()
if err := h.webhookSvc.Handle(syncCtx, deliveryID, event, raw); err != nil {
    // ...
}
```

예상 작업량: 10분. Phase 4 Cancel/Refund 핸들러에서 동일 패턴 사용할 테니 함께 정리.

---

### ✅ I-3. `ApplyIssued`가 CANCELLED/EXPIRED 를 INFO 무음 처리 — 처리됨 (`0b0a4c3`)

**파일**: `go-server/internal/app/services/vaccount_state.go:47-51`

**증상**: Order 가 이미 CANCELLED/EXPIRED 인데 Seedream 이 late `vaccount.issued` 보내면 INFO 로그 + no-op. 다음 셋 중 하나의 실제 anomaly:
- Seedream이 우리 cancel 요청을 못 받음
- 우리 cancel API 호출이 조용히 실패
- user cancel ↔ Seedream bank-selection 간 레이스

**수정**:
```go
switch order.Status {
case OrderStatusIssued, OrderStatusPaid, OrderStatusDelivered, OrderStatusCompleted:
    s.logger.Info("vaccount.issued 재수신 — idempotent no-op", ...)
    return nil
default: // CANCELLED, EXPIRED, AMOUNT_MISMATCH
    s.logger.Warn("vaccount.issued arrived after terminal state — possible cancel race", ...)
    return nil
}
```

예상 작업량: 15분 + 테스트 3~4 케이스 추가.

---

### ✅ I-4. (CLOSED — non-issue) Phase 4 이벤트가 Phase 3 에서 ProcessedAt 세팅

**파일**: `go-server/internal/app/services/vaccount_webhook_svc.go:57-65`

**증상**: Phase 3 구현은 `EventPaymentCanceled` / `EventVAccountDepositCanceled` / `EventVAccountCancelled` / `EventDepositCancelDeposited` 를 Info 로그 후 200 반환 + ProcessedAt 업데이트. Phase 4 배포 시 동일 DeliveryID 는 `ProcessedAt != nil` 이라 재처리 불가 → 과거 cancel 이벤트 replay 불가능.

**옵션**:
- **A**: Phase 4 에서 새 컬럼 `Phase` 추가 (receipt 가 어느 Phase 에서 처리됐는지 기록). Phase 4 handler는 `WHERE Phase = 'phase3_noop'` 로 replay.
- **B**: Phase 3 에서 해당 이벤트들은 **ProcessedAt 세팅 안 함** — Phase 4 배포 시 Seedream 재시도 기다려 자연스럽게 흡수. 단점: 최대 `MaxRetries × backoff` 기간 동안 200 응답하지 않음(재시도 폭주).
- **C**: Phase 4 마이그레이션 스크립트로 해당 이벤트의 receipt 를 `ProcessedAt = NULL` 로 되돌리고 worker 재큐.

권장: **A**. 가장 침습적이지만 "Phase 별 처리 이력" 이라는 감사 가치도 덤.

예상 작업량: Phase 4 설계 시 동시 반영, 마이그레이션 + 코드 30~60분.

---

### I-5. `OnConflict{DoNothing}` MSSQL dialect 동작 검증 필요

**파일**: `go-server/internal/api/handlers/seedream_webhook_handler.go:91`

**증상**: GORM 이 MSSQL 에서 `OnConflict` 를 `MERGE INTO ... WHEN NOT MATCHED` 로 번역. 두 가지 잠재 문제:
1. 동시 INSERT(same `DeliveryId`) 시 deadlock 위험 (default isolation 에서 MERGE 는 `HOLDLOCK` 없으면 phantom read 가능)
2. GORM 버전에 따라 MERGE 로 스킵된 행도 `RowsAffected=1` 반환할 수 있음 → handler 의 "idempotent no-op" 분기가 발동 안 함

**수정**: MSSQL 환경에서 다음 시나리오 통합 테스트 추가
```go
// 같은 DeliveryId 로 동시 2회 POST → 한 건은 INSERT, 한 건은 skip
// 각 응답 200, 최종 receipt count = 1
```

대안: `OnConflict{DoNothing: true}` 를 명시적 `INSERT ... WHERE NOT EXISTS` 패턴(dialect-neutral)으로 교체.

예상 작업량: MSSQL 통합 테스트 환경 구성 포함 2~4시간. 트래픽 적은 초기엔 낮은 우선순위.

---

## Minor (M급) — 점진적 개선

### M-1. `extractOrderNoAndEventID` 중복 JSON 파싱

**파일**: `seedream_webhook_handler.go:125-137` + `vaccount_webhook_svc.go:44-55`

핸들러가 `orderNo`/`eventId` 추출하려 raw body 1회 파싱, 서비스가 typed payload 로 또 파싱. 스루풋 영향은 미미하지만 consolidate 하면 깔끔.

### M-2. DeliveryId 헤더 raw 로깅 길이 clamp

**파일**: `seedream_webhook_handler.go:76`

`zap.String("raw", deliveryIDStr)` 에 공격자가 거대 값 넣으면 로그 크기 폭증. `zap.String("raw", truncate(deliveryIDStr, 32))` 또는 `strconv.Quote` 권장.

### M-3. Webhook pool sizing 근거 주석

**파일**: `routes/container.go:142-144`

`Workers:4, QueueSize:200` 에 주석 추가:
```go
// 4 workers × ~100ms/전이 = steady ~40 req/s
// 200-deep queue = 5-retry storm of ≤40 orders 흡수
// 초과 시 sync fallback → HTTP 최대 +30ms latency
```

### M-4. `map[string]any` UPDATE pointer 제거

**파일**: `vaccount_state.go:64-69`

현재: `bankCode := payload.BankCode; &bankCode`
권장: `map[string]any{"BankCode": payload.BankCode, ...}` — GORM 이 자동 처리.

### M-5. `ApplyIssued` — Payment 레코드 없는 케이스 테스트

**파일**: `vaccount_state_test.go`

Payment 가 없을 때 `WHERE OrderId = ? AND Status = 'PENDING'` 이 0 rows 영향 → Order 는 ISSUED 로 전이되지만 Payment 필드 업데이트 없음. Phase 2 Issue() 버그 방어를 위해 테스트 추가 (또는 explicit error 반환으로 전환).

### M-6. 통합 테스트 커버리지 확장

**파일**: `seedream_webhook_handler_integration_test.go`

현재 3 케이스 (valid / invalid-sig / duplicate). 추가 권장:
- Worker Submit 실패 → sync fallback 성공 경로
- WebhookReceipt INSERT 실패 → 500
- MaxBytesReader 거부 (1 MiB 초과)
- Timestamp 만료 → ErrTimestampSkew → 500

각 10~20줄.

### M-7. `RawBody: string(raw)` 인코딩 가정 주석

**파일**: `seedream_webhook_handler.go:87`

"RawBody 는 Seedream 이 JSON (UTF-8 content-type) 으로 전송한다는 §8.3.1 전제 하에 string 변환" 주석 추가. 바이너리 payload 가능성에 대비.

---

## Task 9 (Live E2E) — 환경 의존 블로커

플랜의 Task 9 "TEST 환경 E2E — 결제 완주" 는 다음 선행 조건 필요:
- [ ] Seedream Ops 가 Partners 테이블에 우리 `WebhookURL` 등록 (onboarding.md §3.1 템플릿 발송)
- [ ] 키움 support 가 Seedream CPID 에 4개 통지 URL 등록 (onboarding.md §3.2)
- [ ] 205 SSL 배포 + nginx reload 완료
- [ ] 131 에 `SEEDREAM_WEBHOOK_SECRET` 환경변수 설정 + Go API 재기동 (Phase 3 f19426c 포함 빌드)
- [ ] Cloudflare 앞단 활성화 (orange cloud)
- [ ] TEST 주문 1건 결제 완주 → `vaccount.issued` + `vaccount.deposited` 웹훅 수신 로그 확인

이 모든 조건이 충족되면 Task 9 은 단순 1회 수동 smoke test. 10분 내 완료.

---

## 참고: 우선순위 매트릭스 (2026-04-24 업데이트)

| 항목 | 상태 | 처리 커밋 / 사유 |
|------|------|-------------------|
| I-2 | ✅ 완료 | `ebaf51c` — `context.WithTimeout(Background(), 8s)` |
| I-3 | ✅ 완료 | `0b0a4c3` — WARN 분기 + `TestApplyVAccountIssued_TerminalState_Warns` |
| I-4 | ✅ closed (non-issue) | 현재 branch 에 Phase 3/4/5 통합 머지 예정 — Phase 3 단독 배포 시나리오 없음 |
| I-5 | ⏳ open | MSSQL 부하 관찰 후. 현재 단일 webhook 소스라 동시성 이슈 낮음 |
| M-1~M-7 | ⏳ open | 지속적 개선. Phase 5 MVP 가동 후 운영 지표 보고 우선순위 재평가 |
| Task 9 (수동 E2E) | ⏳ blocked | 인프라 온보딩 (SSL 205 배포, nginx reload, 131 firewall, 키움 4 URL 등록) 완료 후 |

---

## Phase 5 완료 후 Seedream 통합 현황 (2026-04-24)

Phase 5-A/B 까지 모든 backend + frontend 가 현재 branch 에 통합됨:

| Phase | 구현 | 주요 커밋 |
|-------|-----|-----------|
| 2 backend | VAccountService.Issue + /payments/initiate | `9dc1a6a`, `d0ce845` |
| 2 frontend | useInitiatePayment + /checkout/redirect + VA 분기 | `a722567` |
| 3 | 웹훅 수신 + 상태 머신 + 워커 풀 | `3d7c290`~`f19426c` |
| 4 | CancelService + /payment/seedream/cancel + 4 웹훅 payload | `5ae0088`~`df203fb` |
| 5-A | SeedreamExpiryService (1분 cron) + OrderService 가드 | `2a21374` |
| 5-B | ListVAccounts + WalkVAccountsSince + ReconcileService (10분 cron, 관찰 전용) | `e81638e` |

**배포 전 실행 필요** (2026-04-24 업데이트):

| # | 단계 | 상태 |
|---|------|------|
| 1 | `migrations/010~013` Server C MSSQL 순차 실행 | ⏳ 원격 작업 대기 |
| 2 | `SEEDREAM_WEBHOOK_SECRET` 환경변수 — **TEST 용 `.env` 에 이미 세팅 완료** (`5e03...3e32`) | ✅ 로컬 준비 완료 |
| 3 | `SEEDREAM_API_KEY` — TEST 용 `.env` 에 이미 세팅 (`623f...`) | ✅ 로컬 준비 완료 |
| 4 | SSL 변환: AlphaSign 4파일 → `fullchain.pem` + `privkey.pem` | ✅ `deploy/ssl/` 완료 |
| 5 | SSL 배포 (Server A `C:/nginx/ssl/seedreamgift.com/`) + nginx reload | ⏳ 원격 작업 대기 |
| 6 | Server B 에 `.env` 배포 + `nssm restart SeedreamGiftAPI` | ⏳ 원격 작업 대기 |
| 7 | Seedream Ops 에 TEST `WebhookURL` 등록 요청 | ✅ **2026-04-24 완료** |
| 8 | 키움 support 에 4개 통지 URL 등록 요청 (`onboarding.md §3.2`) | ⏳ 발송 필요 |
| 9 | Cloudflare orange cloud 활성화 | ⏳ 선택 사항 |
| 10 | Task 9 수동 smoke test (`docs/seedreamapi_docs/deploy-runbook.md §2,3`) | ⏳ 5,6 완료 후 |

**다음 단계 권장 순서**: 1 → 5 → 6 → smoke test → 8 → 10.

**PROD 전환**: TEST 안정화 후 Seedream Ops 에 PROD 환경 별도 등록 요청 필요.
현재 `.env.production` 의 `SEEDREAM_WEBHOOK_SECRET=""` 비어있음 — PROD secret 발급 후 채워야 함.

**Phase 5 자동 복구 도입 기준**:
- Reconcile 의 drift 로그를 2주 이상 관찰
- 오탐/오판 패턴이 < 1% 일 때 `DriftMissingDepositWebhook` 만 자동 apply 로 시작
- 다른 drift 종류는 수동 처리 유지
