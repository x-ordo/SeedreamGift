---
title: 상품권 사이트 ↔ Seedream API 통합 가이드
slug: giftcard-site-seedream-api-integration
version: 1.0.0
author: Seedream Platform Team
created: 2026-04-21
revised: 2026-04-22
audience: 상품권 사이트 개발자 + AI 코드 어시스턴트 (Claude Code · Cursor · Copilot)
status: DRAFT (구현 전 최종 확정 대기)
repo_commit: 1f8a58467b02d1ba58af5bfa683bc475a62026ff
repo_branch: main
scope:
  - LINK 모드 가상계좌 발급 (POST /api/v1/vaccount)
  - 입금내역 조회 (GET /api/v1/vaccount)
  - 발급 취소 + 환불(입금후취소) 통합 (POST /api/v1/payment/cancel)
  - 웹훅 수신 (Seedream → 상품권 사이트)
out_of_scope:
  - WebView 모드 (/api/v1/vaccount/webview)
  - 배치 발급 (/api/v1/vaccount/batch)
  - 고정식(Fixed) 가상계좌 (/api/v1/vaccount/fixed/**) — 키움 계약 미체결
  - SDK 직접 호출 — 키움 계약 미체결
  - 통합 승인 API 즉시발급 모드 (issueMode=api) — 별도 협의 필요
  - 신규 /api/v1/refunds 리소스 — IN_DEVELOPMENT, CARD 9029 시나리오 전용
invariants:
  - CPID는 Seedream 서버 비밀. 클라이언트 요청·응답·로그 어디에도 노출 금지.
  - reservedIndex1 = "seedreamgift" 고정 상수 (상품권 사이트 발급건 식별 태그)
  - reservedIndex2 = <파트너ID> 동적 (상품권 사이트 내부 판매 파트너 식별자)
  - reservedString = "default" 고정 상수
  - depositEndDate = 요청 시점 + 30분 (YYYYMMDDhhmmss, KST)
  - Idempotency-Key 모든 mutating 요청 필수 (POST /vaccount, POST /payment/cancel)
  - HMAC-SHA256 웹훅 서명 검증 필수 (±600s timestamp skew, webhookverify.Verify 주석 권장치)
---

# 상품권 사이트 ↔ Seedream API 통합 가이드

> **이 문서를 어떻게 읽어야 하는가**
>
> 이 문서는 **AI 코드 어시스턴트가 읽고 바로 구현**할 수 있도록 작성되었습니다. 상품권 사이트(호출자)가 Seedream Go REST API를 **직접** 호출해 키움페이 LINK 가상계좌 결제를 연동하는 4가지 기능을 완결적으로 덮습니다.
>
> - **§0 TL;DR**: 5분 안에 전체 흐름 파악
> - **§1–§4**: 통합의 계약 표면 (용어·인증·프로토콜·은행코드)
> - **§5–§8**: 기능별 상세 (요청/응답 스키마 + 예제 + 실패 모드)
> - **§9**: 시나리오 플레이북 (정상·비정상 경로)
> - **§10–§11**: 관찰가능성·구현 체크리스트
> - **부록 A–E**: 참조 자료 (에러코드 전체·cURL·Go 클라이언트 스켈레톤·Go 회귀 테스트·FAQ)

---

## 목차

- [§0. TL;DR — 5분 요약](#0-tldr--5분-요약)
- [§1. 용어와 원칙](#1-용어와-원칙)
- [§2. 연결 환경](#2-연결-환경)
- [§3. 공통 프로토콜](#3-공통-프로토콜)
  - [3.1. 인증 (X-API-Key)](#31-인증-x-api-key)
  - [3.2. 응답 포맷 (표준 엔벨로프)](#32-응답-포맷-표준-엔벨로프)
  - [3.3. 에러 코드 매트릭스](#33-에러-코드-매트릭스)
  - [3.4. 멱등성 (Idempotency-Key)](#34-멱등성-idempotency-key)
  - [3.5. RESERVED 왕복 불변식](#35-reserved-왕복-불변식)
  - [3.6. 레이트 리밋](#36-레이트-리밋)
  - [3.7. 추적 헤더 (X-Trace-Id)](#37-추적-헤더-x-trace-id)
- [§4. 은행 코드 3중 체계](#4-은행-코드-3중-체계)
- [§5. LINK 가상계좌 발급](#5-link-가상계좌-발급)
- [§6. 입금내역 조회](#6-입금내역-조회)
- [§7. 발급 취소 + 환불(입금후취소) — 통합](#7-발급-취소--환불입금후취소--통합)
- [§8. 웹훅 수신 (Seedream → 상품권 사이트)](#8-웹훅-수신-seedream--상품권-사이트)
- [§9. 플레이북 — 정상/비정상 경로](#9-플레이북--정상비정상-경로)
- [§10. 관찰가능성](#10-관찰가능성)
- [§11. 구현 체크리스트](#11-구현-체크리스트)
- [부록 A. 에러 코드 전체 목록](#부록-a-에러-코드-전체-목록)
- [부록 B. cURL 예제 모음](#부록-b-curl-예제-모음)
- [부록 C. Go 클라이언트 스켈레톤](#부록-c-go-클라이언트-스켈레톤)
- [부록 D. RESERVED 왕복 불변식 회귀 테스트 (Go)](#부록-d-reserved-왕복-불변식-회귀-테스트-go)
- [부록 E. 운영 FAQ](#부록-e-운영-faq)

---

## §0. TL;DR — 5분 요약

**상품권 사이트가 해야 할 일 4가지:**

| # | 기능 | 엔드포인트 | 인증 | 멱등 | 완결 |
|---|------|-----------|------|------|------|
| 1 | **LINK 가상계좌 발급** | `POST /api/v1/vaccount` | X-API-Key | 필수 | 1차 응답(PENDING+targetUrl) → 고객 은행선택 → 웹훅 `vaccount.issued` |
| 2 | **입금내역 조회** | `GET /api/v1/vaccount?from&to&status&orderNo&page&pageSize` | X-API-Key | — | 단일 동기 호출 |
| 3 | **발급 취소** (입금 전) | `POST /api/v1/payment/cancel` with `payMethod=VACCOUNT-ISSUECAN` | X-API-Key | 필수 | 단일 동기 호출 → 웹훅 `payment.canceled` |
| 3' | **환불** (입금 후) | `POST /api/v1/payment/cancel` with `payMethod=BANK` | X-API-Key | 필수 | 단일 동기 호출 → 웹훅 `vaccount.deposit_canceled` |
| 4 | **웹훅 수신** | 상품권 사이트의 `POST {WEBHOOK_URL}` | HMAC-SHA256 | 내장 | Seedream이 `Partners.MaxRetries` 만큼 재전송 (기본 5, §8.6.2) |

**전형적 플로우 (1건 결제의 시간선):**

```
[T+0]       상품권 사이트 → Seedream: POST /vaccount (payMethod=VACCT, issueMode=link)
[T+0]       Seedream → 키움페이: 결제창 요청
[T+0]       Seedream → 상품권 사이트: 200 { status:"PENDING", phase:"awaiting_bank_selection",
                                              targetUrl, formData, depositEndDate(30분 후) }
[T+0]       상품권 사이트 → 고객 브라우저: targetUrl + formData 자동 submit
[T+1~5분]   고객 → 키움페이 결제창: 은행 선택
[T+5분]     키움페이 → Seedream /notification/issue (EUC-KR GET)
[T+5분]     Seedream → 상품권 사이트 웹훅: vaccount.issued
                                            { orderNo, bankCode, accountNo, receiverName, issuedAt, depositEndDate }
[T+5~35분]  고객 → 발급받은 계좌로 입금
[T+N분]     키움페이 → Seedream /notification/deposit
[T+N분]     Seedream → 상품권 사이트 웹훅: vaccount.deposited
                                            { orderNo, amount, depositedAt }
```

**이 문서를 읽고 AI가 만들 수 있어야 하는 것:**

1. API Key + Idempotency-Key 헤더를 매번 올바르게 세팅하는 HTTP 클라이언트
2. 위 4개 기능을 호출하는 비즈니스 함수 4개
3. Seedream 웹훅을 받는 엔드포인트 + HMAC 서명 검증 + 멱등 처리
4. 에러 코드별 재시도/포기/사용자 통지 판정 테이블

---

## §1. 용어와 원칙

### 1.1. 용어

| 용어 | 의미 | 비고 |
|------|------|------|
| **Seedream** | 우리(미들웨어) Go REST API 서버 | 상품권 사이트의 호출 상대 |
| **키움페이 (KiwoomPay)** | 실제 PG(결제대행사) | Seedream이 뒤에서 호출. 상품권 사이트는 직접 접점 없음 |
| **CPID** | 키움페이 가맹점 식별자 | **Seedream 서버 비밀**. 상품권 사이트는 볼 일 없음 |
| **CallerID** (= PartnerID) | 상품권 사이트를 식별하는 Seedream 내부 ID | API Key가 자동 귀속시킴 — 상품권 사이트가 수동 전달 불필요 |
| **파트너 ID** | 상품권 사이트 **내부**의 판매 파트너 식별자 | `reservedIndex2` 로 전달 |
| **OrderNo** | 상품권 사이트가 생성·관리하는 주문번호 | max 50, `\|` 금지 |
| **DaouTrx** | 키움페이 거래번호 | 취소/환불 호출 시 `trxId` 파라미터로 사용 |
| **LINK 모드** | 키움페이 결제창에서 고객이 직접 은행 선택하는 2단계 플로우 | 현재 유일한 계약 방식 |

### 1.2. 아키텍처 원칙

#### 1.2.1. 단일 CPID 리셀러 모델

Seedream은 **1개의 키움페이 계약**으로 다수의 상품권 사이트/쇼핑몰을 중개하는 리셀러형 미들웨어다. 상품권 사이트가 반드시 지켜야 할 결과:

- **CPID 값은 모른 채 동작**: API 요청 바디·헤더·응답·로그 어디에도 CPID는 등장하지 않는다. 상품권 사이트가 어떤 경위로든 CPID 값을 관찰했다면 Seedream 쪽 회귀 버그.
- **인증은 X-API-Key 1개면 충분**: Seedream이 API Key에서 CallerID를 자동 유도. 별도 CallerID 헤더 전송 불요.
- **다른 가맹점과 섞이지 않음**: Seedream이 모든 조회(GET /vaccount, GET /payment/status/:id 등)를 자동으로 CallerID 스코프로 필터링. 상품권 사이트는 "자기 주문만 조회" 상태가 기본.

#### 1.2.2. RESERVED 왕복 불변식 (Seedream 평생 계약)

`reservedIndex1`, `reservedIndex2`, `reservedString` — 이 3개 필드는 **클라이언트가 보낸 값 그대로** 발급 응답·조회 응답·웹훅 전 구간에서 보존된다. Seedream은 이 왕복 보존을 회귀 테스트(`monitor.IncReservedRoundTripLoss()`)로 감시한다.

**상품권 사이트 고정 규약:**

```json
{
  "reservedIndex1": "seedreamgift",
  "reservedIndex2": "<판매파트너ID>",
  "reservedString": "default"
}
```

- `reservedIndex1 = "seedreamgift"` 고정 상수. 상품권 사이트 발급건 식별 태그.
- `reservedIndex2 = <파트너ID>` 동적. 상품권 사이트 내부 판매 파트너 식별자.
- `reservedString = "default"` 고정 상수. 용도 확정 전까지 이 값 유지.

**규약 위반 시 복구 난이도**: 발급 후 변경 불가. 발급 당시 값 그대로 웹훅·조회에 박혀 내려온다.

#### 1.2.3. 3계층 RBAC (상품권 사이트 내부 책임)

Seedream API 관점에서는 **유저·파트너·어드민 모두 동일한 API Key + CallerID**로 호출한다. 권한 경계는 **상품권 사이트 내부**가 책임진다:

| 호출자 | 상품권 사이트가 적용할 제약 |
|--------|------------------------------|
| 일반 유저 | 본인이 생성한 주문만 대상 (`orderNo` 소유권 검증) |
| 파트너 | `reservedIndex2 == 자기파트너ID` 조건 하의 주문만 대상 |
| 어드민 | 전체 주문 가능 |

**Seedream이 막아주지 않는다**. 상품권 사이트가 취소/환불 호출 직전에 내부 RBAC를 반드시 통과시켜라.

### 1.3. 명명 규칙

| 구분 | Seedream (우리) | KiwoomPay (외부 PG) |
|------|-----------------|---------------------|
| 도메인 | `seedreamapi.kr` | `kiwoompay.co.kr` |
| 사용자 텍스트 | "Seedream API" / "시드림" | 기술 문서에서만 "키움페이" |
| 통신 방향 | 상품권 사이트의 유일한 대화 상대 | 상품권 사이트가 직접 볼 일 없음 |

---

## §2. 연결 환경

### 2.1. Base URL

| 환경 | Base URL | 백엔드 | 용도 |
|------|----------|--------|------|
| **TEST (개발)** | `https://test.seedreamapi.kr` | nginx → :41927 | 개발·QA·UAT. Seedream 이 키움 DEV 환경(`KIWOOM_ENV=dev`) 으로 프록시 — 실제 돈 이동 없음 |
| **PROD (운영)** | `https://api.seedreamapi.kr` | nginx → :41928 | 운영. 루트 도메인 `https://seedreamapi.kr` 도 같은 백엔드에 연결됨 (nginx `server_name seedreamapi.kr api.seedreamapi.kr` 동일 처리) |

모든 엔드포인트는 `{BaseURL}/api/v1/...` 형태.

> **주의**: `staging.seedreamapi.kr` 서브도메인은 **존재하지 않는다**. TEST 환경은 오직 `test.seedreamapi.kr` 한 개. Stripe·AWS 등 흔한 관례(staging)와 다르므로 환경변수 이름·문서를 베낄 때 주의.

### 2.2. 온보딩 체크리스트 (Seedream Ops에게 받아야 할 것)

상품권 사이트 온보딩은 Seedream DB 의 두 테이블에 레코드를 insert 하는 작업이다:
- `APIKeys` — 상품권 사이트의 X-API-Key 해시·권한 (§3.1.3)
- `Partners` — 상품권 사이트의 웹훅 수신 설정 (아래 상세)

#### 2.2.1. API Key 관련

- [ ] **X-API-Key** 값 수령 (32+ 문자 랜덤 바이트의 base62 또는 hex). TEST·PROD 각각 별도 발급.
- [ ] **Permissions** 배열 확정 (§3.1.3). 권장: `["POST:/api/v1/vaccount", "GET:/api/v1/vaccount", "POST:/api/v1/payment/cancel"]`
- [ ] **CallerID** (= `APIKeys.PartnerID` = `Partners.PartnerID`) 값 수령. 참고용 — API 호출에 수동 전달 불필요, 로그 매칭 및 Ops 문의에만 사용.

#### 2.2.2. Partners(웹훅 수신) 테이블 레코드

Ops 에게 아래 필드를 **상품권 사이트에서 제공** 후 insert 를 요청:

| 필드 | 타입 | 기본값 | 상품권 사이트가 제공할 값 |
|------|------|--------|---------------------------|
| `PartnerID` | nvarchar(100) | — | CallerID 와 동일 (Ops가 결정) |
| `WebhookURL` | nvarchar(500) NOT NULL | — | `https://giftsite.example.com/webhook/seedream` 같은 수신 엔드포인트 (HTTPS 필수) |
| `SigningSecret` | nvarchar(128) NOT NULL | — | 32+ 바이트 랜덤 시크릿. 상품권 사이트가 생성해 Ops 에 전달하거나, Ops 발급 후 수령 |
| `PrevSigningSecret` | nvarchar(128) 옵션 | NULL | **키 회전 전용**. 회전 기간 동안 구·신 시크릿 모두로 서명 검증 수용. 초기 온보딩엔 비움 |
| `SecretRotatedAt` | datetime2 옵션 | NULL | 마지막 회전 시각. 회전 주기 모니터링 지표 |

> **보안 모델 경고**: `SigningSecret` · `PrevSigningSecret` 은 Seedream DB 에 **평문 nvarchar(128) 로 저장**된다 (`domain/partner.go:8-9`). 격벽은 3중:
>
> 1. Go 구조체 `json:"-"` 로 API 응답에서 제외
> 2. `pkg/logger` + `pkg/masking` 정규식으로 로그에서 가림
> 3. DB 접근 자격 자체가 Ops 전용
>
> envelope encryption(KMS/DEK) 은 현재 적용되지 않았다. 따라서 상품권 사이트 Ops 는 (a) DB 서버 권한을 최소 담당자로 제한하고 (b) 주기적 시크릿 회전(90일 권장) 을 Seedream Ops 와 함께 스케줄링할 것.
| `Enabled` | bool | true | false 이면 웹훅 전송 중지 (운영 차단) |
| `MaxRetries` | int | **5** | forwarder 가 backoff 재시도할 최대 횟수. §8.6.2. 권장 5~8 |
| `TimeoutSeconds` | int | **10** | 단일 POST HTTP 타임아웃. §8.6.5 |

> **키 회전 프로세스**: Ops가 새 `SigningSecret` 을 발급하면서 기존 값을 `PrevSigningSecret` 으로 이동 → 상품권 사이트가 양쪽 시크릿으로 서명 검증 → 안정화 후 `PrevSigningSecret` NULL 로 비움. 이 3단계를 Ops 와 사전 합의.

#### 2.2.3. IP 화이트리스트 상태 확인 (필수)

Seedream 은 **두 개의 서로 다른 IP 화이트리스트 경로**가 있다. 혼동 금지:

| 경로 | 미들웨어/핸들러 | 대상 | 상품권 사이트 영향 |
|------|-----------------|------|---------------------|
| `/api/v1/*` | `middleware.IPWhitelist()` (전역 미들웨어) | **상품권 사이트**의 아웃바운드 IP | 상품권 사이트 호출이 403 당할 위험 |
| `/notification/*` | `NotificationHandler.verifyKiwoomIP` (핸들러 내부 검증) | **키움페이 서버**의 통지 IP (prod: 27.102.213.200~209, dev/staging: 123.140.121.205) | 없음 — Seedream ↔ 키움 경로 전용 |

#### 2.2.4. `/notification/*` 엔드포인트별 용도 (Ops 참고)

상품권 사이트가 호출할 일은 없지만 장애 조사·키움 설정 변경 시 참고 필요:

| Seedream 엔드포인트 | 키움 PAYMETHOD | 의미 | 상품권 시나리오 |
|---------------------|----------------|------|-----------------|
| `GET /notification/issue` | `VACCOUNTISSUE` | 고객 은행 선택 완료 → 계좌번호 확정 통지 | **사용** (→ `vaccount.issued` 웹훅 생성) |
| `GET /notification/deposit` | `VACCOUNT` | 고객이 계좌에 입금 완료 | **사용** (→ `vaccount.deposited` 웹훅) |
| `GET /notification/cancel` | `VACCOUNTCANCEL` | 키움/은행 자동 취소 통지 | **사용** (→ `vaccount.cancelled` 웹훅, L 두 개) |
| `GET /notification/deposit-cancel` | — | 입금 후 취소(환불) 결과 통지 | **사용** (→ `vaccount.deposit_canceled` 웹훅, L 하나) |
| `GET /notification/payment` | 카드/모바일/간편결제 공통 | 통합 결제수단 완료 통지 | 미사용 (VACCOUNT 경로 아님) |

키움페이 관리자 페이지에서 상품권 사이트 CPID 에 대해 위 4개 통지 URL (/issue, /deposit, /cancel, /deposit-cancel) 이 등록되어 있어야 한다. 누락 시 Seedream 은 키움으로부터 통지를 못 받고, 결과적으로 상품권 사이트는 웹훅도 못 받는다.

#### 2.2.5. Seedream 측 필수 환경변수 (⚠️ 미설정 시 웹훅 전무)

- **`PORTAL_CLIENT_ID`**: Seedream `.env` 기본값 **0**. 이 값이 0 이면 `service.CancelService` / `service.NotificationService` 가 **웹훅 enqueue 자체를 건너뛴다** (`cancel_svc.go:247` `if s.portalClientID > 0`, `notification_svc.go:786` 동일 gate).
  - 기원: Phase C-1 에서 "포털 중앙 수신 경로 단일화" 목적으로 도입된 게이트. 값 자체는 `enqueueTyped` 내부에서 사용되지 않는 예약 파라미터(`_clientID`)이지만 **gate 조건으로는 살아 있다**.
  - 상품권 사이트 온보딩 액션: Seedream Ops 에 "PROD/TEST 양쪽 모두 `PORTAL_CLIENT_ID=<non-zero>` 설정 상태인가?" 확인. 0 이면 Partners 테이블에 레코드를 완벽히 등록해도 **이벤트가 전혀 발송되지 않는다**.

전역 미들웨어(`/api/v1/*`) 동작:
- **등록 엔트리 0개 → 전체 허용** (자동 무력화)
- **1개 이상 등록 → 등록 IP만 허용, 나머지 403**
- `/notification/*`, `/health`, `/swagger/*` 는 미들웨어 레벨에서 스킵 (핸들러 내부 검증은 별개)

**온보딩 액션**:
- Ops에 현재 `IPWhitelistEntries` 테이블 엔트리 수 확인 요청
- 0이면 조치 불요, 1 이상이면 상품권 사이트 고정 아웃바운드 IP 를 선등록받지 않는 한 모든 호출이 403 Forbidden

### 2.3. 네트워크 가정

- TLS 1.2 이상 필수 (1.3 권장).
- HTTPS only. HTTP 호출은 엣지에서 차단.
- 본문 크기 한도: **2 MiB** (config default `MAX_REQUEST_BODY_BYTES=2*1024*1024`, `middleware.MaxBodySize`). 초과 시 **413 Request Entity Too Large** + `"요청 본문이 허용된 크기를 초과했습니다"`. 4기능 어느 것도 이 한도에 근접하지 않는다.
- 커넥션 keep-alive 권장 (TLS 핸드셰이크 비용 절감).
- **BotBlocker**: Seedream 은 User-Agent 기반 차단을 하지 **않는다**. 경로 패턴(`.env`·`.git`·`/config`·`/debug`·`/wp-admin`·`/phpmyadmin` 등) + HTTP 메서드(TRACE·CONNECT·PROPFIND 등)만 차단 → 404/405. 상품권 사이트의 Go `http.Client` 기본 UA (`Go-http-client/1.1`) 로도 통과. 단 `/api/v1/vaccount` 같은 정상 경로만 호출할 것 — 엔드포인트 URL 에 `/config`·`/debug` 같은 쿼리 문자열을 실수로 붙이면 404.
- **Audit 미들웨어**: 상품권 사이트의 모든 `POST /api/v1/vaccount` / `POST /api/v1/payment/cancel` / `DELETE ...` 요청은 Seedream `AuditLogs` 테이블에 자동 기록된다. 요청·응답 body 는 각각 **4 KiB 까지만** 캡처되고 초과분은 잘리며 `BodyTruncated=true` 로 표기. `pkg/masking.MaskJSON` 이 카드번호·계좌번호 등 민감 패턴을 마스킹한 뒤 저장 — 상품권 사이트가 별도 마스킹을 하지 않아도 Seedream 쪽 DB 에는 안전한 형태로 남음. 감사 로그는 Worker pool (`internal/worker.WorkerPool`, 기본 **3 workers · queue 100**, Submit 은 non-blocking — 큐 포화 시 `monitor.IncWorkerDropped()` 증가 + 즉시 드롭 후 3초 타임아웃 동기 fallback 으로 DB INSERT) 로 비동기 쓰기지만 드물게 응답 지연이 튀거나(동기 fallback 경로) 로그 누락(드롭 경로)이 있을 수 있다 — 상품권 사이트가 결제 결과 재구성에 Seedream AuditLog 만 의존해선 안 되며, 자체 요청 로그를 별도로 보관할 것.

### 2.4. 타임존·시각 포맷

- Seedream 응답의 모든 타임스탬프는 **UTC ISO-8601** (예: `"2026-04-22T03:14:15Z"`) — RFC3339 호환.
- 키움페이 통지 원본 문자열 `depositEndDate`는 **KST YYYYMMDDhhmmss** (14자리, 타임존 없음). Seedream은 `depositEndDateAt` 편의 필드로 RFC3339 타임스탬프를 함께 내려준다.
- **파싱 원칙**: `depositEndDateAt` 우선 사용. `depositEndDate` 원본 문자열은 디버그 용도.

### 2.5a. 헬스체크 엔드포인트 (`GET /health`)

Seedream 은 **인증 없이** 공개되는 최소 헬스체크를 제공한다 — 상품권 사이트가 자체 모니터링에서 Seedream liveness 를 확인할 수 있는 경로:

```http
GET /health HTTP/1.1
Host: api.seedreamapi.kr
```

응답 (2가지 중 하나):

```json
// 정상
HTTP/1.1 200 OK
{ "status": "ok" }

// 비정상 (DB 연결 실패 또는 서킷 브레이커 Open 상태)
HTTP/1.1 503 Service Unavailable
{ "status": "degraded" }
```

특징:
- `/health` 는 `middleware.IPWhitelist`·`NoCacheAPI`·인증 미들웨어 **모두 스킵**. 상품권 사이트 아웃바운드 IP 가 whitelist 에 없어도 통과.
- 상세 정보(DB · 키움 API · 워커 풀 각각의 상태)는 **`GET /api/v1/admin/health`** 에만 노출 — admin JWT 필요. 상품권 사이트는 접근 불가.
- 헬스체크 주기 권장: **10~30초**. 더 짧으면 불필요한 트래픽, 더 길면 장애 감지 지연.

### 2.5b. Swagger UI 노출 범위

`/swagger/*` 경로는 **release 모드에선 비활성화**된다 (`router.go:103` `if cfg.GinMode != "release"`). 프로덕션 호스트에서는 404. TEST 환경(`KIWOOM_ENV=dev` 와 함께 `GIN_MODE=debug`)에서만 조회 가능.

상품권 사이트 개발 중 API 스펙을 확인하려면 `https://test.seedreamapi.kr/swagger/index.html` 경로를 사용. 프로덕션 URL(`api.seedreamapi.kr`)에선 접근 시도하지 말 것 — 404 로그만 쌓인다.

### 2.5. 인코딩 경계 (상품권 사이트는 UTF-8 만 쓰면 된다)

통합 경로에 두 개의 인코딩이 섞여 있다:

| 구간 | 인코딩 | 담당 |
|------|--------|------|
| 상품권 사이트 ↔ Seedream | **UTF-8 JSON** (전구간) | 상품권 사이트 |
| Seedream ↔ 키움페이 (요청) | UTF-8 → EUC-KR 변환 필요 시 Seedream 이 수행 | Seedream 내부 |
| 키움페이 → Seedream (`/notification/*` GET 콜백) | **EUC-KR percent-encoded 쿼리** | Seedream `handler/euckr.go` 가 UTF-8 로 복원 |
| Seedream → 상품권 사이트 (웹훅) | UTF-8 JSON | Seedream |

즉 상품권 사이트는 **EUC-KR 을 전혀 다룰 필요 없다**. `reservedString` 에 한글을 담아도 UTF-8 JSON body 로 보내면 되고, 웹훅·GET 응답에서도 UTF-8 로 돌아온다. `/notification/*` 는 Seedream ↔ 키움 경로라 상품권 사이트가 직접 구현할 일 없음.

---

## §3. 공통 프로토콜

### 3.1. 인증 (X-API-Key)

모든 `/api/v1/*` 엔드포인트는 `X-API-Key` 헤더가 필수다.

```http
GET /api/v1/vaccount?page=1 HTTP/1.1
Host: api.seedreamapi.kr          ← PROD. TEST 는 test.seedreamapi.kr
X-API-Key: sk_live_3f2k9a....{32+chars}
Accept: application/json
```

#### 3.1.1. 서버 측 동작 (참고)

Seedream은 X-API-Key를 다음 순서로 검증한다:

1. SHA-256(또는 Pepper 설정 시 HMAC-SHA256) 해시 계산
2. 5분 TTL 캐시 → 캐시 미스 시 DB 조회
3. `IsActive=true` + `ExpiresAt>now` 확인
4. 권한 패턴과 요청 경로 매칭 (§3.1.3)
5. 검증 성공 시 요청 context에 `CallerID=PartnerID` 주입

상품권 사이트가 알아야 할 것:

- **키 회전 시 즉시 반영**: 캐시 TTL 5분이 있지만 Seedream Ops가 `Invalidate` 수동 호출 가능. Cutover 직전 Ops에 요청하면 즉시 전환.
- **실패 응답**: `401 Unauthorized` + `errorCode=UNAUTHORIZED`. 키 자체 문제면 메시지 `"유효하지 않은 API 키입니다"` / `"비활성화된 API 키입니다"` / `"만료된 API 키입니다"` 중 하나. 권한 미스매치면 `403 Forbidden` + `errorCode=FORBIDDEN`.

#### 3.1.2. API Key 보관 원칙

- 환경변수 또는 시크릿 매니저에만 보관. 코드 리포지토리·로그·프런트엔드 번들 어디에도 박지 않는다.
- 로그에 HTTP 헤더 전체를 덤프하는 코드를 쓰지 마라. `X-API-Key`는 반드시 마스킹(`sk_live_***...***`).
- CI/CD에서 리퀘스트 로그가 GitHub Actions 등에 새어 나가지 않는지 점검.

#### 3.1.3. Permissions 패턴 (Ops 와 권한 논의 시 정확한 문법)

`APIKeys.Permissions` 컬럼은 JSON 문자열 배열. 상품권 사이트 온보딩 시 Ops 가 이 배열에 어떤 엔트리를 넣느냐로 접근 경로가 결정된다. 매칭 규칙 (`middleware/permission.go`):

| 패턴 예시 | 의미 |
|-----------|------|
| `"*"` | **글로벌 와일드카드** — 모든 메서드·모든 경로 (권장 안 함) |
| `"/api/v1/vaccount/*"` | 모든 메서드 + `/api/v1/vaccount` **또는** `/api/v1/vaccount/...` 접두사 매칭 |
| `"/api/v1/payment/cancel"` | 모든 메서드 + **정확히** 이 경로만 |
| `"POST:/api/v1/vaccount/*"` | **POST 메서드만** + 접두사 매칭 |
| `"*:/api/v1/*"` | 명시적 와일드카드 메서드 (빈 접두사와 동일하지만 의도가 명확) |

내부 동작:
- 메서드 비교 **case-insensitive** (`strings.EqualFold`). `post` / `POST` 모두 매칭.
- 경로는 `path.Clean()` 으로 정규화되어 `/../` 우회 차단.
- 접두사 `/path/*` 는 `CutSuffix` 후 `requestPath == prefix` 또는 `HasPrefix(prefix + "/")` — 즉 `/api/v1/vaccount` 와 `/api/v1/vaccount/batch` 는 매칭, `/api/v1/vaccountfixed` 는 매칭되지 않음 (`/` 경계 보호).

**상품권 사이트 권장 Permissions** (Ops 협의용):

```json
[
  "POST:/api/v1/vaccount",
  "GET:/api/v1/vaccount",
  "POST:/api/v1/payment/cancel"
]
```

명시적 메서드 분리로 과도 권한 차단. `GET /api/v1/vaccount` 는 목록 + 단건(`?orderNo=`) 모두 커버.

### 3.2. 응답 포맷 (표준 엔벨로프)

**성공 응답:**

```json
{
  "success": true,
  "data": { /* 엔드포인트별 페이로드 */ },
  "meta": {
    "traceId": "b3f5c9a2-...",
    "timestamp": "2026-04-22T09:30:00Z",
    "apiVersion": "v1"
  }
}
```

**에러 응답:**

```json
{
  "success": false,
  "error": "사람이 읽을 한국어 메시지",
  "errorCode": "VALIDATION",
  "errorId": "ERR-A3F21B9E8C7D1234",
  "validationErrors": {
    "orderNo": "주문번호는 필수입니다"
  },
  "meta": {
    "traceId": "b3f5c9a2-...",
    "timestamp": "2026-04-22T09:30:00Z",
    "apiVersion": "v1"
  }
}
```

**페이징 응답 (예: GET /vaccount):**

```json
{
  "success": true,
  "data": {
    "items": [ /* ... */ ],
    "total": 142,
    "page": 1,
    "limit": 20,
    "hasMore": true
  },
  "meta": { "traceId": "...", "timestamp": "...", "apiVersion": "v1" }
}
```

> **주의 1**: `traceId` 는 top-level 이 아니라 **`meta.traceId`**. `pkg/response/response.go` 의 `buildMeta(c)` 가 모든 성공·실패 응답에 이 객체를 삽입한다. top-level `traceId` 필드는 존재하지 않으므로 파싱 시 `body.meta.traceId` 로 접근.
>
> **주의 2**: 페이징 응답의 페이지 크기 필드명은 **`limit`** (요청 쿼리 파라미터는 `pageSize` 인데 응답 필드는 `limit` — 비대칭). 추가로 `hasMore` boolean 이 자동 계산되어 다음 페이지 존재 여부를 알려준다 (`int64(page*limit) < total` 로 산출).

#### 3.2.1. 파싱 규칙

- `success` 필드를 **반드시** 먼저 확인. HTTP 200이어도 `success=false` 가능 (예: 멱등 재생 응답 중 일부).
- `errorCode` (명시된 열거형) 우선 사용. HTTP 상태 코드는 fallback.
- `errorId`·`traceId` 는 로그에 반드시 기록. Ops 문의 시 1초 만에 원인을 찾을 수 있는 유일한 토큰.
- **`errorId` 포맷**: `ERR-{16자리 대문자 HEX}` 예: `ERR-A3F21B9E8C7D1234` (`pkg/response/response.go:generateErrorID`, crypto/rand 8바이트). 정규식 매칭용: `^ERR-[0-9A-F]{16}$`. Stripe 관례의 `err_...` 소문자 ULID 포맷이 **아니므로** 파싱 로직이 `ERR-` 접두사 기준으로 작성되어야 함.

#### 3.2.2. 특수 응답 헤더

| 헤더 | 값 | 의미 |
|------|-----|------|
| `X-Trace-Id` | uuid | 모든 응답에 포함. §3.7 |
| `Idempotency-Replayed` | `true` | **멱등 캐시 재생** 응답임. 신규 실행이 아니므로 side effect(로그·메트릭 카운트) 중복 기록하지 않도록 분기 판단에 활용 |
| `Cache-Control` | `private, no-store, no-cache, must-revalidate` | `middleware.NoCacheAPI()` 가 `/api/v1/*` 전체에 자동 부착. 상품권 사이트가 Seedream 앞에 CDN·프록시 캐시를 둬도 **응답이 캐시되지 않도록** 강제됨 |
| `Pragma` | `no-cache` | HTTP/1.0 호환 (위와 동시 부착) |
| `X-RateLimit-*` / `Retry-After` | §3.6.1 참조 | 레이트 리밋 정보 |

#### 3.2.3. 보안 헤더 (`middleware.SecurityHeaders`)

모든 응답에 아래 12개 헤더가 자동 부착된다. Go REST 클라이언트 입장에선 대부분 무시해도 되지만, **브라우저가 동일 응답을 받는 상황**(예: 웹훅 디버깅 도구를 브라우저로 띄우는 경우) 또는 보안 감사 시 참고.

| 헤더 | 값 |
|------|-----|
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` |
| `X-XSS-Protection` | `0` (OWASP 권장 — 레거시 필터 비활성) |
| `X-DNS-Prefetch-Control` | `off` |
| `X-Permitted-Cross-Domain-Policies` | `none` |
| `Referrer-Policy` | `same-origin` |
| `Content-Security-Policy` | `default-src 'self'` |
| `Cross-Origin-Opener-Policy` | `same-origin` |
| `Cross-Origin-Resource-Policy` | `cross-origin` |
| `Origin-Agent-Cluster` | `?1` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), payment=(self)` |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains; preload` — **release 모드 전용** (로컬 개발 PROD 아닌 곳에선 생략) |

#### 3.2.2. 잘못된 파싱 안티패턴

```go
// ❌ HTTP 상태만 보고 분기 — errorCode 정보가 사라진다
if resp.StatusCode == http.StatusOK { /* success */ } else { /* fail */ }

// ❌ error 메시지를 정규식으로 파싱 — 메시지는 로컬라이제이션·리워딩 대상
if strings.Contains(body.Error, "중복") { /* duplicate */ }

// ✅ errorCode 를 스위치
if !body.Success {
    switch body.ErrorCode {
    case "IDEMPOTENCY_KEY_REUSE":
        // ...
    case "VALIDATION":
        // ...
    default:
        // ...
    }
}
```

### 3.3. 에러 코드 매트릭스

상품권 사이트 4기능에서 마주칠 수 있는 `errorCode` 16종:

| errorCode | HTTP | 의미 | 상품권 사이트 조치 |
|-----------|------|------|---------------------|
| `VALIDATION` | 400 | 요청 필드 검증 실패 | `validationErrors` 맵을 UI에 반영. 재시도 금지 |
| `UNAUTHORIZED` | 401 | API Key 누락/만료/비활성 | 키 회전 확인. 사용자에겐 일반 오류 표시 |
| `FORBIDDEN` | 403 | 경로 권한 부족 | Ops에 API Key permissions 조정 요청 |
| `NOT_FOUND` | 404 | 리소스 없음 | 주문번호 오타/이미 삭제됨 등 확인 |
| `CONFLICT` | 409 | 상태 충돌 (일반) | 세부 메시지 확인 후 로직 재검토 |
| `INVALID_STATE_TRANSITION` | 409 | 상태머신 전이 위반 | 현재 주문 status를 재조회 후 판단 |
| `IDEMPOTENCY_KEY_REUSE` | 422 | 같은 키로 다른 바디 | **키 재사용 버그**. 키 생성 로직 점검 |
| `TOO_MANY_REQUESTS` | 429 | 레이트 리밋 초과 | 지수 백오프 재시도 |
| `INTERNAL` | 500 | 서버 내부 오류 | Ops 에스컬레이션. traceId 전달 |
| `EXTERNAL_API_ERROR` | 502 | 키움페이 API 실패 | ★ Seedream 이 **이미 `KIWOOM_RETRY_MAX=3` 회 자동 재시도**(`internal/resilience/retry.go`: 500ms→1s→2s+jitter, max 10s cap)를 돌린 **최종 실패** 다. 상품권 사이트가 즉시 재시도하면 서킷브레이커 카운터만 증가시켜 §3.3.1 의 `CIRCUIT_BREAKER_OPEN` 을 앞당긴다. **최소 수 초 대기** 후 같은 Idempotency-Key 로 1회 재시도, 반복 실패면 Ops |
| `CIRCUIT_BREAKER_OPEN` | 503 | 키움페이 장애로 서킷 열림 | **즉시 재시도 금지**. 실구현(`internal/resilience/circuit_breaker.go`, sony/gobreaker v2) 기본값: 연속 `KIWOOM_CB_FAIL_THRESHOLD=5` 회 실패 시 Open → `KIWOOM_CB_TIMEOUT=30s` 후 Half-Open 으로 전환되어 시험 호출 1건(`MaxRequests=1`) 허용. 상품권 사이트는 **최소 30s** 대기 후 재시도하고, 그 안에 다른 요청은 큐잉하거나 사용자에게 잠시 후 재시도 안내. 60s (`Interval`) 내 성공 시 Closed 복귀 |
| `TIMEOUT` | 504 | 업스트림 타임아웃 | Idempotency-Key 재사용해 안전 재시도 |
| `CANCEL_INVALID_STATE` | 409 | SUCCESS 외 상태 취소 시도 | 주문 status 재조회 후 판단 ★ 현행 REST 경로에선 직접 발생하지 않음 (Wails GUI 전용). REST에서는 대신 `EXTERNAL_API_ERROR` 또는 `INVALID_STATE_TRANSITION` 로 내려옴 |
| `CANCEL_ALREADY_DONE` | 409 | 이미 취소됨 | **성공으로 간주**. 멱등 재전송으로 처리 ★ 역시 REST 경로엔 직접 발생처 없음. 키움이 중복을 막으면 `EXTERNAL_API_ERROR` 로 래핑됨 |
| `CANCEL_API_FAILED` | 502 | 키움 취소 API 실패 | Idempotency-Key 재사용해 재시도. 반복 실패 시 Ops ★ 현행 REST 경로는 `apperror.ExternalAPI` 를 반환하므로 실제로 받는 코드는 `EXTERNAL_API_ERROR` |
| `CANCEL_REASON_EMPTY` | 400 | cancelReason 미입력/5자 미만 | UI 검증 강화 ★ 실제로는 DTO binding(`required,min=5`) 위반이 먼저 잡혀 `VALIDATION` 으로 내려옴 |

#### 3.3.1. 키움 원인 코드와 `EXTERNAL_API_ERROR` 의 관계

Seedream 은 키움페이 결과코드(`RESULTCODE`) 가 `"0000"` 이 아닌 모든 응답을 `apperror.ExternalAPI(...)` 로 래핑해 **502 `EXTERNAL_API_ERROR`** 로 단일화한다 (`pkg/apperror/apperror.go` + `service/cancel_svc.go:196`). 원본 코드는 `error` 문자열 내부에 평문으로 포함될 수 있으나 **구조화된 필드로 노출되지는 않는다** — 상품권 사이트가 키움 코드별 분기를 짜면 메시지 포맷 변경 시 회귀 버그가 된다.

상품권 시나리오에서 실제로 내려올 수 있는 키움 결과 코드 (참고):

| 키움 코드 | 의미 | 상품권 사이트 해석 |
|-----------|------|---------------------|
| `FAIL` | 가맹점 암호화 키 미설정 | Seedream 구성 이슈 → 즉시 Ops 에스컬레이션 |
| `9000` | 시스템 오류 | 재시도 가능. 반복 시 Ops |
| `9001` | 필수 파라미터 오류 | Seedream validator 를 우회한 요청. 요청 바디 점검 |
| `9002` | 중복 주문번호 | **같은 `orderNo` 로 과거 요청 성공이력 존재**. 재시도면 과거 발급본 재사용, 신규 주문이면 `orderNo` 재생성 |
| `9003/9004` | 토큰 만료/무효 | Seedream 측 토큰 이슈 → Ops |
| `9005` | 타임아웃 | 같은 Idempotency-Key 로 재시도 |
| `9011` | 파이프라인 오류 | 재시도 |
| `9101` | 미등록 CPID | Seedream 계약 이슈 → Ops |
| `9102` | 잘못된 PAYMETHOD | 상품권 사이트가 `VACCT`/`VACCOUNT-ISSUECAN`/`BANK` 외 값을 보냈는지 확인 |
| `9103` | 인증키 불일치 | Seedream 구성 이슈 → Ops |
| `9104/9105` | CP 비활성/차단 | 키움 측 계약 문제 → Ops |
| `9204` | 취소 실패 | 같은 Idempotency-Key 로 재시도. 반복 실패 시 Ops |
| `9206` | 이미 취소됨 | **성공으로 간주** — 내부 주문 상태를 `CANCELLED` 로 전이하고 사용자에겐 "이미 취소 완료" 안내 |
| `0304` | 가상계좌 오류 | 일반적 실패. 재시도 1회 + Ops |
| `9999` | 알 수 없는 오류 | Ops |

**권장 구현 규칙** (상품권 사이트):

1. `errorCode="EXTERNAL_API_ERROR"` 를 한 덩어리 "외부 실패" 로 처리. 키움 코드별 `if/switch` 로 세분화 **금지**.
2. `errorId` · `traceId` 를 로그에 남긴다 — Seedream 측 감사 로그 / 메트릭으로 원인 추적이 가능.
3. 같은 `Idempotency-Key` 로 **1~2회 재시도** 후 여전히 502 면 사용자에게 "잠시 후 다시 시도" 안내 + Ops 알림.
4. 단, `9206` (이미 취소됨) 의미상 "성공" 인 케이스는 Seedream 이 error message 에 `"이미 취소"` 문자열을 넣는 경우가 있으나 **확정적이지 않으므로** 분기 로직에 의존하지 말고 다음 작업 전 `GET /api/v1/vaccount?orderNo=...` 로 실제 상태를 재조회해 확인할 것.

**조치 분기 의사결정 트리:**

```
errorCode:
  ├─ VALIDATION / CANCEL_REASON_EMPTY  → 사용자 입력 고치기
  ├─ UNAUTHORIZED / FORBIDDEN          → 키/권한 문제. 운영팀
  ├─ NOT_FOUND                         → 주문 자체 없음. 사용자에게 안내
  ├─ CANCEL_ALREADY_DONE               → 성공으로 취급 (no-op)
  ├─ CONFLICT / *_INVALID_STATE        → 주문 최신 상태 재조회 후 재판단
  ├─ IDEMPOTENCY_KEY_REUSE             → 코드 버그. 즉시 고치기
  ├─ TOO_MANY_REQUESTS                 → 지수 백오프 (1s, 2s, 4s, 8s...)
  ├─ EXTERNAL_API_ERROR / CANCEL_API_FAILED / TIMEOUT → 같은 Idempotency-Key로 재시도 가능
  ├─ CIRCUIT_BREAKER_OPEN              → 재시도 금지. 대기 (10s~60s)
  └─ INTERNAL                          → Ops 에스컬레이션 (traceId·errorId 첨부)
```

### 3.4. 멱등성 (Idempotency-Key)

#### 3.4.1. 대상 엔드포인트

- `POST /api/v1/vaccount` — 가상계좌 발급
- `POST /api/v1/payment/cancel` — 취소·환불 통합 (payMethod=VACCOUNT-ISSUECAN | BANK 양쪽 다)

#### 3.4.2. 키 형식 권장

```
gift:vaccount:{orderNo}                  # 발급
gift:cancel:{orderNo}                    # 발급취소
gift:refund:{orderNo}:{yyyyMMddHHmmss}   # 환불 (같은 주문 여러 번 부분환불 시 시각 포함)
```

- **rawKey 길이 제한**: middleware 레벨에서 **256자 초과 시 400 BadRequest** (`idempotency.go:59`, 메시지 `"Idempotency-Key는 256자를 초과할 수 없습니다"`).
- **저장 컬럼 크기**: scoped 키는 `IdempotencyKeys.IdempotencyKey NVARCHAR(200)` 에 저장 (PK). 이와 함께 `CallerID NVARCHAR(100)` + `RequestHash NVARCHAR(64)` (SHA-256 hex) + `ResponseData NVARCHAR(MAX)` (마스킹된 캐시 응답 body) + `idx_caller_key` 복합 유니크 인덱스가 구성된다 — `internal/domain/idempotency.go`.
- **실효 권장 길이 (scope overhead 감안)**: `{CallerID}(max 100) : {rawKey} : {METHOD}(max 7) : {PATH}(~30) = 약 140+rawKey` 이므로 **rawKey 50자 이내** 유지가 안전.
- ASCII만 권장.
- **충돌 없는 네임스페이스**: `{상품권접두사}:{도메인}:{주문번호}`. Seedream 내부에서는 자동으로 `{CallerID}:{rawKey}:{METHOD}:{PATH}` 로 감싸 스코프를 격리하므로 상품권 사이트끼리는 충돌 불가. 하지만 상품권 사이트 **내부**에서의 충돌은 직접 책임져야 함.

#### 3.4.3. 재시도 세맨틱 (`middleware/idempotency.go` 실구현 기준)

같은 `Idempotency-Key`로 같은 엔드포인트를 다시 호출하면:

| 상황 | Seedream 응답 | 비고 |
|------|----------------|------|
| 첫 호출 성공(2xx) 후 재시도 | **원 성공 응답을 그대로 재생** + `Idempotency-Replayed: true` 헤더 | body·status code 모두 최초 응답 그대로 (민감 필드는 masking.MaskJSON 으로 마스킹되어 저장) |
| 첫 호출 실패(비-2xx) 후 재시도 | **캐시 없음 — 새로 실행** | Seedream은 비-2xx 응답을 캐시하지 않고 placeholder 를 삭제한다 |
| 첫 호출이 아직 처리 중 (5분 이내) | **409 Conflict** `"동일한 Idempotency-Key의 요청이 처리 중입니다"` | 항상 409. 예외 없음 |
| 첫 호출이 IN_PROGRESS로 5분 초과(고아) | 고아 레코드 자동 삭제 후 **새로 실행** | 워커 crash 등으로 IN_PROGRESS가 남은 케이스 복구 |
| 같은 키 + **다른 바디** | **422 `IDEMPOTENCY_KEY_REUSE`** | body sha256 해시로 비교 |
| 다른 CallerID 가 같은 rawKey 사용 | 422 `"다른 클라이언트의 Idempotency-Key입니다"` | scope 분리 원칙은 같은 CallerID 내에서만 유효 |

> **상품권 사이트 함의 1 — 실패 응답은 캐시되지 않음**: Stripe 등의 멱등 모델(실패도 재생)과 다르다. 502/503/504 등을 받고 같은 키로 재시도하면 Seedream이 **새 실행**한다. 그 중 키움 API까지 호출이 성공한 상태였다면 같은 거래가 2번 올라갈 수 있으므로, Seedream 이 키움에 보내는 `orderNo` 기반으로 키움이 중복을 차단해주는 구조에 의존(키움 `9002 DUPLICATE_ORDER` 반환). `orderNo` 는 재시도 시 절대 바꾸지 말 것.
>
> **상품권 사이트 함의 2 — 409를 정상 처리 신호로 다루지 말 것**: 409는 "동시 요청이 있음"이므로 짧은 지수 백오프(1s, 2s, 4s) 후 같은 키로 재시도하면 결국 캐시 재생(2xx) 혹은 새 실행(원 호출이 실패로 끝났을 경우) 경로에 안착한다.

#### 3.4.4. TTL

기본 24시간 (서버 config `IDEMPOTENCY_TTL=24h`). 24시간 초과 시 Seedream이 해당 키 레코드를 GC. 이후 같은 키로 재호출하면 "새 요청"으로 처리된다. 상품권 사이트가 하루를 넘긴 재시도를 하려면 새 키를 발급할 것.

#### 3.4.5. 키 생성 코드 예

```go
// IdempotencyDomain 은 발급/취소/환불 3계열을 타입으로 강제한다.
type IdempotencyDomain string

const (
    IdempotencyVAccount IdempotencyDomain = "vaccount"
    IdempotencyCancel   IdempotencyDomain = "cancel"
    IdempotencyRefund   IdempotencyDomain = "refund"
)

// MakeIdempotencyKey 는 상품권 사이트 관례의 Idempotency-Key 문자열을 생성한다.
// 환불은 동일 주문에 대해 여러 번 부분환불(또는 재시도)이 가능하므로 시각 suffix 포함.
func MakeIdempotencyKey(domain IdempotencyDomain, orderNo string) string {
    if domain == IdempotencyRefund {
        ts := time.Now().UTC().Format("20060102150405")
        return fmt.Sprintf("gift:refund:%s:%s", orderNo, ts)
    }
    return fmt.Sprintf("gift:%s:%s", domain, orderNo)
}
```

### 3.5. RESERVED 왕복 불변식

§1.2.2에서 정의한 RESERVED 3필드의 왕복 보존을 상품권 사이트가 지켜야 할 방식:

#### 3.5.1. 보내는 쪽 (요청)

```json
POST /api/v1/vaccount
{
  "reservedIndex1": "seedreamgift",
  "reservedIndex2": "partner-A7",
  "reservedString": "default"
}
```

- `reservedIndex1` 는 **상수 문자열**로 코드에 하드코딩. 환경변수로 빼지 않는다 (오타 방지).
- `reservedIndex2` 는 상품권 사이트의 **파트너 테이블 레코드에서** 동적으로 조회.
- `reservedString` 은 현재는 `"default"` 고정. 장래 용도가 확정되면 이 문서를 개정.

#### 3.5.2. 받는 쪽 (발급 응답 / GET 응답 / 웹훅)

```json
// 발급 응답 & GET /vaccount 응답
{
  "partnerId": "<CallerID>",
  "reservedIndex1": "seedreamgift",
  "reservedIndex2": "partner-A7",
  "reservedString": "default",
  "orderNo": "ORD-20260422-0001",
  "status": "PENDING",
  ...
}

// 웹훅 payload (vaccount.deposited 예시)
// 주의: 현재 웹훅 payload에는 RESERVED 3필드가 포함되지 않음 (§8.3.2).
//       상품권 사이트는 orderNo 로 자체 DB 조회해 파트너 경계를 재확인해야 한다.
{
  "eventId": "01HXYZ-uuid-...",
  "callerId": "giftsite-prod",
  "orderNo": "ORD-20260422-0001",
  "amount": 50000,
  "depositedAt": "2026-04-22T09:47:12Z"
}
```

#### 3.5.3. 검증 로직 (상품권 사이트 쪽에서 자체 방어)

```go
// 왕복 불변식 위반은 Seedream 회귀 버그이므로 sentinel error 로 분기.
var ErrReservedRoundTripViolation = errors.New("RESERVED roundtrip violated")

// ReservedFields 는 발급 응답·조회 응답·웹훅 payload 에 공통으로 내려올 수 있는
// 3개 왕복 필드의 스냅샷이다 (값이 채워진 경우에 한함).
type ReservedFields struct {
    ReservedIndex1 string
    ReservedIndex2 string
    ReservedString string
}

// AssertReservedInvariant 는 응답/이벤트 페이로드의 RESERVED 3필드가 요청 시
// 기대값과 일치하는지 검증한다. 위반 시 ErrReservedRoundTripViolation 을 %w 로 감싸
// 반환하여 호출자가 errors.Is 로 식별 가능.
func AssertReservedInvariant(expectedPartnerID string, got ReservedFields) error {
    if got.ReservedIndex1 != "seedreamgift" {
        return fmt.Errorf("%w: reservedIndex1=%q", ErrReservedRoundTripViolation, got.ReservedIndex1)
    }
    if got.ReservedIndex2 != expectedPartnerID {
        return fmt.Errorf("%w: reservedIndex2 기대=%q 실제=%q",
            ErrReservedRoundTripViolation, expectedPartnerID, got.ReservedIndex2)
    }
    if got.ReservedString != "default" {
        return fmt.Errorf("%w: reservedString=%q", ErrReservedRoundTripViolation, got.ReservedString)
    }
    return nil
}
```

불일치 발견 시 Seedream 버그다. `traceId` 포함해 즉시 에스컬레이션.

### 3.6. 레이트 리밋

| 범위 | 한도 | 구현 | 초과 시 |
|------|------|------|---------|
| IP 기반 전역 | 100 req/min | `middleware.RateLimiter("100-M")` | 429 + `Retry-After` |
| CallerID 기반 | 60 req/min | `middleware.CallerRateLimiter("60-M")` | 429 + `Retry-After` |

상품권 사이트는 **CallerID 기준 60/min** 이 실질 상한. 순간 폭주 방지를 위해 **클라이언트 측에서도** 50/min 토큰 버킷을 두는 것을 권장 (방어선).

#### 3.6.1. 응답 헤더 (모든 요청에 자동 부착)

`ulule/limiter` 기반 미들웨어가 아래 헤더를 자동 추가:

| 헤더 | 값 | 의미 |
|------|-----|------|
| `X-RateLimit-Limit` | 정수 | 현재 윈도우 한도 (예: `60`) |
| `X-RateLimit-Remaining` | 정수 | 남은 호출 수 |
| `X-RateLimit-Reset` | Unix epoch(초) | 카운터 리셋 시각 |

초과 시 추가로:

| 헤더 | 값 | 의미 |
|------|-----|------|
| `Retry-After` | 초 | **이 시간만큼 대기 후 재시도**. CallerID 리미터는 `ctx.Reset` (Unix 초) 값을 사용. IP 리미터는 `parsed.Period.Seconds()` (60초) 사용 |

상품권 사이트는 429 수신 시 `Retry-After` 값을 존중해 지수 백오프 대신 정확한 대기를 적용하면 재시도 효율이 최적.

### 3.7. 추적 헤더 (X-Trace-Id)

- Seedream이 모든 응답에 `X-Trace-Id: <uuid>` 헤더로 내려보낸다. 응답 바디의 `meta.traceId` 필드와 동일 값 (§3.2).
- 상품권 사이트가 자체 요청 식별자를 Seedream으로 **넘기고 싶다면**: 요청에 `X-Trace-Id` 헤더 세팅. Seedream이 **값을 그대로 재사용**(`middleware.RequestID`) — 형식 검증 없음, UUID 가 아니어도 통과.
- 권장: 상품권 사이트 내부 요청 ID를 그대로 넘겨서 양쪽 로그를 조인할 수 있게 할 것.
- ★ Seedream 은 `X-Trace-Id` 값에 대해 정화/길이 제한을 하지 않으므로 상품권 사이트 측에서 **자체 검증 후 전송**해야 안전. 권장 포맷: UUID v4 또는 짧은 영숫자/하이픈만. 제어 문자·줄바꿈·초장문자열 주입 방지.

---

## §4. 은행 코드 3중 체계

키움페이는 은행을 가리키는 코드를 상황별로 다르게 쓴다. Seedream은 이를 감싸지 않고 **그대로 노출**한다. 상품권 사이트가 상황을 맞춰야 한다.

| 상황 | 자릿수 | 예시 | 사용 필드 |
|------|--------|------|-----------|
| 결제창 제한 (발급 시 고객 선택지 제한) | **가변**, 콤마 구분 | `"505,11,26,20"` | `VAccountRequest.bankCode` |
| 입금 통지 (이벤트) | **2자리** | `"88"` (신한) | 웹훅 payload의 `notifyBankCode` |
| 환불/취소 API (BANK 결제수단) | **3자리 금융기관 코드** | `"088"` (신한) | `CancelPaymentRequest.bankCode` |

### 4.1. 환불(BANK) API에서 허용되는 3자리 코드

**Seedream이 화이트리스트로 강제**하는 9개만:

| 3자리 | 은행 |
|-------|------|
| `003` | 기업은행 |
| `004` | 국민은행 |
| `011` | 농협은행 |
| `020` | 우리은행 |
| `023` | SC제일은행 |
| `032` | 부산은행 |
| `071` | 우체국 |
| `081` | 하나은행 |
| `088` | 신한은행 |

그 외 코드로 환불을 보내면 `VALIDATION` 에러 (`유효하지 않은 은행코드: ...`).

> **참고**: 화이트리스트 확장은 Seedream `domain/gateway_constants.go`의 `BankCodesCancel` 맵을 수정해야 한다. 신규 은행이 필요하면 Ops에 요청.

### 4.2. 결제창 `bankCode` (발급 시 제한)

발급 시 `VAccountRequest.bankCode` 를 전달하면 고객 결제창에 해당 은행들만 노출된다. 콤마 구분 문자열(max 100자). **미전달 시 전 은행 선택 가능** — 상품권 사이트의 기본 권장치는 **미전달**(고객 선호도 존중).

### 4.3. 웹훅 payload의 은행 코드 해석

Seedream은 2자리 알림 코드를 3자리로 자동 정규화하지 않는다 — 원본 값을 그대로 전달. 상품권 사이트가 환불 시점에 재사용하려면 매핑 테이블을 자체 관리하거나 `GET /vaccount?orderNo=...` 로 3자리 값을 재조회할 것.

---

## §5. LINK 가상계좌 발급

### 5.1. 엔드포인트

```
POST /api/v1/vaccount
```

헤더:
- `X-API-Key: ...` (필수)
- `Idempotency-Key: gift:vaccount:{orderNo}` (필수)
- `Content-Type: application/json`
- `X-Trace-Id: <optional>` (권장)

### 5.2. 요청 스키마

```go
// VAccountIssueRequest 는 POST /api/v1/vaccount 요청 바디 (LINK 모드 고정).
// omitempty 는 JSON 직렬화 시 빈 값을 제거해 키움이 기본값을 적용하지 않도록 한다.
type VAccountIssueRequest struct {
    // ── 필수 ──
    OrderNo     string `json:"orderNo"`              // max 50, '|' 금지
    Amount      int64  `json:"amount"`               // 1 ~ 9,999,999,999
    ProductName string `json:"productName"`          // max 50

    // ── 고정값 (상품권 사이트) ──
    Type        string `json:"type"`                 // "P" (PC) | "M" (Mobile)
    IssueMode   string `json:"issueMode"`            // 항상 "link"
    ProductType string `json:"productType"`          // 항상 "2" (Portal 관례)
    BillType    string `json:"billType"`             // 항상 "1" (일반결제)

    // ── RESERVED 왕복 필드 (§3.5) ──
    ReservedIndex1 string `json:"reservedIndex1"`    // 항상 "seedreamgift"
    ReservedIndex2 string `json:"reservedIndex2"`    // 파트너ID (max 20)
    ReservedString string `json:"reservedString"`    // 항상 "default"

    // ── 입금만료 (30분 고정, KST) ──
    DepositEndDate string `json:"depositEndDate"`    // YYYYMMDDhhmmss (14자리)

    // ── 고객 정보 (선택) ──
    UserName string `json:"userName,omitempty"`      // max 50
    Email    string `json:"email,omitempty"`         // max 100
    UserID   string `json:"userId,omitempty"`        // max 30

    // ── 결제창 콜백 URL (선택) ──
    ReturnURL string `json:"returnUrl,omitempty"`
    HomeURL   string `json:"homeUrl,omitempty"`

    // ── 선택 (권장 X) ──
    BankCode        string `json:"bankCode,omitempty"`         // 콤마 구분 (KiwoomPay 결제창 제한용)
    ReceiverName    string `json:"receiverName,omitempty"`     // max 30
    CashReceiptFlag string `json:"cashReceiptFlag,omitempty"`  // "1" | "0"
}

// 상수는 오타 방지를 위해 코드에 하드코딩한다 (환경변수 X).
const (
    GiftReservedIndex1 = "seedreamgift"
    GiftReservedString = "default"
    GiftIssueMode      = "link"
    GiftProductType    = "2"
    GiftBillType       = "1"
)
```

#### 5.2.1. 필드 상세

**orderNo (max 50, `|` 금지 — 키움 §1.2.2)**

- 상품권 사이트가 발급 직전 생성. 전역 유일성 보장은 상품권 사이트 책임.
- 권장 포맷: `GIFT-{yyyymmdd}-{seq}` 또는 UUID 기반.
- 재시도 시 같은 orderNo + 같은 Idempotency-Key 조합이면 멱등 처리됨. 새 주문이면 새 orderNo.

**amount (gt=0, 상한은 키움 매뉴얼 §2.3.5 의 10자리 = 9,999,999,999)**

- JSON 숫자 (정수). 문자열 아님. 키움은 내부적으로 문자열로 변환해 전송.
- 콤마·소수점 불가 (통화는 원 단위 정수).
- ★ Seedream 발급 DTO(`VAccountRequest.Amount`) binding 태그는 **`required,gt=0` 만 강제하고 상한(`lte`) 검증은 없다**. 10자리 초과값을 보내면 Seedream 은 통과시키지만 키움이 `EXTERNAL_API_ERROR` 로 거부한다. 상품권 사이트가 클라이언트 사이드에서 상한을 선검증하는 것이 정상. 참고로 **취소/환불 DTO(`CancelPaymentRequest.Amount`)** 는 `lte=9999999999` 를 명시 강제한다 — 비대칭 주의.

**productName (required, max 50)**

- UTF-8 한글 허용. 결제창에 노출되므로 고객이 이해할 상품명.
- 예: `"상품권 5만원권 × 3"`, `"해피머니 10만원권"`.

**depositEndDate (14자리 YYYYMMDDhhmmss, **상품권 사이트 30분 고정**)**

- Seedream·Portal 어느 쪽의 기본값에도 **의존 금지**. (Seedream Go 서버는 `depositEndDate` 를 클라이언트 입력 그대로 키움에 전달하지만, Portal 의 `VACCOUNT_DEFAULT_EXPIRY_MINUTES` env 는 Portal Node 계층에서만 적용된다 — REST 직통 통합인 상품권 사이트엔 무관.)
- 반드시 요청 시점에 `now + 30min` 계산해 명시.
- 타임존: **KST** (키움이 한국 타임존 기준).

```go
// DepositEndDateKST30Min 은 "지금부터 30분 후" 를 KST YYYYMMDDhhmmss (14자리)
// 문자열로 반환한다. KiwoomPay 가 KST 타임존을 가정하므로 반드시 Asia/Seoul 변환.
// time.LoadLocation 은 매 호출마다 OS tzdata 를 읽지 않도록 패키지 변수로 캐시 권장.
var kstLoc = func() *time.Location {
    loc, err := time.LoadLocation("Asia/Seoul")
    if err != nil {
        // Windows 환경 등에서 tzdata 부재 시 fixed offset fallback.
        return time.FixedZone("KST", 9*60*60)
    }
    return loc
}()

func DepositEndDateKST30Min() string {
    return time.Now().In(kstLoc).Add(30 * time.Minute).Format("20060102150405")
}
```

키움 §2.3.5 제약: **현재 시각 + 3일 이내**. 30분은 충분히 여유 있음.

**type (PC "P" / 모바일 "M")**

- 상품권 사이트에서 고객 User-Agent 감지 후 분기. 데스크톱 → "P", 모바일 → "M".
- Seedream이 URL 분기: `/vaccount/DaouVaccountMng.jsp` (PC) vs `/m/vaccount/DaouVaccountMng.jsp` (모바일).

**productType / billType**

- `"2"` / `"1"` 고정 권장 (Portal 관례 동일 유지). 상품권이 "디지털"인가 "실물"인가는 해석 여지가 있지만, Portal의 VACCT 처리와 동일한 값을 유지해 회귀 위험을 줄인다.

**issueMode**

- `"link"` 또는 생략. `"api"` (즉시발급)는 **현 시점 미계약**. 사용 시도하면 키움 쪽에서 거부되거나 Seedream이 Validation으로 막는다 (향후).

### 5.3. 요청 예

```bash
# $BASE = TEST 은 https://test.seedreamapi.kr / PROD 는 https://api.seedreamapi.kr
curl -X POST "$BASE/api/v1/vaccount" \
  -H "X-API-Key: $SEEDREAM_API_KEY" \
  -H "Idempotency-Key: gift:vaccount:GIFT-20260422-00001" \
  -H "Content-Type: application/json" \
  -H "X-Trace-Id: req_01HXY..." \
  -d '{
    "orderNo": "GIFT-20260422-00001",
    "amount": 50000,
    "productName": "해피머니 5만원권",
    "type": "P",
    "issueMode": "link",
    "productType": "2",
    "billType": "1",
    "reservedIndex1": "seedreamgift",
    "reservedIndex2": "partner-A7",
    "reservedString": "default",
    "depositEndDate": "20260422180000",
    "userName": "홍길동",
    "email": "hong@example.com"
  }'
```

### 5.4. 응답 스키마

#### 5.4.1. LINK 모드 1차 응답 (전형 — 은행선택 대기)

```json
{
  "success": true,
  "data": {
    "id": 102847,
    "partnerId": "giftsite-prod",
    "reservedIndex1": "seedreamgift",
    "reservedIndex2": "partner-A7",
    "reservedString": "default",

    "orderNo": "GIFT-20260422-00001",
    "amount": 50000,

    "status": "PENDING",
    "phase": "awaiting_bank_selection",

    "targetUrl": "https://testpg.kiwoompay.co.kr/pay/DaouPayGate...",
    "formData": {
      "PAYMETHOD": "VACCT",
      "ORDERNO": "GIFT-20260422-00001",
      "TOKEN": "eyJhbGciOi...",
      "...": "..."
    },

    "depositEndDate": "20260422180000",
    "depositEndDateAt": "2026-04-22T09:00:00Z",

    "accountNumber": null,
    "bankCode": null,
    "daouTrx": null,
    "depositorName": null,

    "resultCode": "0000",
    "resultMessage": "정상",

    "createdAt": "2026-04-22T08:30:00Z",
    "updatedAt": "2026-04-22T08:30:00Z"
  }
}
```

#### 5.4.2. phase enum

| phase | 의미 | 대응 필드 |
|-------|------|-----------|
| `awaiting_bank_selection` | 고객이 아직 은행 선택 안 함 | `accountNumber=null`, `targetUrl`/`formData` 존재 |
| `awaiting_deposit` | 계좌 발급 완료, 입금 대기 | `accountNumber` 존재, `status=PENDING` |
| `completed` | 입금 확인 완료 | `status=SUCCESS` |
| `failed` | 키움 거부 또는 내부 오류 | `status=FAILED` (or `AMOUNT_MISMATCH`/`DEAD_LETTER`) |
| `cancelled` | 취소됨 | `status=CANCELLED` |
| `unknown` | 분류 불가 | 방어적 — 출현하면 Seedream 버그 |

#### 5.4.3. 리다이렉트 처리 (상품권 사이트 → 고객 브라우저)

1차 응답 받은 직후, `targetUrl` + `formData`를 **HTML auto-submit form** 으로 렌더해 고객 브라우저를 키움 은행선택 창으로 보낸다:

```html
<!DOCTYPE html>
<html>
<body>
<form id="kw" method="POST" action="{{ targetUrl }}">
  {% for key, value in formData.items() %}
  <input type="hidden" name="{{ key }}" value="{{ value }}" />
  {% endfor %}
</form>
<script>document.getElementById('kw').submit();</script>
</body>
</html>
```

주의점:

- `formData` 의 키·값은 **그대로** 전달. 재인코딩·공백 트리밍 금지.
- `formData["TOKEN"]` 은 **키움 결제창 세션 토큰** — HTML hidden input 으로 들어있던 값을 Seedream 이 그대로 중계한 것이다. Seedream 의 서버-to-서버 승인 API TOKEN(`kiwoom_approval.go` / `kiwoom_cancel.go` Step-1/Step-2) 과 같은 이름이지만 **생애 모델이 다르다**:
  - LINK 결제창 TOKEN: **1회용 브라우저 세션 토큰**. 고객이 키움 은행선택 페이지에 POST 할 때만 사용. 수명 = 결제창 유효 시간(수 분~수십 분).
  - 상품권 사이트는 이 값을 **서버 DB·로그·메트릭 어디에도 저장·기록 금지**. Go 서버가 HTML 자동 submit 페이지로 렌더하고 브라우저로만 흘려보낼 것. 이미 서버에 들어온 로그·감사 기록이 있으면 즉시 삭제 대상.
  - `Idempotency-Replayed: true` 응답으로 재생된 경우에도 TOKEN 을 **그대로 재전송**하면 키움이 거부하거나 결제창이 표시되지 않을 수 있다 → 안전 설계: "토큰 재사용은 하지 말고, 재생된 발급 응답을 받으면 새 주문으로 flow 를 재시작"하거나 Seedream 이 서명 세션 그대로 유효한지 `GET /vaccount?orderNo=` 로 `phase` 확인 후 분기.
- 나머지 키움 hidden 필드(PAYMETHOD·ORDERNO·CPID 등)도 **변환 금지**. Seedream 이 키움 HTML 을 긁어 그대로 내려준 것이라 상품권 사이트가 수정하면 서명 검증 실패 가능.
- 모바일의 경우 `type="M"` 으로 발급해야 모바일 최적화 결제창으로 연결된다.

### 5.5. 실패 모드

| 상황 | HTTP | errorCode | 대처 |
|------|------|-----------|------|
| orderNo 누락 | 400 | VALIDATION | 필수 필드 검증 |
| amount=0 또는 음수 | 400 | VALIDATION | 입력 검증 |
| productName 누락 | 400 | VALIDATION | 입력 검증 |
| API Key 만료 | 401 | UNAUTHORIZED | Ops에 키 회전 요청 |
| Idempotency-Key 재사용(다른 바디) | 422 | IDEMPOTENCY_KEY_REUSE | 코드 버그. 즉시 수정 |
| 중복 OrderNo | 409 | CONFLICT | 새 orderNo 생성 |
| 키움페이 장애 | 502 | EXTERNAL_API_ERROR | 같은 키로 재시도 |
| 서킷 브레이커 열림 | 503 | CIRCUIT_BREAKER_OPEN | 재시도 금지. 30초~1분 대기 |

### 5.6. 발급 후 고객 플로우 완결

1. 상품권 사이트가 고객 브라우저를 `targetUrl` 로 리다이렉트
2. 고객이 은행 선택 → 키움페이 서버가 Seedream `/notification/issue` 로 콜백
3. Seedream이 주문 상태를 `PENDING(accountNumber 있음)` 로 업데이트 + 상품권 사이트로 **웹훅 `vaccount.issued`** 발사 (§8)
4. 고객이 30분 내 계좌로 입금 → 키움페이가 Seedream `/notification/deposit` 콜백
5. Seedream이 주문 상태를 `SUCCESS` 로 전이 + 웹훅 `vaccount.deposited` 발사
6. 상품권 사이트는 `vaccount.deposited` 수신 시 **payload.amount 와 주문 amount 비교** 후 일치하면 상품권 지급 처리 (불일치면 §9.5 격리 경로)

---

## §6. 입금내역 조회

### 6.1. 엔드포인트

```
GET /api/v1/vaccount
```

헤더:
- `X-API-Key: ...` (필수)

**멱등 키 불필요** (idempotent GET).

### 6.2. 쿼리 파라미터

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| `from` | string (RFC3339) | 선택 | 생성일자 하한 (예: `2026-04-01T00:00:00+09:00`) |
| `to` | string (RFC3339) | 선택 | 생성일자 상한 |
| `status` | string | 선택 | **대문자 정확 매칭**. `PENDING` / `SUCCESS` / `FAILED` / `CANCELLED` / `AMOUNT_MISMATCH` / `DEAD_LETTER` 중 하나. ★ handler 는 `domain.ResultStatus(c.Query("status"))` 단순 캐스트만 수행하고 **enum 검증은 하지 않는다**. 오타·소문자(`pending`)·존재하지 않는 값 전송 시 SQL `WHERE Status = '...'` 이 그대로 실행되어 **빈 결과 `{items:[], total:0}`** 만 돌아옴 — 에러 아님. 상품권 사이트가 **클라이언트 측에서** 유효값 화이트리스트 검증 필수. |
| `orderNo` | string | 선택 | 정확 매치 (단건 조회 용도) |
| `reservedIndex1` | string | 선택 | `"seedreamgift"` 박아 조회 시 상품권 사이트 발급건만 필터 |
| `page` | int | 선택 | 1-based. 기본 1 |
| `pageSize` | int | 선택 | 기본 20, 최대 100 |

### 6.3. 예시

#### 6.3.1. 특정 주문 단건 조회

```bash
# $BASE = https://test.seedreamapi.kr (TEST) 또는 https://api.seedreamapi.kr (PROD)
curl -H "X-API-Key: $SEEDREAM_API_KEY" \
  "$BASE/api/v1/vaccount?orderNo=GIFT-20260422-00001"
```

응답: `data.items[0]` 가 해당 주문. 없으면 `data.items=[]`, `data.total=0`.

#### 6.3.2. 파트너 입금 완료 건 조회 (오늘)

```bash
curl -H "X-API-Key: $SEEDREAM_API_KEY" \
  "$BASE/api/v1/vaccount?from=2026-04-22T00:00:00%2B09:00&to=2026-04-23T00:00:00%2B09:00&status=SUCCESS&page=1&pageSize=50"
```

#### 6.3.3. 상품권 사이트 발급건만 집계

```bash
curl -H "X-API-Key: $SEEDREAM_API_KEY" \
  "$BASE/api/v1/vaccount?reservedIndex1=seedreamgift&status=SUCCESS&page=1&pageSize=100"
```

### 6.4. 응답 스키마

```go
// Envelope[T] 는 Seedream 의 표준 응답 래퍼. pkg/response.Response 와 대칭.
type Envelope[T any] struct {
    Success          bool              `json:"success"`
    Data             T                 `json:"data,omitempty"`
    Error            string            `json:"error,omitempty"`
    ErrorCode        string            `json:"errorCode,omitempty"`
    ErrorID          string            `json:"errorId,omitempty"`       // "ERR-{16 HEX}"
    ValidationErrors map[string]string `json:"validationErrors,omitempty"`
    Meta             *Meta             `json:"meta,omitempty"`
}

type Meta struct {
    TraceID    string    `json:"traceId"`
    Timestamp  time.Time `json:"timestamp"`
    APIVersion string    `json:"apiVersion,omitempty"` // "v1"
}

// ListPage 는 Seedream 페이지네이션 응답의 data 필드 (pkg/response.PaginatedData 와 동일 구조).
// ★ limit 필드명 주의 — 요청 쿼리는 pageSize 이지만 응답은 limit 으로 비대칭.
type ListPage struct {
    Items   []VAccountResult `json:"items"`
    Total   int64            `json:"total"`
    Page    int              `json:"page"`
    Limit   int              `json:"limit"`
    HasMore bool             `json:"hasMore"`
}
```

### 6.4a. Seedream `ResultStatus` 전이 규칙 (`domain/state.go`)

`GET /vaccount` 응답의 `status` 필드는 다음 6개 값 중 하나다. 상품권 사이트가 내부 DB 를 최신화할 때 전이 유효성을 검사하면 **오래된 웹훅·out-of-order 이벤트**를 안전하게 거부할 수 있다.

| from | → to | 발생 시나리오 |
|------|------|---------------|
| `PENDING` | `SUCCESS` | 정상 입금 완료 |
| `PENDING` | `FAILED` | 키움 거부 또는 입금 만료 |
| `PENDING` | `AMOUNT_MISMATCH` | 입금액 ≠ 주문액 |
| `PENDING` | `DEAD_LETTER` | 통지 처리 중 복구 불가 오류 |
| `SUCCESS` | `FAILED` | 사후 취소 실패 처리 (드묾) |
| `SUCCESS` | `CANCELLED` | **환불(BANK) 성공** |
| `AMOUNT_MISMATCH` | `FAILED` | Ops 수동 실패 처리 |

**종료 상태 (전이 불가)**: `FAILED`, `DEAD_LETTER`, `CANCELLED`. 해당 주문에 대한 후속 웹훅이 도착해도 내부 DB 는 업데이트 금지 — Seedream 측 ResultStatus 는 고정.

**상품권 사이트 내부 상태와의 매핑 (권장)**:

| Seedream `status` | Seedream `phase` | 상품권 사이트 내부 상태 |
|-------------------|------------------|-------------------------|
| `PENDING` | `awaiting_bank_selection` | `REQUESTED` |
| `PENDING` | `awaiting_deposit` | `ISSUED` |
| `SUCCESS` | `completed` | `PAID` |
| `CANCELLED` | `cancelled` | `CANCELLED`(발급취소) 또는 `REFUNDED`(BANK 환불) — 이벤트 타입으로 구분 |
| `FAILED` | `failed` | `FAILED` |
| `AMOUNT_MISMATCH` | `failed` | `AMOUNT_MISMATCH`(수동 처리) |
| `DEAD_LETTER` | `failed` | `FAILED`(Ops 에스컬레이션) |

### 6.5. 페이징 원칙

- **응답 순서**: `Id DESC` (VAccountResults 테이블 auto-increment PK 내림차순 — `repository/vaccount_result_repo.go:194`). 일상적인 상황에서는 `createdAt DESC` 와 동일한 순서지만, **배치 insert 로 `CreatedAt` 값이 동일한 행이 다수 생길 때 Id 로 tie-break** 된다는 점이 실질 차이. 클라이언트가 역정렬 하지 말 것.
- **total**: 필터 조건 하의 전체 행 수. pageSize 반영 안 됨.
- **마지막 페이지 감지**: `items.length < pageSize` 이거나 `page * pageSize >= total`.
- **커서 페이징**: 현재 미지원. 오프셋 페이징만.
- **PartnerID 필수 조건**: 서버가 인증 context 의 `PartnerID` 를 WHERE 절에 강제 주입. 누락 시 **빈 결과** 반환 (fail-safe). 정상 흐름에선 발생하지 않음.

### 6.6. 동기화 패턴

상품권 사이트 DB와 Seedream 데이터를 재동기화하고 싶을 때 (예: 웹훅 유실 복구):

```go
// Reconcile 은 since 이후 발급/갱신된 VAccountResult 를 모두 끌어와
// 상품권 사이트 내부 DB 와 동기화한다. 웹훅 유실 보완용 safety-net.
func (c *SeedreamClient) Reconcile(ctx context.Context, since time.Time, upsert func(context.Context, VAccountResult) error) error {
    const pageSize = 100
    for page := 1; ; page++ {
        q := url.Values{}
        q.Set("from", since.Format(time.RFC3339))
        q.Set("page", strconv.Itoa(page))
        q.Set("pageSize", strconv.Itoa(pageSize))

        var data ListPage
        if err := c.get(ctx, "/api/v1/vaccount?"+q.Encode(), &data); err != nil {
            return fmt.Errorf("reconcile page=%d: %w", page, err)
        }
        for _, item := range data.Items {
            if err := upsert(ctx, item); err != nil {
                return fmt.Errorf("reconcile upsert orderNo=%s: %w", item.OrderNo, err)
            }
        }
        if !data.HasMore {
            return nil
        }
    }
}
```

- **주기**: 상품권 사이트가 이용할 모든 이벤트는 **best-effort enqueue** 구조이므로(§8.0), safety net이 아니라 **1차 방어선**에 가깝다.
  - 지급형 상품권(입금 즉시 상품권 발급): **5~10분 간격** 권장. 더 짧게 잡아도 무방 (Seedream 부담 < 상품권 사이트 내부 쿼리 부담)
  - 단순 내역 확인 (지급 트리거 불요): 1시간도 무방
- **부하 고려**: 50페이지 초과 시 `from` 조건을 더 좁혀 잘라 호출.

### 6.7. Seedream 쿼리 필터 역량표

`GET /api/v1/vaccount` 가 쿼리 파라미터로 지원하는 필터 집합은 **제한적**이다. 상품권 사이트가 설계 전에 반드시 알아야 할 사실:

| 필터 조건 | Seedream 지원 | 대안 |
|-----------|--------------|-------|
| `orderNo` 정확 매치 | ✅ | — |
| `status` 정확 매치 | ✅ | — |
| `reservedIndex1` 정확 매치 | ✅ | — |
| `from` / `to` (createdAt 범위) | ✅ | — |
| 페이지네이션 (`page`/`pageSize`) | ✅ | — |
| **`reservedIndex2` 필터 (= 파트너 ID)** | ❌ **미지원** | 상품권 사이트 **내부 DB** 에서 필터 |
| 사용자 ID (`userId`) 필터 | ❌ 미지원 | 내부 DB 필터 |
| 금액 범위 필터 | ❌ 미지원 | 내부 DB 필터 |
| 예약자명/입금자명 부분일치 검색 | ❌ 미지원 | 내부 DB 필터 |
| 정렬 커스텀 (createdAt DESC 외) | ❌ 미지원 | 내부 DB 정렬 |
| 복수 status OR 검색 | ❌ 미지원 | 상태별 반복 호출 + 클라이언트 병합 |
| **동일 key 중복 전송** (HPP) | ⚠️ `middleware.HPPGuard` 가 **last-value 만 살리고 조용히 축약** — 에러 아님. `?status=PENDING&status=SUCCESS` 는 `status=SUCCESS` 로 축약되어 handler 도달. | 의도한 필터가 적용 안 됐다고 잘못 판단할 위험. 상품권 사이트가 **클라이언트 사이드에서 중복 쿼리 키를 금지**할 것 |

> **핵심 원칙**: Seedream 은 **원천 상태(source of truth)** 이지만 **조회 도구로는 빈약**하다. 상품권 사이트는 웹훅/폴링으로 **내부 DB를 미러** 로 유지하고, 모든 목록 조회는 **내부 DB에서 수행**한다. Seedream `GET /vaccount` 는 (a) 단건 최신 상태 재확인 (`orderNo` 필터) (b) Reconcile 안전망 (기간 스캔) 두 용도 전용.

### 6.8. 3계층 권한 경계별 조회 (REST 호출 레벨)

유저·파트너·어드민 세 계층은 **Seedream 관점에서 동일한 API Key + CallerID** 로 호출한다. 권한 경계는 **상품권 사이트 내부에서 SQL WHERE 로 강제**하며, Seedream 호출 파라미터는 **동일**하다.

#### 6.8.1. 유저 뷰 (본인 주문만)

**본체**: 상품권 사이트 내부 DB.

```sql
-- 내부 DB 조회 (유저 세션의 userId 로 스코프)
SELECT order_no, status, amount, created_at, ...
FROM giftcard_orders
WHERE user_id = :sessionUserId
  AND created_at >= :from
ORDER BY created_at DESC
OFFSET :offset ROWS FETCH NEXT :pageSize ROWS ONLY;
```

**Seedream 호출** (필요시만, 단건 최신화):

```http
GET /api/v1/vaccount?orderNo=GIFT-20260422-00001
```

용도: 유저가 "지금 이 주문 상태 다시 확인" 요청 시 단건 재조회. 목록 대량 조회에 쓰지 말 것.

**권한 경계 강제**: 유저 요청의 `orderNo` 가 내부 DB `WHERE user_id=:sessionUserId` 결과에 포함되는지 **사전 검증** 후에만 Seedream 호출.

#### 6.8.2. 파트너 뷰 (자기 파트너 판매분만)

**본체**: 상품권 사이트 내부 DB.

```sql
SELECT order_no, status, amount, reserved_index2 AS partner_id, ...
FROM giftcard_orders
WHERE reserved_index2 = :sessionPartnerId   -- partner 세션의 partnerId
  AND created_at >= :from
ORDER BY created_at DESC;
```

**Seedream 호출 제약**: `reservedIndex2` 필터 **미지원** (§6.7). 파트너 뷰는 **내부 DB 만으로** 완결시켜야 한다. Seedream `GET /vaccount` 를 파트너 목록 조회에 쓰는 설계는 불가능.

**권한 경계 강제**: 파트너가 단건 조회를 요청할 때 내부 DB 에서 `reserved_index2 = :sessionPartnerId` 조건으로 주문 소유 확인 후에만 Seedream 단건 호출 허용.

#### 6.8.3. 어드민 뷰 (전체)

**본체**: 상품권 사이트 내부 DB (전체). 

**Seedream 호출** (전수 재동기화/감사 용도):

```http
GET /api/v1/vaccount?reservedIndex1=seedreamgift&from=2026-04-01T00:00:00%2B09:00&page=1&pageSize=100
```

`reservedIndex1=seedreamgift` 필터로 **상품권 사이트가 발급한 건만** 격리 조회 가능 (CallerID 가 같더라도 다른 상품 라인이 있을 경우 대비).

**권한 경계 강제**: 어드민 세션 권한 확인만 필요. 주문 스코프 제약 없음.

#### 6.8.4. 3계층 공통: 내부 DB 미러 유지 규칙

어느 계층이든 **내부 DB가 본체**이므로 다음 원칙을 지킨다:

1. **모든 웹훅 이벤트**에 대해 upsert 적용 (§8.2 이벤트 전부).
2. 웹훅 수신 후 트랜잭션 내에서 내부 DB 상태 업데이트 + 파트너/유저 스코프 용 인덱스 유지.
3. Reconcile 스케줄러 (§6.6) 로 웹훅 유실 감지 → 갭 발견 시 내부 DB 보정.
4. `reservedIndex2` (파트너 ID), `userId`, `email` 등 Seedream이 필터 불가한 필드는 **발급 시점** 에 내부 DB 에 함께 저장해 두어야 사후 검색 가능.

**내부 DB 최소 스키마 권장**:

```sql
CREATE TABLE giftcard_orders (
  order_no          NVARCHAR(50)  PRIMARY KEY,
  user_id           NVARCHAR(50)  NOT NULL,
  partner_id        NVARCHAR(20)  NOT NULL,      -- = reservedIndex2
  product_name      NVARCHAR(50)  NOT NULL,
  amount            BIGINT        NOT NULL,
  status            NVARCHAR(20)  NOT NULL,       -- REQUESTED/ISSUED/PAID/CANCELLED/REFUNDED/FAILED/AMOUNT_MISMATCH
  phase             NVARCHAR(30)  NULL,
  bank_code         NVARCHAR(10)  NULL,
  account_no        NVARCHAR(50)  NULL,
  daou_trx          NVARCHAR(50)  NULL,
  deposit_end_at    DATETIME2     NULL,
  amount_mismatch_received BIGINT NULL,           -- 금액 불일치 시 실 입금액
  created_at        DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
  updated_at        DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
  -- 인덱스
  INDEX IX_user     (user_id, created_at DESC),
  INDEX IX_partner  (partner_id, created_at DESC),
  INDEX IX_status   (status, created_at DESC),
  INDEX IX_daou_trx (daou_trx) WHERE daou_trx IS NOT NULL
);

CREATE TABLE webhook_receipts (
  delivery_id       BIGINT        PRIMARY KEY,
  event             NVARCHAR(50)  NOT NULL,
  event_id          NVARCHAR(36)  NULL,           -- payload.eventId (있을 때)
  order_no          NVARCHAR(50)  NULL,
  received_at       DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
  processed_at      DATETIME2     NULL,
  INDEX IX_event_id (event_id)
);
```

---

## §7. 발급 취소 + 환불(입금후취소) — 통합

### 7.1. 왜 통합인가

키움페이의 관점에서는 "발급 취소(입금 전)" 와 "환불(입금 후)" 은 **같은 취소 API의 서로 다른 PAYMETHOD 모드**다. Seedream은 이 구조를 그대로 노출해 **단일 엔드포인트**로 통합한다:

```
POST /api/v1/payment/cancel
```

두 모드의 차이는 요청 바디의 `payMethod` 와 은행/계좌 필드 유무뿐:

| 시나리오 | payMethod | 추가 필드 |
|----------|-----------|-----------|
| 입금 전 취소 (발급만 취소) | `VACCOUNT-ISSUECAN` | 없음 |
| 입금 후 환불 (고객 계좌로 반환) | `BANK` | `bankCode` + `accountNo` (고객 환불계좌) |

> **주의**: 신규 리소스 `POST /api/v1/refunds` 가 main 브랜치에 존재하나 현재 CARD 결제 9029 에러 시나리오 전용이며 IN_DEVELOPMENT 상태다. 상품권 사이트(VACCOUNT 전용)는 **기존 `/payment/cancel`** 을 사용한다. Portal 코드의 `cancelService.js` 가 같은 방식.

### 7.2. 엔드포인트 공통

```
POST /api/v1/payment/cancel
```

헤더:
- `X-API-Key: ...` (필수)
- `Idempotency-Key: gift:cancel:{orderNo}` 또는 `gift:refund:{orderNo}:{yyyymmddhhmmss}` (필수)
- `Content-Type: application/json`

### 7.3. 요청 스키마 (공통)

```go
// CancelPayMethod 는 상품권 시나리오에서 허용되는 2개 값만 강제.
type CancelPayMethod string

const (
    CancelVAccountIssue CancelPayMethod = "VACCOUNT-ISSUECAN" // 입금 전 발급 취소
    CancelBank          CancelPayMethod = "BANK"              // 입금 후 환불
)

// CancelPaymentRequest 는 POST /api/v1/payment/cancel 요청 바디.
// service.CancelPaymentRequest (Go 서버 측 DTO) 와 필드명·타입 대칭.
type CancelPaymentRequest struct {
    PayMethod    CancelPayMethod `json:"payMethod"`
    TrxID        string          `json:"trxId"`        // VAccountResult.daouTrx, max 20자
    Amount       int64           `json:"amount"`       // 1 ~ 9,999,999,999
    CancelReason string          `json:"cancelReason"` // 5~50자 rune, ^[] 금지 (§7.3.1)

    // ── BANK 전용 ──
    BankCode  string `json:"bankCode,omitempty"`  // §4.1 9개 화이트리스트 중 하나
    AccountNo string `json:"accountNo,omitempty"` // 숫자/하이픈 6~20자

    // ── 절대 사용 금지 (VALIDATION 차단) ──
    // taxFreeAmt 화이트리스트: {CARD, CARD-BATCH, CARDK, CARDK-BATCH, KAKAOPAY,
    //   NAVERPAY, SAMSUNGPAY, APPLEPAY, FOREIGNCARD}. BANK/VACCOUNT-ISSUECAN 미포함.
    TaxFreeAmt string `json:"taxFreeAmt,omitempty"` // ★ 상품권 시나리오에선 전송 금지
}
```

#### 7.3.1. 공통 검증 (Seedream이 강제)

- `payMethod` 가 Seedream `ValidCancelPayMethods` 화이트리스트에 있어야 함.
- `trxId` (DaouTrx) 가 같은 CallerID 범위 내에 존재해야 함 (타 가맹점 주문 조작 차단).
- `amount` > 0 and ≤ 9,999,999,999 (정수).
- `cancelReason` 규칙 (`payment.ValidateCancelReason` + DTO binding 실구현):
  - **최소 5자** (DTO `binding:"required,min=5"`)
  - **전체 최대 50자** (rune 기준 — 한글 1자). 초과 시 `VALIDATION`.
  - **가맹점 데이터 부분 최대 20자** (접두/접미 제거 후 측정, 매뉴얼 §2.6)
  - **`^`, `[`, `]` 문자 금지** — 단 두 가지 예외 패턴만 허용:
    - 접두사 `[STOPREQ]...` : `payMethod=VACCOUNT-ASSIGNCAN` **전용**. 상품권 사이트 scope 밖이므로 **사용 금지**.
    - 접미사 `...^[숫자10자리이하]` : `payMethod=BANK` **복합과세 CPID 전용**. 상품권 사이트는 복합과세 CPID가 아니라 **사용 금지**.
  - 그 외 특수문자도 `cancelReasonPattern` 에 의해 차단되므로 **평문 한글/영문/숫자/공백**으로 구성할 것.

#### 7.3.2. `VACCOUNT-ISSUECAN` 전용 추가 규칙

- `cancelReason` 에 `[STOPREQ]` 접두사 쓰면 **고정식 VA** 의 `VACCOUNT-ASSIGNCAN` 으로만 유효 (키움 §2.7.8). 상품권 사이트는 Fixed VA를 쓰지 않으므로 **절대 사용 금지**.
- `bankCode` / `accountNo` 는 **전송 불필요** (전송해도 Seedream이 무시).

#### 7.3.3. `BANK` 전용 추가 규칙

- `bankCode` 필수. §4.1의 9개 중 1개.
- `accountNo` 필수. **숫자/하이픈만**, 6~20자리.
- **`taxFreeAmt` 필드는 BANK 에서 전송 불가** — `payment.taxFreeAmtAllowedPayMethods` 화이트리스트(CARD·CARD-BATCH·CARDK·CARDK-BATCH·KAKAOPAY·NAVERPAY·SAMSUNGPAY·APPLEPAY·FOREIGNCARD)에 **BANK 미포함** → VALIDATION 차단. 복합과세 분리 환불이 꼭 필요하면 `cancelReason` 에 `^[금액]` 접미사를 붙이는 방식(매뉴얼 §2.7.6) 이 따로 있으나 **이 경로는 Seedream CPID가 복합과세로 등록된 경우에만** 키움 측에서 수용한다. 상품권 사이트 CPID는 복합과세 설정이 아니므로 **두 방식 모두 사용 금지**.

### 7.4. 입금 전 취소 (`VACCOUNT-ISSUECAN`)

#### 7.4.1. 호출 조건

- 주문의 현재 `status=PENDING` + `phase=awaiting_bank_selection` 또는 `awaiting_deposit`
- 즉, 계좌는 발급됐지만 입금 전 (또는 은행 선택 전).
- `trxId` (DaouTrx) 가 세팅되어 있어야 함. `awaiting_bank_selection` 에서는 DaouTrx가 발급 안 됐을 수 있으므로 `awaiting_deposit` 이후 호출이 안전.

#### 7.4.2. 요청 예

```bash
curl -X POST "$BASE/api/v1/payment/cancel" \
  -H "X-API-Key: $SEEDREAM_API_KEY" \
  -H "Idempotency-Key: gift:cancel:GIFT-20260422-00001" \
  -H "Content-Type: application/json" \
  -d '{
    "payMethod": "VACCOUNT-ISSUECAN",
    "trxId": "T2026042210000012345",
    "amount": 50000,
    "cancelReason": "고객 요청으로 주문 취소"
  }'
```

#### 7.4.3. 응답 (성공)

> **주의**: `/payment/cancel` 의 `data` 페이로드는 **키움페이 취소 API 원본 응답** 그대로다. JSON 키가 **대문자** + `AMOUNT` 는 **string** + `CANCELDATE` 는 `YYYYMMDDhhmmss` 원본 문자열. `orderNo`/`status` 같은 편의 필드는 **없다**. 주문 상태 확정은 동기 응답보다 **웹훅 `payment.canceled`** + **`GET /vaccount?orderNo=`** 재조회로 확인.

```json
{
  "success": true,
  "data": {
    "TOKEN": "eyJhbGciOi...",
    "RESULTCODE": "0000",
    "ERRORMESSAGE": "",
    "TRXID": "T2026042210000012345",
    "AMOUNT": "50000",
    "CANCELDATE": "20260422091500"
  },
  "traceId": "b3f5c9a2-..."
}
```

판정 규칙:
- `RESULTCODE === "0000"` → 취소 성공
- 그 외 → Seedream이 이미 `apperror.ExternalAPI` 로 감싸 `success:false` 로 내려주므로 `data` 블록을 볼 일 없음. 즉 `success:true` + `data.RESULTCODE` 를 둘 다 검사하는 방어 로직은 필요하지만 실무에서 `success` 만 보면 충분.

### 7.5. 입금 후 환불 (`BANK`)

#### 7.5.1. 호출 조건

- 주문의 현재 `status=SUCCESS` + `phase=completed`
- 고객의 환불계좌 정보(`bankCode` + `accountNo`)가 필요 — 상품권 사이트가 고객으로부터 수집 후 전달.

#### 7.5.2. 요청 예

```bash
curl -X POST "$BASE/api/v1/payment/cancel" \
  -H "X-API-Key: $SEEDREAM_API_KEY" \
  -H "Idempotency-Key: gift:refund:GIFT-20260422-00001:20260422093000" \
  -H "Content-Type: application/json" \
  -d '{
    "payMethod": "BANK",
    "trxId": "T2026042210000012345",
    "amount": 50000,
    "cancelReason": "고객 변심 환불",
    "bankCode": "088",
    "accountNo": "110-123-456789"
  }'
```

#### 7.5.3. 응답 (성공)

§7.4.3 과 동일한 키움 원본 포맷. 환불(BANK)이라고 해서 페이로드 구조가 바뀌지는 않는다:

```json
{
  "success": true,
  "data": {
    "TOKEN": "eyJhbGciOi...",
    "RESULTCODE": "0000",
    "ERRORMESSAGE": "",
    "TRXID": "T2026042210000012345",
    "AMOUNT": "50000",
    "CANCELDATE": "20260422093500"
  },
  "traceId": "b3f5c9a2-..."
}
```

### 7.6. 부분취소

**지원 여부**: `VACCOUNT-ISSUECAN` + `BANK` 모두 전체취소만 지원 (매뉴얼 §3 "부분취소 가능 결제수단" 목록에 미포함 — Seedream `isPartialCancelSupported` 에서 차단).

상품권 사이트가 `amount < 원거래금액` 으로 호출 시: `400 VALIDATION` + `"VACCOUNT-ISSUECAN 결제수단은 부분취소를 지원하지 않습니다 (전체취소만 가능)"`.

### 7.7. 멱등 재시도 정책

취소/환불은 **매우 민감** (금전 이동). Seedream의 멱등 재생을 최대한 활용:

1. **동일 Idempotency-Key + 동일 바디로 재호출** → Seedream이 원 응답 재생 (2중 환불 없음).
2. **재시도 타이밍 안전 창**: 24h TTL 내 아무 때나.
3. **다른 바디로 재호출 시 422** — 코드에서 같은 키를 여러 시나리오에 쓰는 버그 발견.

### 7.8. `CANCEL_ALREADY_DONE` 의 의미

Seedream이 같은 주문에 대해 이미 성공적으로 취소 응답을 돌려준 상태에서 **다른 Idempotency-Key로** 취소를 또 시도하면:

```json
{
  "success": false,
  "errorCode": "CANCEL_ALREADY_DONE",
  "error": "이미 취소된 거래입니다"
}
```

**조치**: 멱등 응답으로 간주하고 **성공 처리** (상품권 사이트 UI에 "이미 취소 완료" 안내). 추가 API 호출 불필요.

### 7.9. 웹훅 파생

| 취소 시나리오 | 발사되는 웹훅 이벤트 |
|--------------|-----------------------|
| `VACCOUNT-ISSUECAN` 성공 (입금 전 취소) | `payment.canceled` (미국식) |
| `BANK` 성공 (입금 후 환불) | `vaccount.deposit_canceled` (미국식) |
| (**참고**) 키움/은행 자동 취소 | `vaccount.cancelled` (영국식) — 상품권 사이트 요청이 아님. §8.2.1 참조 |

웹훅 수신 시점은 Seedream 취소 API 성공 후 **수 백 밀리초 내**. 동기 응답 + 웹훅 둘 다 성공 신호로 처리하되, **주문 상태 업데이트는 웹훅 기준** 으로 하면 재시도·유실 리스크 감소.

### 7.10. 실패 매트릭스 (취소/환불 전용)

| 상황 | HTTP | errorCode | 조치 |
|------|------|-----------|------|
| cancelReason 5자 미만 | 400 | VALIDATION | 5자 이상 상수 또는 사전 검증 |
| bankCode 9개 외 (BANK) | 400 | VALIDATION | 클라이언트 사전 화이트리스트 검증 |
| accountNo 형식 위반 (BANK) | 400 | VALIDATION | 정규식 검증 (숫자/하이픈, 6~20자) |
| payMethod 대소문자 오타 | 400 | VALIDATION | Go typed string 상수(`CancelPayMethod`)로 선언 |
| trxId 못 찾음 (타 가맹점 or 존재 안 함) | 500/409 | INTERNAL/CONFLICT | 주문 재조회 후 처리 |
| 부분취소 시도 | 400 | VALIDATION | 전체취소만 사용 |
| 현재 상태로 취소 불가 | 409 | CANCEL_INVALID_STATE | `GET /vaccount?orderNo=` 로 상태 재확인 |
| 이미 취소됨 | 409 | CANCEL_ALREADY_DONE | 성공으로 간주 |
| 키움 취소 API 실패 | 502 | CANCEL_API_FAILED | 같은 키로 재시도 |
| 타임아웃 | 504 | TIMEOUT | 같은 키로 재시도 |

### 7.11. 3계층 권한 경계별 취소/환불 (REST 호출 레벨)

§6.8 과 같은 원칙: Seedream 입장에서는 세 계층 모두 동일한 API Key + 동일한 요청 바디. **권한 경계는 상품권 사이트가 호출 직전에 강제**한다.

| 계층 | 취소/환불 허용 범위 | REST 호출 전 필수 검증 |
|------|---------------------|------------------------|
| 유저 | 자기 `user_id` 의 주문 | `orders.user_id = :sessionUserId AND order_no = :orderNo` 1행 존재 확인 |
| 파트너 | 자기 `partner_id` (=`reservedIndex2`) 의 주문 | `orders.partner_id = :sessionPartnerId AND order_no = :orderNo` 1행 존재 확인 |
| 어드민 | 전체 | 어드민 세션 권한 확인만 |

**검증 실패 시**: **Seedream 호출 금지**, 상품권 사이트가 403 Forbidden 반환. Seedream에 의존하지 말 것 — Seedream은 CallerID 스코프만 막아주므로 같은 CallerID 내의 유저-파트너 교차 조작은 통과한다.

**환불 계좌 입력 원칙**:

- **유저**: 유저 본인이 환불계좌를 입력. 상품권 사이트가 세션의 `user_id` 로 소유권 확인 후 REST 호출.
- **파트너**: 파트너 관리자가 고객 계좌를 대신 입력 (고객 응대 채널에서 수집한 값). 파트너 권한 내 주문인지 반드시 내부 DB 확인.
- **어드민**: Ops가 수동 개입. 환불계좌는 Ops가 고객과 별도 채널로 수집한 값. 입력한 Ops 운영자 ID를 감사 로그에 기록.

**로깅 필수 필드** (3계층 공통):

```json
{
  "traceId": "...",
  "callerRole": "user" | "partner" | "admin",
  "callerUserId": "<상품권 사이트 내부 사용자 ID>",
  "orderNo": "...",
  "payMethod": "VACCOUNT-ISSUECAN" | "BANK",
  "amount": 50000,
  "idempotencyKey": "...",
  "seedreamErrorCode": "..." ,
  "seedreamErrorId": "..."
}
```

이 로그만 있어도 사후 감사·분쟁 처리 가능. 특히 `callerRole`·`callerUserId` 는 상품권 사이트가 **Seedream 호출 전** 찍어야 한다 (Seedream 자체는 3계층 구분을 모름).

---

## §8. 웹훅 수신 (Seedream → 상품권 사이트)

### 8.0. 전달 보장 수준 (⚠️ 구조적 사실)

Seedream 웹훅 outbox 실구현(`service/webhook_outbox_svc.go` + 호출자) 기준으로 상품권 사이트가 받는 **이벤트별 at-least-once 보장**은 다음과 같이 갈린다:

| 이벤트 | enqueue 시점 | 원자성 |
|--------|---------------|--------|
| `payment.completed` (CARD 등) | `PaymentResult` UPDATE 트랜잭션 내 (`EnqueueFromPayment` → `deliveryRepo.CreateTx(tx)`) | **at-least-once 보장** |
| `vaccount.issued` / `vaccount.deposited` / `payment.canceled` / `vaccount.deposit_canceled` / `vaccount.cancelled` / `deposit_cancel.deposited` | DB UPDATE **커밋 후** 별도 호출 (`deliveryRepo.Create(ctx)`) | **best-effort** — enqueue 실패 시 로그만 남기고 200 반환 |

실구현 주석(notification_svc.go:622):
> `outbox enqueue 실패는 로그만 — DB 트랜잭션 롤백 X (이미 키움 측 통지 처리 완료)`

**상품권 사이트 함의**:

1. 상품권 사이트가 이용할 6개 이벤트(`vaccount.*`, `payment.canceled`, `deposit_cancel.deposited`)는 **모두 best-effort**. DB 커밋과 webhook enqueue 사이의 짧은 창(수 ms) 에서 Seedream 서버가 crash 하면 이벤트가 **영구 유실**된다.
2. DLQ는 **forward 단계 실패**만 잡는다. enqueue 자체가 안 된 경우는 DLQ에도 남지 않는다.
3. 이 구조적 결함을 상품권 사이트는 §6.6 Reconcile 스케줄러로 **반드시 보완**해야 한다. 웹훅만 믿으면 돈 사고 가능.
4. Reconcile 주기는 유실 감내 가능 범위로: 지급형 상품권은 **5~10분 간격** 권장. 내역 확인 정도가 목적이면 1시간도 무방.

### 8.1. 구조

Seedream은 상품권 사이트가 사전 등록한 `WEBHOOK_URL` 로 **POST JSON** 요청을 보낸다.

```
POST {WEBHOOK_URL}
Content-Type: application/json; charset=utf-8
User-Agent: Seedream-Webhook/1.0
X-Seedream-Timestamp: 1745319845       ← Unix epoch seconds
X-Seedream-Signature: sha256=<hex>     ← HMAC-SHA256
X-Seedream-Event: vaccount.deposited
X-Seedream-Delivery-Id: 102847         ← WebhookDelivery.ID (멱등 키). 숫자형

{...payload...}
```

**성공 응답**: HTTP 2xx. 5초 타임아웃.
**실패 응답**: HTTP 5xx 또는 2xx 외. Seedream이 지수 백오프로 **최대 `Partners.MaxRetries`** 회 재시도 (기본 5, §8.6.2).

### 8.2. 이벤트 목록 (상품권 4기능 관련)

Seedream `WebhookOutboxService` 실구현 기준 (2026-04-22 main @ 1f8a584):

| 이벤트 | 발사 조건 | 주요 payload 필드 |
|--------|-----------|---------------------|
| `vaccount.requested` | 상품권 사이트가 `POST /vaccount` 를 호출한 시점 | eventId, callerId, orderNo, requestedAt |
| `vaccount.issued` | 키움 `/notification/issue` 수신 후 (계좌번호 확정) | eventId, callerId, orderNo, bankCode, accountNo, receiverName, depositEndDate, issuedAt |
| `vaccount.deposited` | 키움 `/notification/deposit` 수신 후 (입금 확인) | eventId, callerId, orderNo, amount, depositedAt, (+extra) |
| `payment.canceled` (미국식) | `POST /payment/cancel` with `VACCOUNT-ISSUECAN` 성공 시 | eventId, callerId, orderNo, reason, canceledAt |
| `vaccount.deposit_canceled` (미국식) | `POST /payment/cancel` with `BANK` 성공 시 (입금 후 환불) | eventId, callerId, orderNo, reason, canceledAt |
| `vaccount.cancelled` (영국식) | **키움/은행 자동 취소** (은행 시스템 장애 등). 가맹점 요청 취소와 의미 다름 | eventId, callerId, orderNo, daouTrx, reason, cancelledAt |
| `deposit_cancel.deposited` | 환불용 가상계좌에 실제 입금이 확인된 시점 (환불 확정) | eventId, callerId, refundDaouTrx, amount, cancelDate |

#### 8.2.1. 중요: 스펠링 주의 (canceled vs cancelled)

실구현이 **의도적으로** 다르게 사용:

- `payment.canceled`·`vaccount.deposit_canceled` — **가맹점(상품권 사이트) 요청**으로 발생한 취소. 미국식(L 하나).
- `vaccount.cancelled` — **외부 사유(키움/은행 장애)**로 자동 발생한 취소. 영국식(L 두 개).

상품권 사이트 코드에서 이벤트명 상수로 선언해 오타 방지:

```go
// EventType 은 X-Seedream-Event 헤더로 내려오는 이벤트 종류.
// 오타 방지를 위해 상수로만 비교할 것 (직접 리터럴 금지).
type EventType string

const (
    EventVAccountRequested       EventType = "vaccount.requested"
    EventVAccountIssued          EventType = "vaccount.issued"
    EventVAccountDeposited       EventType = "vaccount.deposited"
    EventPaymentCanceled         EventType = "payment.canceled"            // 미국식 L 하나 — 가맹점 요청
    EventVAccountDepositCanceled EventType = "vaccount.deposit_canceled"   // 미국식 L 하나 — BANK 환불
    EventVAccountCancelled       EventType = "vaccount.cancelled"          // 영국식 L 두 개 — 외부 자동 취소
    EventDepositCancelDeposited  EventType = "deposit_cancel.deposited"
)
```

#### 8.2.2. 웹훅이 **발사되지 않는** 시나리오

다음은 웹훅으로 오지 않는다. 상품권 사이트가 직접 감지해야 함:

| 시나리오 | 감지 방법 |
|---------|-----------|
| 입금 만료 (30분 경과해도 입금 없음) | `GET /vaccount?orderNo=...` 로 폴링 → `status=FAILED` 또는 만료 감지. 또는 자체 `depositEndDate` 타이머 |
| 입금 금액 불일치 | `GET /vaccount?orderNo=...` → `status=AMOUNT_MISMATCH`. **웹훅은 오지 않는다** — 금액 불일치 경로는 outbox enqueue 이전에 early return (`notification_svc.go:751`). §9.5 참조 |
| 키움 거부 (발급 단계 실패) | `POST /vaccount` 1차 응답이 `status=FAILED` 또는 `phase=failed` 로 바로 돌아옴 (동기). 웹훅 없음 |

상품권 사이트는 **§6 Reconcile 작업 (safety net)** 을 반드시 설치해 웹훅으로 오지 않는 상태를 주기적으로 잡아내야 한다.

### 8.3. Payload 공통 구조

Seedream 웹훅 payload는 **이벤트 타입에 따라 두 가지 형태**:

#### 8.3.1. 레거시 포맷 (`payment.completed` 전용)

```json
{
  "eventType": "payment.completed",
  "timestamp": "2026-04-22T09:47:12+09:00",
  "data": { /* PaymentResult 전체 JSON (cpid 제외) */ }
}
```

상품권 사이트는 VACCOUNT 전용이므로 `payment.completed` 는 원칙적으로 수신하지 않음. 도달 시 `eventType` 으로 감지 후 무시해도 무방.

#### 8.3.2. 신규 포맷 (나머지 7개 이벤트)

```json
{
  "eventId": "01HXYZ...",              // uuid — payload 레벨 멱등 키 (헤더 Delivery-Id와 별개)
  "callerId": "giftsite-prod",
  "orderNo": "GIFT-20260422-00001",
  "amount": 50000,
  "depositedAt": "2026-04-22T09:47:12Z",
  "...": "... 이벤트별 상세 ..."
}
```

- **최상위 래퍼 없음**: payload 자체가 곧 data. 헤더의 `X-Seedream-Event` 로 이벤트 타입 구분.
- `eventId` (uuid): payload 내부의 중복 감지용. `X-Seedream-Delivery-Id` (헤더의 WebhookDelivery.ID)와는 **별개**. 재시도는 같은 Delivery-Id로 오지만 서버가 이벤트를 재생산하는 극히 드문 케이스를 위해 eventId도 보관 권장.
- **RESERVED 필드는 현재 payload에 포함되지 않음**: 상품권 사이트는 `orderNo` 로 자체 DB를 조회해 `reservedIndex2=<파트너ID>` 권한 경계를 재확인해야 함. (향후 스펙 확장 시 payload에 추가될 수 있음 — 문서 개정 시 반영)
- 이벤트별 필드는 §8.2 표 참조.

### 8.4. 서명 검증 (필수)

Seedream은 HMAC-SHA256 서명을 실어보낸다. 검증 순서 (`pkg/webhookverify/verify.go` 실구현 기준):

1. 요청 헤더에서 `X-Seedream-Timestamp`, `X-Seedream-Signature` 추출.
2. `signed_payload = "{timestamp}.{rawBody}"` 구성. rawBody는 JSON.parse 하지 않은 **원본 바이트**.
   - 주의: `timestamp` 와 `.` 와 `body` 사이에 다른 바이트를 넣지 말 것. 공백·개행 금지.
3. `expected = hex(HMAC-SHA256(WEBHOOK_SECRET, signed_payload))`
4. 상수 시간 비교로 `"sha256=" + expected === X-Seedream-Signature` 확인.
5. `|now - timestamp| <= 600` (±10분 skew) 확인. 권장 maxAge=**10분** (`webhookverify.Verify` 주석 권장치).

#### 8.4.1. Go 구현 예

pkg/webhookverify/verify.go 의 참조 구현과 동일 로직이므로, 가능하면 이 Go 패키지를 직접 import 하는 것이 권장. 자체 구현이 필요한 경우(다른 Go 모듈에서 pkg/webhookverify 에 의존할 수 없을 때):

```go
package seedreamwh

import (
    "crypto/hmac"
    "crypto/sha256"
    "encoding/hex"
    "errors"
    "strconv"
    "strings"
    "time"
)

const DefaultMaxSkew = 10 * time.Minute // webhookverify.Verify 주석 권장치

var (
    ErrInvalidTimestamp  = errors.New("X-Seedream-Timestamp parse 실패")
    ErrTimestampSkew     = errors.New("X-Seedream-Timestamp skew 초과")
    ErrSignaturePrefix   = errors.New("X-Seedream-Signature 는 'sha256=' 접두사 필수")
    ErrSignatureMismatch = errors.New("X-Seedream-Signature HMAC 불일치")
)

// Verify 는 Seedream outbox 서명 프로토콜:
//   signed_payload = "{timestamp}.{rawBody}"
//   signature      = hex(HMAC-SHA256(secret, signed_payload))
//   header         = "sha256=" + signature
//
// 검증 실패 시 구체적 원인 error 를 반환하되 **반환 코드는 500** 으로 응답해 재시도
// 창을 유지하는 것이 권장 (§8.6.3 의 4xx 즉시 DLQ 드롭 함정 회피).
func Verify(secret string, rawBody []byte, tsHeader, sigHeader string, maxSkew time.Duration) error {
    ts, err := strconv.ParseInt(tsHeader, 10, 64)
    if err != nil {
        return ErrInvalidTimestamp
    }
    age := time.Since(time.Unix(ts, 0))
    if age < 0 {
        age = -age
    }
    if age > maxSkew {
        return ErrTimestampSkew
    }

    got, ok := strings.CutPrefix(sigHeader, "sha256=")
    if !ok {
        return ErrSignaturePrefix
    }

    mac := hmac.New(sha256.New, []byte(secret))
    mac.Write([]byte(tsHeader))
    mac.Write([]byte{'.'})
    mac.Write(rawBody)
    want := hex.EncodeToString(mac.Sum(nil))

    if !hmac.Equal([]byte(got), []byte(want)) {
        return ErrSignatureMismatch
    }
    return nil
}
```

#### 8.4.2. net/http 핸들러 예 (Go)

프레임워크 없이 표준 `net/http` 로 구현. Body 는 `io.ReadAll` 로 **한 번만** 읽어 검증과 파싱에 재사용해야 하므로 별도 버퍼링이 필요하다 (`http.Request.Body` 는 `io.Reader` 라 일회성).

```go
const maxWebhookBody = 1 << 20 // 1 MiB 안전 한도. Seedream 페이로드는 수 KB 수준.

func (s *Server) handleSeedreamWebhook(w http.ResponseWriter, r *http.Request) {
    // Body 크기 한도 + 메모리 보호.
    r.Body = http.MaxBytesReader(w, r.Body, maxWebhookBody)
    raw, err := io.ReadAll(r.Body)
    if err != nil {
        // 너무 큰 바디도 여기서 떨어진다. 500 으로 반환하면 Seedream 이 재시도.
        s.log.Warn("webhook body read failed", "err", err)
        http.Error(w, "", http.StatusInternalServerError)
        return
    }
    _ = r.Body.Close()

    // ⚠️ §8.6.3: 4xx(400/401/403/404/422) 반환 시 Seedream 이 즉시 DLQ 로 드롭한다.
    // 서명 실패·시계 skew 같은 일시적 원인을 영구 실패로 굳히지 않도록 500 반환.
    if err := seedreamwh.Verify(s.webhookSecret, raw,
        r.Header.Get("X-Seedream-Timestamp"),
        r.Header.Get("X-Seedream-Signature"),
        seedreamwh.DefaultMaxSkew,
    ); err != nil {
        s.log.Warn("seedream webhook verify failed",
            "err", err,
            "delivery", r.Header.Get("X-Seedream-Delivery-Id"),
        )
        http.Error(w, "", http.StatusInternalServerError)
        return
    }

    event := EventType(r.Header.Get("X-Seedream-Event"))
    deliveryID, err := strconv.ParseInt(r.Header.Get("X-Seedream-Delivery-Id"), 10, 64)
    if err != nil || deliveryID == 0 {
        s.log.Warn("missing/invalid X-Seedream-Delivery-Id header")
        http.Error(w, "", http.StatusInternalServerError)
        return
    }

    if err := s.dispatch(r.Context(), deliveryID, event, raw); err != nil {
        // 내부 처리 실패 — 재시도 유도.
        s.log.Error("webhook dispatch failed", "err", err, "delivery", deliveryID)
        http.Error(w, "", http.StatusInternalServerError)
        return
    }
    w.WriteHeader(http.StatusOK)
}

// 라우터 등록 예 (net/http ServeMux):
//   mux.HandleFunc("POST /webhook/seedream", srv.handleSeedreamWebhook)
```

### 8.5. 멱등 수신

`X-Seedream-Delivery-Id` 는 **이 전송 시도의 유일 ID** (`WebhookDeliveries.Id` `int64 autoIncrement` 단조 증가 BIGINT — `domain/webhook_delivery.go:19`). int64 범위(9.2E18) 라 상품권 사이트는 range 스캔이나 시간순 정렬에 그대로 활용 가능. 같은 delivery 의 재시도는 모두 동일 ID 로 오므로 수신 로그 테이블의 **PK 로** 두고, 이미 처리한 deliveryId면 no-op:

```sql
CREATE TABLE webhook_receipts (
  delivery_id BIGINT PRIMARY KEY,           -- Seedream WebhookDelivery.ID (int64)
  event NVARCHAR(50) NOT NULL,
  event_id NVARCHAR(36) NULL,               -- payload.eventId (§8.3.2)
  order_no NVARCHAR(50) NULL,
  received_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  processed_at DATETIME2 NULL,
  INDEX IX_event_id (event_id)
);
```

```go
// dispatch 는 delivery_id 를 멱등 키로 한 번만 처리하고, 이후 동일 delivery 는 no-op.
// MSSQL 에서는 unique PK 충돌로 멱등성을 얻는다 (insertIgnore 패턴).
// gorm.io/gorm 을 쓰는 경우 clause.OnConflict{DoNothing: true} 로 단일 INSERT 구현 가능.
func (s *Server) dispatch(ctx context.Context, deliveryID int64, event EventType, raw []byte) error {
    receipt := WebhookReceipt{DeliveryID: deliveryID, Event: string(event)}
    res := s.db.WithContext(ctx).
        Clauses(clause.OnConflict{DoNothing: true}).
        Create(&receipt)
    if res.Error != nil {
        return fmt.Errorf("receipt insert: %w", res.Error)
    }
    if res.RowsAffected == 0 {
        return nil // 이미 처리된 delivery — 2xx 반환
    }

    if err := s.processEvent(ctx, event, raw); err != nil {
        // 이미 receipt row 가 생성됐으므로 그대로 두면 재시도 시 멱등 no-op 가 된다.
        // 재시도를 원하면 여기서 row 를 롤백/삭제해야 함. 아래 예시는 "한 번의 처리 시도" 모델.
        return err
    }

    now := time.Now().UTC()
    return s.db.WithContext(ctx).
        Model(&WebhookReceipt{}).
        Where("delivery_id = ?", deliveryID).
        Update("processed_at", &now).Error
}
```

#### 8.5.1. 이중 중복 차단 (Seedream 측 보증)

상품권 사이트가 수신 로그만 잘 운영해도 이중 처리가 안 생기지만, Seedream 쪽에도 **독립적인 2중 방어선**이 있다:

1. `VAccountResults.DaouTrx` · `PaymentResults.DaouTrx` 에 **partial unique index** (`WHERE DaouTrx IS NOT NULL`, `domain/vaccount_result.go:36`, `domain/payment_result.go:34`). DB 레벨에서 같은 DaouTrx 삽입은 원천 봉쇄.
2. `HandleDeposit` 이 통지 진입 시 `WITH UPDLOCK, ROWLOCK + "DaouTrx = ?"` 비관적 락 조회(`notification_svc.go:700`) → 이미 처리된 DaouTrx 면 `NotifDuplicate` 반환 + 키움에 `<RESULT>SUCCESS</RESULT>` HTML 전송해 **키움 재시도 자체를 멈춤**.

따라서 상품권 사이트 입장에서 "같은 입금에 대해 vaccount.deposited 가 두 번 발사되는" 시나리오는 구조적으로 발생할 수 없다. 혹시 테스트 중 같은 이벤트를 두 번 본다면 그것은 **같은 delivery_id 의 webhook 재전송**(§8.6) 이지 실제 이벤트 중복이 아니다.

### 8.6. 재시도 정책 (실구현 `webhookforward/forwarder.go` + `backoff.go` 기준)

#### 8.6.1. 백오프 공식

```
base_delay(attempt) = 5^attempt 초   (최대 10분 cap)
actual_delay        = base_delay × (0.9 + random(0, 0.2))   ← ±20% 지터
```

| attempt | base (초) | 실측 범위 (jitter 포함) |
|---------|-----------|--------------------------|
| 1 | 5 | ~4.5s ~ 5.5s |
| 2 | 25 | ~22.5s ~ 27.5s |
| 3 | 125 (~2분) | ~113s ~ 138s |
| 4 | 625 → **cap 600** | **10분 고정** (±jitter 포함해도 cap 우선) |
| 5+ | cap 600 | 10분 고정 |

**첫 시도는 "즉시" 가 아니다** — Seedream 워커가 **5초 polling** 주기로 큐를 긁어가므로 enqueue 직후 평균 2.5초 대기가 먼저 있다.

#### 8.6.2. 최대 재시도 횟수

`Clients` 테이블의 **`MaxRetries` 컬럼** (클라이언트별 설정값)로 결정된다. "10회 고정" 같은 절대값 없음. 상품권 사이트 온보딩 시 **이 값을 Ops와 협의해 확정**하고 이 문서에 기록해둘 것:

```
TODO(integration): 상품권 사이트 Clients.MaxRetries = ___ (Ops가 DB insert 시 설정)
```

**권장치**: 6~8회. 경계 계산 — attempt 1~3 약 3분 + attempt 4~N 각 10분 → 6회 약 33분, 8회 약 53분의 재시도 창.

#### 8.6.3. 즉시 드롭되는 HTTP 응답 코드 (⚠️ 중요)

상품권 사이트가 다음 상태 코드로 응답하면 **Seedream이 재시도하지 않고 바로 DLQ로 넘긴다** (`isImmediateFailStatus`):

| 반환 코드 | Seedream 판단 | 위험 |
|-----------|---------------|------|
| **400** | "잘못된 요청 — 재시도해도 똑같이 실패" | DLQ 이관 |
| **401** | "인증 문제 — 시크릿/설정 이슈" | DLQ 이관 |
| **403** | "권한 없음" | DLQ 이관 |
| **404** | "엔드포인트 없음" | DLQ 이관 |
| **422** | "Unprocessable Entity" | DLQ 이관 |

**함정**: HMAC 서명 검증 실패 시 `401`을 반환하는 관례(Stripe 등)를 그대로 따르면, 서명 시크릿 오배포·시계 skew 같은 **일시적 장애**가 영구 실패로 굳는다. 시드림 큐에서 이미 DLQ 로 빠진 이벤트는 **Ops 수동 재큐잉** 없이 상품권 사이트가 다시 받을 방법이 없다.

**권장 정책** (상품권 사이트 웹훅 핸들러):

| 상황 | 반환할 상태 |
|------|-------------|
| 서명 검증 실패 (시크릿/시계 skew 의심) | **500** — 재시도 대상으로 남김. 내부 로그에 경고 쌓고 시크릿·시계 점검 알림 |
| 멱등 재수신(이미 처리된 deliveryId) | 200 |
| 내부 처리 성공 | 200 |
| 내부 처리 일시 실패 (DB 락 등) | 500 — 재시도 유도 |
| 페이로드 포맷이 **확정적으로** 잘못됨 (상품권 사이트가 파싱 못 하는 필드 등) | 500 로 시작해서 로그 확인 후 Ops 협의로 400 로 이관. 무작정 400 반환 금지 |

#### 8.6.4. 재시도 대상 HTTP 응답 코드

다음은 backoff 후 재시도한다:

- **5xx 전체**
- **408** Request Timeout
- **429** Too Many Requests
- 네트워크/커넥션 에러 (transport error)

#### 8.6.5. HTTP 타임아웃

Seedream 워커의 HTTP 클라이언트 timeout = **10초** (forwarder.go:42). 상품권 사이트가 10초 내 2xx 반환 못 하면 Seedream은 "retryable" 로 간주하고 다음 attempt 로 넘긴다.

**권장**: 웹훅 핸들러에서는 (a) 서명 검증 (b) deliveryId 멱등 INSERT (c) 큐 적재 까지만 동기로 수행하고 즉시 200 반환. 실제 비즈니스 처리는 비동기 워커에 위임.

#### 8.6.6. DLQ 진입 후 복구

`MaxRetries` 초과 또는 즉시 드롭 시 `DeadLetterQueue` 테이블의 `DLQJobWebhookForward` 로 이관된다. 상태는 `ManualHold`. Seedream 운영자가 Wails 관리 콘솔 또는 `POST /api/v1/admin/webhook-deliveries/{id}/redeliver` 로 수동 재큐잉하지 않는 한 상품권 사이트는 **해당 이벤트를 다시 받지 못한다**.

**상품권 사이트 자체 방어**: §6.6 Reconcile 스케줄러를 반드시 가동하여 내부 DB와 Seedream 상태를 주기 동기화. 웹훅 DLQ 유실 건은 Reconcile이 잡아낸다.

### 8.7. 이벤트 순서 보장 없음

`vaccount.issued` 가 `vaccount.deposited` 보다 **나중에** 도착할 수 있다 (유실·재전송 때문). 상품권 사이트는 이벤트를 받을 때 **주문 상태 머신의 유효 전이만 적용**:

```
유효 전이:
  (없음)     → REQUESTED  ← vaccount.requested  (optional — 자체 DB에 이미 저장된 경우 무시 가능)
  REQUESTED  → ISSUED     ← vaccount.issued
  ISSUED     → PAID       ← vaccount.deposited  (+ 금액 검증: payload.amount == 주문.amount)
  ISSUED     → CANCELLED  ← payment.canceled  (가맹점 요청 취소)
  ISSUED     → CANCELLED  ← vaccount.cancelled (외부 자동 취소)
  PAID       → REFUNDED   ← vaccount.deposit_canceled
  REFUNDED   → REFUND_PAID← deposit_cancel.deposited  (optional — 환불용 VA에 실제 입금 확인)

무효 전이 (도착해도 무시):
  CANCELLED  → PAID       ← 이미 취소됨
  REFUNDED   → PAID       ← 이미 환불됨
```

또는 `occurredAt` 이 현재 상태의 `stateChangedAt` 보다 이전이면 무시.

---

## §9. 플레이북 — 정상/비정상 경로

### 9.1. 정상: 결제 성공

```
[T+0s]    POST /vaccount (Idempotency: gift:vaccount:ORD-1)
          → 200 PENDING / awaiting_bank_selection / targetUrl
          → 고객 브라우저 리다이렉트
          → (optional) 웹훅 vaccount.requested 수신
[T+30s]   고객 은행 선택 완료
          → 웹훅 vaccount.issued 수신 → ISSUED 로 저장
[T+3m]    고객 입금 완료 (정액 입금)
          → 웹훅 vaccount.deposited 수신 → PAID 로 저장 + 상품권 발행
          ※ 금액 불일치 시엔 웹훅 자체가 오지 않는다 — §9.5 의 별도 감지 경로로 잡음
```

### 9.2. 정상: 입금 전 취소

```
[T+0s]    POST /vaccount → PENDING
[T+1m]    고객 변심 또는 상품권 사이트 admin 판단
          POST /payment/cancel { payMethod:"VACCOUNT-ISSUECAN", trxId, cancelReason }
          (Idempotency: gift:cancel:ORD-1)
          → 200 status=CANCELLED
          → 웹훅 payment.canceled 수신 → CANCELLED 로 확정
```

### 9.3. 정상: 입금 후 환불

```
[T+0s]    발급·입금 완료, status=PAID
[T+1d]    고객 환불 요청 → 환불계좌 수집
          POST /payment/cancel { payMethod:"BANK", trxId, amount, bankCode, accountNo, cancelReason }
          (Idempotency: gift:refund:ORD-1:20260423120000)
          → 200 status=CANCELLED
          → 웹훅 vaccount.deposit_canceled 수신 → REFUNDED 로 확정
[T+1d+1h] 고객 계좌로 실제 입금 확인 (키움 정산 스케줄에 따라 수 분~수 시간 편차)
          → (optional) 웹훅 deposit_cancel.deposited 수신 → REFUND_PAID 로 확정
```

### 9.4. 비정상: 입금 만료

**중요** (2중 사실):

1. Seedream 은 **입금 만료에 대해 웹훅을 전송하지 않는다**.
2. Seedream 은 **입금 만료에 대한 자동 상태 전이도 하지 않는다** — `internal/` 전체에 만료용 cron/스케줄러/expiry job 이 존재하지 않음. 그래서 `depositEndDate` 가 지나도 Seedream 의 `status` 는 **`PENDING` 그대로 유지**된다 (키움의 `/notification/cancel` 이 들어오지 않는 한).

```
[T+0s]    POST /vaccount → PENDING (depositEndDate=T+30m, depositEndDateAt 응답값)
[T+30m]   키움페이 타임아웃 → /notification/deposit 도 /notification/cancel 도 오지 않음
          (대부분 시나리오에서 키움이 별도 cancel 통지를 즉시 쏘지 않음)
[T+30m]   Seedream 상태: status=PENDING, phase=awaiting_deposit 그대로
          웹훅 이벤트 없음
[T+30m]   상품권 사이트가 **자체 타이머** 로 만료 감지 → 내부 상태를 EXPIRED 로 전이
[T+30m+1s] (선택) POST /api/v1/payment/cancel { payMethod:"VACCOUNT-ISSUECAN" } 로
           Seedream 상태도 CANCELLED 로 맞춤 — 내부 DB 정합성을 원할 때
```

권장 감지 전략:

1. **자체 타이머 우선**: 발급 응답의 `depositEndDateAt` 기준 + buffer 60초 시점에 내부 주문을 EXPIRED 처리. Seedream 폴링은 불필요(자동 전이가 없으므로 몇 분을 기다려도 status=PENDING).
2. **조기 정리**(optional): Seedream `status` 를 깔끔히 CANCELLED 로 맞추고 싶으면 `POST /payment/cancel` + `payMethod=VACCOUNT-ISSUECAN` 호출. 이 때만 `payment.canceled` 웹훅이 발사되고 Seedream 상태 전이가 일어난다.
3. **키움 자동 취소 콜백**(드물지만 존재): 은행 시스템 장애 등으로 키움이 `/notification/cancel` 을 자동으로 보내는 경우 → `vaccount.cancelled` (영국식, §8.2.1) 웹훅 수신. 이 경로는 상품권 사이트가 제어할 수 없으며, 일반적인 입금만료 시나리오에선 **발생하지 않는다**.

### 9.5. 비정상: 금액 불일치

**중요**: 금액 불일치 시 Seedream 은 **어떤 웹훅도 발사하지 않는다** (`notification_svc.go:725-752` 에서 `Status=ResultAmountMismatch` 로 DB 업데이트 후 **즉시 `return nil`** — webhook outbox enqueue 블록에 도달하지 않음).

따라서 **상품권 사이트가 `vaccount.deposited` 페이로드로 금액 비교 가능하다는 기대는 틀리다**. 처음 설계에 그 분기가 들어있으면 영원히 실행되지 않는 죽은 코드가 된다.

```
[T+0s]    POST /vaccount amount=50000 → PENDING
[T+5m]    고객이 30000원만 입금
          → 키움 /notification/deposit (amount=30000)
          → Seedream 이 내부적으로 status=AMOUNT_MISMATCH 로 저장
          → 웹훅 이벤트 발사 안 됨 (outbox enqueue skip)
          → 상품권 사이트는 기다려도 알림 없음
[T+5m~]   상품권 사이트가 발급 응답의 depositEndDateAt + buffer 시점에
          GET /api/v1/vaccount?orderNo=... 폴링 → status=AMOUNT_MISMATCH 감지
          → 자체 DB 에 AMOUNT_MISMATCH 기록 + 상품권 지급 중지 + Ops 알림
```

**감지 방법 (3가지 중 선택)**:

1. **§6.6 Reconcile 스케줄러**에 `status=AMOUNT_MISMATCH` 감지 로직 추가 (권장 — 이미 운영 중인 safety net 에 얹는 형태).
2. `depositEndDateAt` 타이머 만료 시 해당 주문 단건 `GET /vaccount?orderNo=` 조회 후 status 판단 (만료 감지와 같은 경로에서 처리).
3. Seedream Ops 가 `/api/v1/admin/metrics` 나 `AuditLogs` 모니터링에서 AMOUNT_MISMATCH 알림 설정 후 통보 — 실시간성 낮음.

**조치**:
- 절대 `POST /payment/cancel` with `BANK` 로 환불 호출하지 말 것 — **부분환불 비지원 + 금액 불일치 상태에선 키움이 9001 오류 반환 가능**.
- Ops 수동 개입 + 고객 응대 채널(전화/이메일)로 별도 처리.
- 내부 DB 의 AMOUNT_MISMATCH 상태는 Ops 해결 전까지 그대로 유지 (자동 재시도 금지).

### 9.6. 비정상: 웹훅 유실

```
[T+0s]    발급·입금 완료, Seedream은 성공 인지
          그러나 상품권 사이트 /webhook/seedream 엔드포인트 장애 → MaxRetries 재시도 모두 실패
[T+1h]    상품권 사이트 복구
[T+1h]    safety-net reconcile 작업:
          GET /vaccount?from={lastSync}&status=SUCCESS → 미반영 주문 발견 → 상태 업데이트

권장:
- Ops에 요청해 특정 delivery 재전송 (`POST /api/v1/admin/webhook-deliveries/{id}/redeliver` — admin 전용)
- 또는 매 10~60분 주기의 reconcile 작업으로 safety net 구축
```

### 9.7. 비정상: 키움 장애 (서킷 브레이커 열림)

```
[T+0s]    POST /vaccount → 503 CIRCUIT_BREAKER_OPEN
조치:
  1. 즉시 재시도 금지 (서킷이 몇 초 내 절반 열림 상태로 복귀 시도)
  2. 30초~1분 대기 후 재시도
  3. 반복 실패 시 Ops 에스컬레이션 (키움 장애 확률 높음)
```

### 9.8. 비정상: Idempotency 재사용 버그

```
증상: 첫 시도 후 같은 키로 완전히 다른 주문(새 amount·orderNo)을 보냈을 때
응답: 422 IDEMPOTENCY_KEY_REUSE
조치: 키 생성 로직 즉시 수정. 같은 키는 "같은 의도의 재시도" 로만 쓰기.
```

### 9.9. 비정상: RESERVED 오염 (서버 버그)

```
증상: 발급 응답의 reservedIndex1 != "seedreamgift"
조치:
  1. 상품권 사이트 자체 검증 (§3.5.3) 에서 즉시 throw
  2. 해당 orderNo + traceId 를 Ops에 보고
  3. 이 오염은 Seedream 회귀 버그 → 상품권 사이트는 해당 주문만 격리, 나머진 정상 진행
```

---

## §10. 관찰가능성

### 10.1. 상품권 사이트가 로깅해야 할 것

| 필드 | 용도 |
|------|------|
| `traceId` (자체) + `x-trace-id` (Seedream) | 양측 로그 조인 |
| `orderNo` | 모든 로그 라인에 박기 |
| `idempotencyKey` | 재시도 추적 |
| `errorCode` + `errorId` (응답) | Ops 문의용 |
| 응답 시간 (ms) | 레이턴시 SLI |

로깅 금지:
- `X-API-Key` 헤더 원본 (마스킹 필수)
- 요청 바디의 `formData` 전체 (TOKEN 포함)
- 고객 계좌번호 (`accountNo`) — 마스킹: 앞2자리 + `****` + 뒤2자리

### 10.1a. Seedream 서버 메트릭 (Ops 협의 참고)

Seedream 자체도 프로세스 내부 카운터를 유지한다 (`internal/monitor/`). 대표:

- `webhookEnqueued` / `webhookDelivered` / `webhookFailed` / `webhookSignatureMismatch`
- 요청 경로별 카운트·지연 (`RecordRequestMiddleware`)
- 리셀러 경계 지표 (`callerIDMissing`, `reservedRoundTripLoss` 등 — 문서 §1.2.2 참조)

이 값들은 `GET /api/v1/admin/metrics` 로 노출되지만 **JWT + role=admin** 이 필수 (`middleware.JWTAuthMultiKey` + `adminOnly()`). 상품권 사이트의 X-API-Key 로는 접근 불가. 장애 조사 시 Seedream Ops 에 메트릭 덤프를 요청하는 경로로 활용하라.

### 10.2. 메트릭 권장

- `seedream.request.count{endpoint, status}` — 호출 횟수
- `seedream.request.latency{endpoint, p50/p95/p99}` — 지연
- `seedream.error.count{errorCode}` — 에러 분포
- `webhook.received.count{event}` — 웹훅 수신 빈도
- `webhook.signature.invalid.count` — 서명 실패 수 (보안 지표)
- `webhook.processing.duration{event, p50/p95}` — 처리 시간

### 10.3. 알림 임계값 (권장)

- `CIRCUIT_BREAKER_OPEN` 발생 → 1건도 알림
- `IDEMPOTENCY_KEY_REUSE` → 1건도 알림 (코드 버그)
- `webhook.signature.invalid.count > 0 in 5m` → 보안 알림
- `reconcile 에서 웹훅 유실 발견` → 1건도 알림
- 5xx 응답률 > 1% in 5m → 알림

### 10.4. Ops 문의 프로토콜

다음 정보를 첨부하면 Ops가 1분 내 원인 파악:

```
orderNo: GIFT-20260422-00001
traceId: b3f5c9a2-xxxx
errorId: ERR-A3F21B9E8C7D1234
errorCode: CANCEL_API_FAILED
발생시각: 2026-04-22T09:47:12Z
재현 방법: POST /api/v1/payment/cancel { ... }
```

---

## §11. 구현 체크리스트

### 11.1. 환경·시크릿

- [ ] `SEEDREAM_API_BASE` 환경변수 설정 (TEST=`https://test.seedreamapi.kr` / PROD=`https://api.seedreamapi.kr`)
- [ ] `SEEDREAM_API_KEY` 환경변수 설정 (시크릿 매니저)
- [ ] `SEEDREAM_WEBHOOK_SECRET` 환경변수 설정
- [ ] 로그에 시크릿 노출 없음 확인 (`X-API-Key`, `TOKEN`, `formData`, 계좌번호)

### 11.2. HTTP 클라이언트

- [ ] 모든 `/api/v1/*` 호출에 `X-API-Key` 헤더 자동 추가
- [ ] 멱등 필요 엔드포인트에 `Idempotency-Key` 필수화 (컴파일 타임 타입 강제 권장)
- [ ] `X-Trace-Id` 전파
- [ ] Keep-Alive 커넥션 풀
- [ ] 타임아웃 설정: connect 3s, read 10s (취소/환불은 15s)

### 11.3. 발급 (§5)

- [ ] `reservedIndex1="seedreamgift"` 상수 박음
- [ ] `reservedIndex2` 가 현재 파트너 ID와 일치 (주문 저장 시 검증)
- [ ] `reservedString="default"` 상수
- [ ] `depositEndDate` 계산이 KST + 30분
- [ ] 응답 `phase=awaiting_bank_selection` 분기로 `targetUrl`+`formData` auto-submit
- [ ] RESERVED 왕복 검증 (§3.5.3)

### 11.4. 조회 (§6)

- [ ] 페이징 루프: `page * pageSize >= total` 루프 종료
- [ ] `from`/`to` 는 RFC3339 (타임존 포함) 로 전송
- [ ] Reconcile 스케줄러 (safety net, 1시간~1일 1회)
- [ ] **내부 DB 가 본체**: 모든 웹훅 이벤트에서 upsert (§6.7, §6.8.4)
- [ ] 유저 조회: 내부 DB `WHERE user_id = :sessionUserId` 필터 (Seedream 호출은 단건 최신화만)
- [ ] 파트너 조회: 내부 DB `WHERE partner_id = :sessionPartnerId` 필터 (Seedream `reservedIndex2` 필터 **미지원** — 내부 DB 전용)
- [ ] 어드민 조회: 전체. Seedream 재동기화 시 `reservedIndex1=seedreamgift` 필터 사용
- [ ] 단건 Seedream 조회 전 내부 DB 로 소유권 사전 검증 (유저·파트너)

### 11.5. 취소/환불 (§7)

- [ ] `payMethod` 상수(`VACCOUNT-ISSUECAN` / `BANK`) 로만 구성
- [ ] BANK 호출 시 `bankCode` 화이트리스트 클라이언트 검증
- [ ] `accountNo` 형식 검증 (숫자/하이픈, 6~20자)
- [ ] `cancelReason` 5자 이상 + 특수문자 검증
- [ ] 부분취소 **미사용** (전체취소만)
- [ ] `CANCEL_ALREADY_DONE` 성공 처리
- [ ] Idempotency 키: 발급취소는 orderNo만, 환불은 orderNo+timestamp
- [ ] **권한 경계 사전 검증** (§7.11): Seedream 호출 전 내부 DB 소유권 확인. 실패 시 Seedream 호출 없이 403
- [ ] 감사 로그에 `callerRole` / `callerUserId` 기록 (§7.11)

### 11.6. 웹훅 (§8)

- [ ] `io.ReadAll(r.Body)` 으로 rawBody 를 한 번 읽어 HMAC 검증 + JSON 파싱에 재사용 (§8.4.2)
- [ ] HMAC-SHA256 검증 (±600s skew, webhookverify.Verify 권장)
- [ ] `timingSafeEqual` 로 상수 시간 비교
- [ ] `X-Seedream-Delivery-Id` 로 멱등 처리 (DB PK)
- [ ] **검증 실패 시 4xx 반환 금지 — 500 반환으로 Seedream 재시도 창 유지** (§8.6.3)
- [ ] 10초 이내 2xx 반환 (§8.6.5). 비즈니스 처리는 비동기 워커 위임
- [ ] `Clients.MaxRetries` 값 Ops로부터 수령 · 문서화
- [ ] Reconcile 스케줄러 가동(§6.6) — DLQ 유실 대비
- [ ] 이벤트 순서 무관 상태머신
- [ ] 5xx 반환 시 재시도 가능 / 2xx 는 확정 처리 완료

### 11.7. 관찰가능성 (§10)

- [ ] `traceId` 양측 조인
- [ ] `errorId`·`errorCode` 항상 기록
- [ ] 시크릿 마스킹
- [ ] 임계값 알림 설정

---

## 부록 A. 에러 코드 전체 목록

Seedream `pkg/apperror/apperror.go` 정의 기준. **상품권 4기능에서 발생 가능**한 16개를 굵게 표기.

| Code | HTTP | 의미 | 상품권 해당 |
|------|------|------|-------------|
| **NOT_FOUND** | 404 | 리소스 없음 | ● |
| **VALIDATION** | 400 | 요청 검증 실패 | ● |
| **UNAUTHORIZED** | 401 | 인증 실패 | ● |
| **FORBIDDEN** | 403 | 권한 부족 | ● |
| **CONFLICT** | 409 | 일반 상태 충돌 | ● |
| **INTERNAL** | 500 | 서버 내부 오류 | ● |
| **TOO_MANY_REQUESTS** | 429 | 레이트 리밋 초과 | ● |
| **IDEMPOTENCY_KEY_REUSE** | 422 | 멱등 키 재사용 | ● |
| **EXTERNAL_API_ERROR** | 502 | 외부 API(키움) 실패 | ● |
| **CIRCUIT_BREAKER_OPEN** | 503 | 서킷 브레이커 열림 | ● |
| **INVALID_STATE_TRANSITION** | 409 | 상태머신 전이 위반 | ● |
| **TIMEOUT** | 504 | 업스트림 타임아웃 | ● |
| **CANCEL_INVALID_STATE** | 409 | SUCCESS 외 취소 시도 | ● |
| **CANCEL_ALREADY_DONE** | 409 | 이미 취소됨 | ● |
| **CANCEL_API_FAILED** | 502 | 키움 취소 API 실패 | ● |
| **CANCEL_REASON_EMPTY** | 400 | 취소 사유 미입력 | ● |
| SETTLEMENT_NO_DATA | 404 | 정산 데이터 없음 | — |
| SETTLEMENT_FEE_MISSING | 200 | 수수료 미설정 | — |
| ALERT_RULE_INVALID | 400 | 알림 룰 오류 | — |
| ALERT_WEBHOOK_FAILED | 502 | 알림 웹훅 실패 | — |
| REPORT_ALREADY_EXISTS | 200 | 리포트 중복 생성 | — |
| REPORT_GEN_FAILED | 500 | 리포트 생성 실패 | — |
| ALLOCATION_REVOKED | 410 | 고정식 VA 회수됨 | — (Fixed VA 미사용) |

---

## 부록 B. cURL 예제 모음

### B.1. 발급

```bash
curl -X POST "$BASE/api/v1/vaccount" \
  -H "X-API-Key: $KEY" \
  -H "Idempotency-Key: gift:vaccount:GIFT-20260422-00001" \
  -H "Content-Type: application/json" \
  -d '{
    "orderNo": "GIFT-20260422-00001",
    "amount": 50000,
    "productName": "해피머니 5만원권",
    "type": "P",
    "issueMode": "link",
    "productType": "2",
    "billType": "1",
    "reservedIndex1": "seedreamgift",
    "reservedIndex2": "partner-A7",
    "reservedString": "default",
    "depositEndDate": "20260422180000"
  }'
```

### B.2. 단건 조회

```bash
curl -G "$BASE/api/v1/vaccount" \
  -H "X-API-Key: $KEY" \
  --data-urlencode "orderNo=GIFT-20260422-00001"
```

### B.3. 기간 조회 (성공건)

```bash
curl -G "$BASE/api/v1/vaccount" \
  -H "X-API-Key: $KEY" \
  --data-urlencode "from=2026-04-22T00:00:00+09:00" \
  --data-urlencode "to=2026-04-23T00:00:00+09:00" \
  --data-urlencode "status=SUCCESS" \
  --data-urlencode "page=1" \
  --data-urlencode "pageSize=50"
```

### B.4. 입금 전 취소

```bash
curl -X POST "$BASE/api/v1/payment/cancel" \
  -H "X-API-Key: $KEY" \
  -H "Idempotency-Key: gift:cancel:GIFT-20260422-00001" \
  -H "Content-Type: application/json" \
  -d '{
    "payMethod": "VACCOUNT-ISSUECAN",
    "trxId": "T2026042210000012345",
    "amount": 50000,
    "cancelReason": "고객 요청으로 주문 취소"
  }'
```

### B.5. 입금 후 환불

```bash
curl -X POST "$BASE/api/v1/payment/cancel" \
  -H "X-API-Key: $KEY" \
  -H "Idempotency-Key: gift:refund:GIFT-20260422-00001:20260422093000" \
  -H "Content-Type: application/json" \
  -d '{
    "payMethod": "BANK",
    "trxId": "T2026042210000012345",
    "amount": 50000,
    "cancelReason": "고객 변심 환불",
    "bankCode": "088",
    "accountNo": "110-123-456789"
  }'
```

---

## 부록 C. Go 클라이언트 스켈레톤

> 아래 예제는 상품권 사이트(`seedreamgift`) 가 **Go REST 클라이언트**로 Seedream 을 호출할 때 그대로 반영 가능한 최소 스켈레톤이다. 표준 라이브러리(`net/http`, `encoding/json`, `crypto/hmac`) 중심, ORM 은 gorm 을 가정(상품권 사이트 DB 가 MSSQL 이라는 전제).

### C.1. 타입 정의

```go
// Package seedream 은 Seedream API 클라이언트 + 웹훅 검증 유틸을 제공한다.
package seedream

import "time"

const (
    ReservedIndex1 = "seedreamgift"
    ReservedString = "default"
    IssueMode      = "link"
    ProductType    = "2"
    BillType       = "1"
)

// ResultStatus 는 VAccountResult.status 값의 enum.
type ResultStatus string

const (
    StatusPending        ResultStatus = "PENDING"
    StatusSuccess        ResultStatus = "SUCCESS"
    StatusFailed         ResultStatus = "FAILED"
    StatusCancelled      ResultStatus = "CANCELLED"
    StatusAmountMismatch ResultStatus = "AMOUNT_MISMATCH"
    StatusDeadLetter     ResultStatus = "DEAD_LETTER"
)

// Phase 는 MarshalJSON 이 주입하는 의미적 phase (§5.4.2).
type Phase string

const (
    PhaseAwaitingBankSelection Phase = "awaiting_bank_selection"
    PhaseAwaitingDeposit       Phase = "awaiting_deposit"
    PhaseCompleted             Phase = "completed"
    PhaseFailed                Phase = "failed"
    PhaseCancelled             Phase = "cancelled"
    PhaseUnknown               Phase = "unknown"
)

// VAccountIssueParams 는 상품권 사이트가 클라이언트에게 넘기는 고수준 파라미터.
// 나머지 RESERVED/issueMode/productType 등은 SeedreamClient 가 내부에서 고정값으로 채운다.
type VAccountIssueParams struct {
    OrderNo     string
    Amount      int64
    ProductName string
    PartnerID   string // = reservedIndex2
    Type        string // "P" | "M"
    UserName    string
    Email       string
    UserID      string
    ReturnURL   string
    HomeURL     string
}

// VAccountResult 는 POST /api/v1/vaccount 응답 data 와 GET /api/v1/vaccount 목록의 items 요소.
// MarshalJSON 주입 필드(phase, depositEndDateAt, targetUrl, formData) 까지 포함한 합동 구조.
type VAccountResult struct {
    ID             int64        `json:"id"`
    PartnerID      string       `json:"partnerId"`
    ReservedIndex1 string       `json:"reservedIndex1,omitempty"`
    ReservedIndex2 string       `json:"reservedIndex2,omitempty"`
    ReservedString string       `json:"reservedString,omitempty"`
    OrderNo        string       `json:"orderNo"`
    Amount         int64        `json:"amount"`
    Status         ResultStatus `json:"status"`
    Phase          Phase        `json:"phase"`

    TargetURL string            `json:"targetUrl,omitempty"`
    FormData  map[string]string `json:"formData,omitempty"`

    AccountNumber     *string `json:"accountNumber,omitempty"`
    AccountHolder     *string `json:"accountHolder,omitempty"`
    BankCode          *string `json:"bankCode,omitempty"`
    DepositBankCode   *string `json:"depositBankCode,omitempty"`
    DaouTrx           *string `json:"daouTrx,omitempty"`
    DepositEndDate    *string `json:"depositEndDate,omitempty"`     // YYYYMMDDhhmmss
    DepositEndDateAt  *time.Time `json:"depositEndDateAt,omitempty"`// RFC3339
    DepositorName     *string `json:"depositorName,omitempty"`
    WillDepositorName *string `json:"willDepositorName,omitempty"`

    ResultCode    *string `json:"resultCode,omitempty"`
    ResultMessage *string `json:"resultMessage,omitempty"`

    CreatedAt time.Time `json:"createdAt"`
    UpdatedAt time.Time `json:"updatedAt"`
}

// CancelResponse 는 POST /api/v1/payment/cancel 응답 data — 키움 원본 대문자 필드 그대로.
// §7.4.3 참조. AMOUNT 는 string, CANCELDATE 는 YYYYMMDDhhmmss.
type CancelResponse struct {
    Token        string `json:"TOKEN"`
    ResultCode   string `json:"RESULTCODE"`
    ErrorMessage string `json:"ERRORMESSAGE"`
    TrxID        string `json:"TRXID"`
    Amount       string `json:"AMOUNT"`
    CancelDate   string `json:"CANCELDATE"`
}

// Error 는 SeedreamClient 가 !body.Success 응답을 감싸 반환하는 에러.
type Error struct {
    HTTPStatus       int
    Code             string            // "VALIDATION", "EXTERNAL_API_ERROR", ...
    Message          string
    ErrorID          string            // "ERR-{16 HEX}"
    ValidationErrors map[string]string
    TraceID          string
}

func (e *Error) Error() string {
    if e.Code != "" {
        return e.Code + ": " + e.Message
    }
    return e.Message
}
```

### C.2. 클라이언트

```go
// client.go
package seedream

import (
    "bytes"
    "context"
    "encoding/json"
    "fmt"
    "io"
    "net/http"
    "net/url"
    "strconv"
    "time"
)

// Client 는 Seedream REST API 호출용 Go 클라이언트.
// baseURL: https://test.seedreamapi.kr 또는 https://api.seedreamapi.kr (§2.1)
type Client struct {
    baseURL string
    apiKey  string
    http    *http.Client
    kst     *time.Location
}

// ClientOption 은 functional options 패턴 (go-functional-options).
type ClientOption func(*Client)

func WithHTTPClient(h *http.Client) ClientOption { return func(c *Client) { c.http = h } }
func WithTimeout(d time.Duration) ClientOption {
    return func(c *Client) { c.http = &http.Client{Timeout: d} }
}

func NewClient(baseURL, apiKey string, opts ...ClientOption) *Client {
    kst, err := time.LoadLocation("Asia/Seoul")
    if err != nil {
        kst = time.FixedZone("KST", 9*60*60)
    }
    c := &Client{
        baseURL: baseURL,
        apiKey:  apiKey,
        http:    &http.Client{Timeout: 15 * time.Second}, // 취소/환불 여유
        kst:     kst,
    }
    for _, opt := range opts {
        opt(c)
    }
    return c
}

type callOpts struct {
    body           any
    idempotencyKey string
    traceID        string
}

func (c *Client) call(ctx context.Context, method, path string, out any, opts callOpts) error {
    var bodyReader io.Reader
    if opts.body != nil {
        buf, err := json.Marshal(opts.body)
        if err != nil {
            return fmt.Errorf("marshal body: %w", err)
        }
        bodyReader = bytes.NewReader(buf)
    }
    req, err := http.NewRequestWithContext(ctx, method, c.baseURL+path, bodyReader)
    if err != nil {
        return err
    }
    req.Header.Set("X-API-Key", c.apiKey)
    req.Header.Set("Accept", "application/json")
    if opts.body != nil {
        req.Header.Set("Content-Type", "application/json")
    }
    if opts.idempotencyKey != "" {
        req.Header.Set("Idempotency-Key", opts.idempotencyKey)
    }
    if opts.traceID != "" {
        req.Header.Set("X-Trace-Id", opts.traceID)
    }

    resp, err := c.http.Do(req)
    if err != nil {
        return fmt.Errorf("http do: %w", err)
    }
    defer resp.Body.Close()

    raw, err := io.ReadAll(resp.Body)
    if err != nil {
        return fmt.Errorf("read body: %w", err)
    }

    // Seedream envelope 파싱 — success=false 분기 → *Error 반환.
    var env struct {
        Success          bool              `json:"success"`
        Data             json.RawMessage   `json:"data"`
        Error            string            `json:"error"`
        ErrorCode        string            `json:"errorCode"`
        ErrorID          string            `json:"errorId"`
        ValidationErrors map[string]string `json:"validationErrors"`
        Meta             *struct {
            TraceID string `json:"traceId"`
        } `json:"meta"`
    }
    if err := json.Unmarshal(raw, &env); err != nil {
        return fmt.Errorf("unmarshal envelope (status=%d): %w", resp.StatusCode, err)
    }
    if !env.Success {
        traceID := ""
        if env.Meta != nil {
            traceID = env.Meta.TraceID
        }
        return &Error{
            HTTPStatus:       resp.StatusCode,
            Code:             env.ErrorCode,
            Message:          env.Error,
            ErrorID:          env.ErrorID,
            ValidationErrors: env.ValidationErrors,
            TraceID:          traceID,
        }
    }
    if out != nil && len(env.Data) > 0 {
        if err := json.Unmarshal(env.Data, out); err != nil {
            return fmt.Errorf("unmarshal data: %w", err)
        }
    }
    return nil
}

func (c *Client) IssueVAccount(ctx context.Context, p VAccountIssueParams) (*VAccountResult, error) {
    body := map[string]any{
        "orderNo":        p.OrderNo,
        "amount":         p.Amount,
        "productName":    p.ProductName,
        "type":           p.Type,
        "issueMode":      IssueMode,
        "productType":    ProductType,
        "billType":       BillType,
        "reservedIndex1": ReservedIndex1,
        "reservedIndex2": p.PartnerID,
        "reservedString": ReservedString,
        "depositEndDate": c.depositEndDateKST30Min(),
    }
    // 선택 필드는 비어있지 않을 때만 포함 (omitempty 효과).
    if p.UserName != "" {
        body["userName"] = p.UserName
    }
    if p.Email != "" {
        body["email"] = p.Email
    }
    if p.UserID != "" {
        body["userId"] = p.UserID
    }
    if p.ReturnURL != "" {
        body["returnUrl"] = p.ReturnURL
    }
    if p.HomeURL != "" {
        body["homeUrl"] = p.HomeURL
    }

    var result VAccountResult
    err := c.call(ctx, http.MethodPost, "/api/v1/vaccount", &result, callOpts{
        body:           body,
        idempotencyKey: fmt.Sprintf("gift:vaccount:%s", p.OrderNo),
    })
    return &result, err
}

// FindByOrderNo 는 단건 조회. 없으면 (nil, nil).
func (c *Client) FindByOrderNo(ctx context.Context, orderNo string) (*VAccountResult, error) {
    q := url.Values{"orderNo": []string{orderNo}}
    var page ListPage
    if err := c.call(ctx, http.MethodGet, "/api/v1/vaccount?"+q.Encode(), &page, callOpts{}); err != nil {
        return nil, err
    }
    if len(page.Items) == 0 {
        return nil, nil
    }
    return &page.Items[0], nil
}

func (c *Client) CancelIssued(ctx context.Context, orderNo, trxID string, amount int64, reason string) (*CancelResponse, error) {
    var out CancelResponse
    err := c.call(ctx, http.MethodPost, "/api/v1/payment/cancel", &out, callOpts{
        idempotencyKey: fmt.Sprintf("gift:cancel:%s", orderNo),
        body: CancelPaymentRequest{
            PayMethod:    CancelVAccountIssue,
            TrxID:        trxID,
            Amount:       amount,
            CancelReason: reason,
        },
    })
    return &out, err
}

func (c *Client) RefundDeposited(ctx context.Context, orderNo, trxID string, amount int64, reason, bankCode, accountNo string) (*CancelResponse, error) {
    ts := time.Now().UTC().Format("20060102150405")
    var out CancelResponse
    err := c.call(ctx, http.MethodPost, "/api/v1/payment/cancel", &out, callOpts{
        idempotencyKey: fmt.Sprintf("gift:refund:%s:%s", orderNo, ts),
        body: CancelPaymentRequest{
            PayMethod:    CancelBank,
            TrxID:        trxID,
            Amount:       amount,
            CancelReason: reason,
            BankCode:     bankCode,
            AccountNo:    accountNo,
        },
    })
    return &out, err
}

// get 은 Reconcile 등 내부 GET 호출용 (export 하지 않음).
func (c *Client) get(ctx context.Context, path string, out any) error {
    return c.call(ctx, http.MethodGet, path, out, callOpts{})
}

func (c *Client) depositEndDateKST30Min() string {
    return time.Now().In(c.kst).Add(30 * time.Minute).Format("20060102150405")
}

// 표준 strconv import 는 ListPage 에서 간접 사용되므로 유지.
var _ = strconv.Itoa
```

### C.3. 웹훅 검증 헬퍼

§8.4.1 의 `seedreamwh.Verify` 를 그대로 재사용한다. 별도 HTTP 핸들러 래퍼는 §8.4.2 예제(`handleSeedreamWebhook`) 가 완성본이므로 여기선 **이벤트별 페이로드 struct** 만 정리한다.

```go
// events.go — 이벤트 타입별 payload struct.
// 공통 필드(eventId, callerId, orderNo) 는 Base 로 embed.
package seedream

type EventBase struct {
    EventID  string `json:"eventId"`
    CallerID string `json:"callerId"`
    OrderNo  string `json:"orderNo"`
}

type VAccountIssuedEvent struct {
    EventBase
    BankCode       string `json:"bankCode"`
    AccountNo      string `json:"accountNo"`
    ReceiverName   string `json:"receiverName"`
    DepositEndDate string `json:"depositEndDate,omitempty"`
    IssuedAt       string `json:"issuedAt"` // RFC3339
}

type VAccountDepositedEvent struct {
    EventBase
    Amount      int64  `json:"amount"`
    DepositedAt string `json:"depositedAt"`
    // extra 필드 (depositorName 등) 는 map 으로 흡수.
    Extra map[string]any `json:"-"`
}

type PaymentCanceledEvent struct {
    EventBase
    Reason     string `json:"reason"`
    CanceledAt string `json:"canceledAt"`
}

type VAccountDepositCanceledEvent = PaymentCanceledEvent // 동일 shape

type VAccountCancelledEvent struct {
    EventBase
    DaouTrx     string `json:"daouTrx"`
    Reason      string `json:"reason"`
    CancelledAt string `json:"cancelledAt"`
}

type DepositCancelDepositedEvent struct {
    EventID       string `json:"eventId"`
    CallerID      string `json:"callerId"`
    RefundDaouTrx string `json:"refundDaouTrx"`
    Amount        string `json:"amount"`      // 키움 원본 string
    CancelDate    string `json:"cancelDate"`  // YYYYMMDDhhmmss
}
```

### C.4. 사용 예 (net/http)

```go
// main.go — 상품권 사이트 서버 엔트리포인트.
package main

import (
    "context"
    "encoding/json"
    "errors"
    "fmt"
    "log/slog"
    "net/http"
    "os"
    "strings"

    "your-org/giftcard/internal/seedream"
)

type Server struct {
    sd  *seedream.Client
    log *slog.Logger
    // db *gorm.DB, webhookSecret string 등 생략
    webhookSecret string
}

func (s *Server) handleCreateOrder(w http.ResponseWriter, r *http.Request) {
    var in struct {
        OrderNo     string `json:"orderNo"`
        Amount      int64  `json:"amount"`
        ProductName string `json:"productName"`
        PartnerID   string `json:"partnerId"`
        UserName    string `json:"userName"`
    }
    if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
        http.Error(w, "bad request", http.StatusBadRequest)
        return
    }
    device := "P"
    if strings.Contains(r.UserAgent(), "Mobile") {
        device = "M"
    }

    result, err := s.sd.IssueVAccount(r.Context(), seedream.VAccountIssueParams{
        OrderNo:     in.OrderNo,
        Amount:      in.Amount,
        ProductName: in.ProductName,
        PartnerID:   in.PartnerID,
        Type:        device,
        UserName:    in.UserName,
    })
    if err != nil {
        var sErr *seedream.Error
        if errors.As(err, &sErr) {
            // errorCode 별 분기 (§3.3).
            s.log.Warn("seedream issue failed",
                "code", sErr.Code, "errorId", sErr.ErrorID, "trace", sErr.TraceID)
        }
        http.Error(w, err.Error(), http.StatusBadGateway)
        return
    }

    // RESERVED 왕복 검증 (§3.5.3).
    if err := seedream.AssertReservedInvariant(in.PartnerID, seedream.ReservedFields{
        ReservedIndex1: result.ReservedIndex1,
        ReservedIndex2: result.ReservedIndex2,
        ReservedString: result.ReservedString,
    }); err != nil {
        s.log.Error("RESERVED roundtrip 위반 — Seedream 회귀 버그 의심", "err", err)
        http.Error(w, "internal reserved violation", http.StatusInternalServerError)
        return
    }

    // 응답 — 브라우저가 targetUrl 로 auto-submit 할 수 있도록 formData 를 전달.
    _ = json.NewEncoder(w).Encode(map[string]any{
        "targetUrl": result.TargetURL,
        "formData":  result.FormData,
    })
}

// dispatch 는 §8.4.2 / §8.5 에 정의된 내부 라우터.
func (s *Server) dispatch(ctx context.Context, deliveryID int64, event seedream.EventType, raw []byte) error {
    switch event {
    case seedream.EventVAccountRequested:
        return nil // optional — 자체 DB 에 이미 저장된 경우 무시.
    case seedream.EventVAccountIssued:
        var e seedream.VAccountIssuedEvent
        if err := json.Unmarshal(raw, &e); err != nil {
            return err
        }
        return s.onIssued(ctx, e)
    case seedream.EventVAccountDeposited:
        var e seedream.VAccountDepositedEvent
        if err := json.Unmarshal(raw, &e); err != nil {
            return err
        }
        return s.onDeposited(ctx, e) // payload.Amount vs 주문.Amount 비교
    case seedream.EventPaymentCanceled:
        var e seedream.PaymentCanceledEvent
        if err := json.Unmarshal(raw, &e); err != nil {
            return err
        }
        return s.onCancelled(ctx, e)
    case seedream.EventVAccountDepositCanceled:
        var e seedream.VAccountDepositCanceledEvent
        if err := json.Unmarshal(raw, &e); err != nil {
            return err
        }
        return s.onRefunded(ctx, e)
    case seedream.EventVAccountCancelled:
        var e seedream.VAccountCancelledEvent
        if err := json.Unmarshal(raw, &e); err != nil {
            return err
        }
        return s.onExternalCancel(ctx, e)
    case seedream.EventDepositCancelDeposited:
        var e seedream.DepositCancelDepositedEvent
        if err := json.Unmarshal(raw, &e); err != nil {
            return err
        }
        return s.onRefundDeposited(ctx, e)
    case "payment.completed":
        return nil // giftcard 는 VACCOUNT 전용. 수신되어도 무시.
    default:
        s.log.Warn("unknown seedream event", "event", event)
        return nil
    }
}

func main() {
    sd := seedream.NewClient(os.Getenv("SEEDREAM_API_BASE"), os.Getenv("SEEDREAM_API_KEY"))
    srv := &Server{
        sd:            sd,
        log:           slog.Default(),
        webhookSecret: os.Getenv("SEEDREAM_WEBHOOK_SECRET"),
    }

    mux := http.NewServeMux()
    mux.HandleFunc("POST /orders", srv.handleCreateOrder)
    mux.HandleFunc("POST /webhook/seedream", srv.handleSeedreamWebhook) // §8.4.2

    addr := ":" + os.Getenv("PORT")
    if addr == ":" {
        addr = ":8080"
    }
    if err := http.ListenAndServe(addr, mux); err != nil {
        srv.log.Error("listen failed", "err", err)
        os.Exit(1)
    }
    _ = fmt.Sprint
}
```

---

## 부록 D. RESERVED 왕복 불변식 회귀 테스트 (Go)

상품권 사이트에도 자체 회귀 테스트를 두자. 다음 4개가 최소 세트 — TEST 환경(`test.seedreamapi.kr`) 기준 integration test 로 가동 권장.

```go
// reserved_roundtrip_test.go
package seedream_test

import (
    "context"
    "errors"
    "os"
    "testing"
    "time"

    "your-org/giftcard/internal/seedream"
    "your-org/giftcard/internal/seedreamwh"
)

// newTestClient 는 TEST 환경 클라이언트를 생성. TEST API Key 는 CI 시크릿에 주입.
func newTestClient(t *testing.T) *seedream.Client {
    t.Helper()
    base := os.Getenv("SEEDREAM_TEST_BASE")
    key := os.Getenv("SEEDREAM_TEST_API_KEY")
    if base == "" || key == "" {
        t.Skip("SEEDREAM_TEST_BASE / SEEDREAM_TEST_API_KEY 미설정 — 통합 테스트 skip")
    }
    return seedream.NewClient(base, key, seedream.WithTimeout(20*time.Second))
}

// 1. 발급 응답의 RESERVED 3필드가 요청 값 그대로여야 한다.
func TestReserved_IssueRoundtrip(t *testing.T) {
    sd := newTestClient(t)
    ctx := context.Background()

    issued, err := sd.IssueVAccount(ctx, seedream.VAccountIssueParams{
        OrderNo:     "TEST-" + time.Now().UTC().Format("20060102150405"),
        Amount:      1000,
        ProductName: "reserved-roundtrip-test",
        PartnerID:   "partner-X",
        Type:        "P",
    })
    if err != nil {
        t.Fatalf("IssueVAccount: %v", err)
    }
    if issued.ReservedIndex1 != "seedreamgift" {
        t.Errorf("reservedIndex1 = %q, want seedreamgift", issued.ReservedIndex1)
    }
    if issued.ReservedIndex2 != "partner-X" {
        t.Errorf("reservedIndex2 = %q, want partner-X", issued.ReservedIndex2)
    }
    if issued.ReservedString != "default" {
        t.Errorf("reservedString = %q, want default", issued.ReservedString)
    }
    t.Cleanup(func() {
        // 입금 전 취소로 정리.
        if issued.DaouTrx != nil {
            _, _ = sd.CancelIssued(ctx, issued.OrderNo, *issued.DaouTrx, issued.Amount, "테스트 정리")
        }
    })
}

// 2. GET 응답에도 RESERVED 가 보존되어 있어야 한다.
func TestReserved_GetRoundtrip(t *testing.T) {
    sd := newTestClient(t)
    ctx := context.Background()

    orderNo := "TEST-" + time.Now().UTC().Format("20060102150405")
    if _, err := sd.IssueVAccount(ctx, seedream.VAccountIssueParams{
        OrderNo: orderNo, Amount: 1000, ProductName: "t",
        PartnerID: "partner-X", Type: "P",
    }); err != nil {
        t.Fatalf("setup IssueVAccount: %v", err)
    }

    found, err := sd.FindByOrderNo(ctx, orderNo)
    if err != nil {
        t.Fatalf("FindByOrderNo: %v", err)
    }
    if found == nil {
        t.Fatal("FindByOrderNo: nil result")
    }
    if found.ReservedIndex1 != "seedreamgift" || found.ReservedIndex2 != "partner-X" || found.ReservedString != "default" {
        t.Errorf("GET RESERVED mismatch: %+v", found)
    }
}

// 3. AssertReservedInvariant 는 오염 시 sentinel error 를 반환해야 한다.
func TestAssertReservedInvariant_Tamper(t *testing.T) {
    err := seedream.AssertReservedInvariant("partner-X", seedream.ReservedFields{
        ReservedIndex1: "other",
        ReservedIndex2: "partner-X",
        ReservedString: "default",
    })
    if err == nil {
        t.Fatal("오염 감지 실패: nil error")
    }
    if !errors.Is(err, seedream.ErrReservedRoundTripViolation) {
        t.Errorf("sentinel 미매칭: %v", err)
    }
}

// 4. 웹훅 서명 검증 — 잘못된 시크릿은 거부, 올바른 시크릿은 통과.
func TestWebhookVerify(t *testing.T) {
    body := []byte(`{"eventId":"e-1","orderNo":"TEST-01"}`)
    ts := "1745319845"
    // Seedream 과 동일한 알고리즘으로 서명 생성.
    correct := seedreamwh.SignForTest(t, "shared-secret", body, ts)

    if err := seedreamwh.Verify("shared-secret", body, ts, "sha256="+correct, time.Hour); err != nil {
        t.Fatalf("정상 서명이 거부됨: %v", err)
    }
    if err := seedreamwh.Verify("wrong-secret", body, ts, "sha256="+correct, time.Hour); err == nil {
        t.Fatal("잘못된 시크릿이 통과됨")
    }
}
```

> `seedreamwh.SignForTest` 는 테스트 전용 helper. 실 코드는 `pkg/webhookverify.Sign` 과 동일하게 `tsHeader + "." + body` 를 HMAC-SHA256 으로 서명하면 된다 (§8.4.1 `Verify` 구현 참조).

---

## 부록 E. 운영 FAQ

**Q1. `depositEndDate` 를 30분이 아닌 다른 값으로 하고 싶다.**
A. 상품권 사이트 정책으로 **30분 고정**. 늘리려면 Seedream Ops와 함께 정책 리뷰 후 이 문서를 먼저 개정.

**Q2. 발급 후 고객이 은행 선택을 안 한 상태로 브라우저를 닫았다. 언제 주문을 정리하나?**
A. `depositEndDate` 경과 후 Seedream이 자동 FAILED 전이하지만 **웹훅 이벤트는 전송하지 않는다** (§9.4). 상품권 사이트는 `depositEndDateAt` 기준 타이머 또는 `GET /vaccount?orderNo=...` 폴링으로 감지. 조기 정리를 원하면 `POST /payment/cancel` with `VACCOUNT-ISSUECAN` 호출.

**Q3. CallerID를 수동 헤더로 전달해도 되나?**
A. 불필요하고 권장하지 않는다. API Key 인증이 자동으로 귀속시킨다. 수동 전달은 무시됨.

**Q4. 같은 주문에 여러 번 환불할 수 있나?**
A. 상품권 사이트 시나리오에서 **부분환불 미지원**. 전체환불 1회만 가능. 이미 CANCELLED 상태에서 재호출하면 `CANCEL_ALREADY_DONE`.

**Q5. 웹훅 처리에서 5xx 대신 2xx 반환 후 비동기 처리해도 되나?**
A. 가능하되 **주의**: 2xx 반환 후 내부 처리 실패 시 Seedream은 재시도하지 않는다. 반드시 "내부 큐에 넣은 직후에만" 2xx 반환. 큐에 넣기 전 실패면 5xx 반환해 재시도 유도.

**Q6. 상품권 사이트가 자체적으로 Seedream 계좌번호를 마스킹해서 보관해야 하나?**
A. 고객에겐 그대로 노출해야 입금 가능. DB 저장은 그대로. 로그·감사 출력 시 마스킹 (앞 2~3자리 + 뒤 2~3자리만).

**Q7. 키움페이 SDK를 직접 쓰면 안 되나?**
A. 현재 키움페이와 **SDK 계약 미체결**. Seedream REST 경유만 사용 가능.

**Q8. TEST 환경(`test.seedreamapi.kr`)에서 테스트 결제 금액은?**
A. Seedream TEST 는 키움 DEV 환경(`KIWOOM_ENV=dev`)을 뒤에 붙이므로 **실제 돈 이동 없음**. 금액은 임의로 가능. `staging.seedreamapi.kr` 도메인은 존재하지 않으니 혼동 주의.

**Q9. 발급 실패인데 웹훅도 안 오고 있다.**
A. `GET /vaccount?orderNo=...` 로 상태 재조회. `status=FAILED` + `resultCode≠0000` 이면 키움 거부. `status=PENDING` 1시간 이상 지속되면 Ops 에스컬레이션.

**Q10. 서킷 브레이커가 열린다. 서비스 다운인가?**
A. 일시적으로 키움 API 쪽 오류율이 임계치를 넘은 상태. Seedream 자체는 정상. 30초~수분 대기 후 재시도. 장시간 지속 시 키움 전체 장애 확률 높음 — Ops 에스컬레이션.

---

**문서 끝.** 다음 개정은 `/api/v1/refunds` VACCOUNT 지원 확정 또는 `issueMode=api` 계약 체결 시점.
