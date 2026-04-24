---
title: SeedreamPay 온보딩 체크리스트 (씨드림기프트 → Seedream → 키움페이)
date: 2026-04-23
status: draft
related:
  - docs/seedreamapi_docs/2026-04-21-giftcard-site-seedream-api-integration.md
  - config/nginx/nginx205.conf
---

# SeedreamPay 온보딩 체크리스트

씨드림기프트(본 프로젝트) 가 Seedream 결제 플랫폼에 연동되기까지 필요한
**계약·자격·설정 값 교환 절차** 체크리스트. 기술 스펙은 통합 문서(`2026-04-21-...md`) 참조.

## 3자 관계

```
[씨드림기프트 Ops] ─── (웹훅 수신 등록) ───▶ [Seedream Ops] ─── (키움 통지 등록 메일) ───▶ [키움페이 support]
        ▲                                         │
        │ (vaccount.* / payment.canceled 등)      │
        └────────── 웹훅 수신 ────────────────────┘
```

씨드림기프트는 **키움페이와 직접 계약이 없다**. 모든 키움 연동은 Seedream이 중개.

---

## §1. Seedream Ops 로부터 수령해야 할 값

| 항목 | 용도 | 보관 위치 |
|------|------|----------|
| `X-API-Key` (TEST) | `test.seedreamapi.kr` 호출 인증 | 환경변수 `SEEDREAM_API_KEY_TEST` |
| `X-API-Key` (PROD) | `api.seedreamapi.kr` 호출 인증 | 환경변수 `SEEDREAM_API_KEY` |
| `CallerID` (= `PartnerID`) | 로그 매칭·Ops 문의용 | `docs/seedreamapi_docs/` 하단 기록 |
| `PORTAL_CLIENT_ID` 설정값 확인 | 0 이면 웹훅 자체 미발송 | 확인 회신 텍스트만 보관 |

**수령 확인 체크리스트**:
- [ ] TEST·PROD 각각 별도 X-API-Key 수령
- [ ] Permissions 배열 확정: `["POST:/api/v1/vaccount", "GET:/api/v1/vaccount", "POST:/api/v1/payment/cancel"]`
- [ ] Seedream `PORTAL_CLIENT_ID` 가 **0 이 아님** 확인 (PROD·TEST 양쪽)

---

## §2. Seedream Ops 에게 제공해야 할 값

Seedream DB `Partners` 테이블 insert 요청에 필요.

| 필드 | 값 (PROD 예시) | 생성 방법 |
|------|---------------|----------|
| `PartnerID` | Ops 가 결정 (예: `giftsite-prod`) | Ops 결정 |
| `WebhookURL` | `https://seedreamgift.com/webhook/seedream` | nginx205.conf 에 정의됨 |
| `SigningSecret` | 32+ 바이트 랜덤 | `openssl rand -hex 32` |
| `MaxRetries` | `5` | 기본값 권장 |
| `TimeoutSeconds` | `10` | 기본값 권장 |

### SigningSecret 생성 커맨드

```bash
# PROD·TEST 각각 별도 생성
openssl rand -hex 32
```

### 값 전달 방법

- **평문 이메일 금지**. 회사 표준 시크릿 공유 채널(1Password / Vault 링크) 사용.
- 전달 후 **수령 확인** 회신 받기 (insert 완료 == 웹훅 수신 가능 상태).

---

## §3. Seedream Ops 에게 전달할 요청 템플릿

### 3.1. 최초 온보딩 요청

```
제목: [씨드림기프트] PROD 웹훅 수신 등록 요청

안녕하세요, 씨드림기프트 담당자입니다.

아래 정보로 Seedream Partners 테이블 insert 부탁드립니다.

- PartnerID: (Ops 측 결정)
- WebhookURL: https://seedreamgift.com/webhook/seedream
- SigningSecret: (별도 보안 채널로 전달)
- MaxRetries: 5
- TimeoutSeconds: 10
- Enabled: true

추가 확인 요청:
1. 우리 CPID 에 대해 키움페이 4개 통지 URL 이 등록되어 있는지 확인 부탁드립니다:
   - /notification/issue
   - /notification/deposit
   - /notification/cancel
   - /notification/deposit-cancel
   누락 시 키움페이 support@kiwoompay.co.kr 로 등록 요청 메일 발송 부탁드립니다.

2. PROD 환경 PORTAL_CLIENT_ID 설정값이 0 이 아님을 확인 부탁드립니다
   (0 이면 웹훅 enqueue 자체가 건너뛰어짐).

감사합니다.
```

### 3.2. 키움페이 통지 URL 등록 요청 (Seedream Ops → 키움 support 전달용)

Seedream Ops 가 키움페이에 보낼 메일 본문. **씨드림기프트가 직접 키움에 발송 금지**.

> 제목: 입금 후 취소 통지URL 등록 요청
>
> 내용:
> CPID: (Seedream 이 키움과 계약한 상품권 사이트용 CPID)
> 등록 URL: https://api.seedreamapi.kr/notification/deposit-cancel
>
> 추가 3개 통지 URL (미등록 시 함께 요청):
> - https://api.seedreamapi.kr/notification/issue
> - https://api.seedreamapi.kr/notification/deposit
> - https://api.seedreamapi.kr/notification/cancel

출처: `키움페이 입금후취소 통지매뉴얼.pdf` §1.1.1 (support@kiwoompay.co.kr).

---

## §4. 온보딩 후 검증

### 4.1. TEST 환경 smoke test

- [ ] `POST test.seedreamapi.kr/api/v1/vaccount` → 200 + accountNumber 수신
- [ ] 30분 내 테스트 계좌 입금 → `vaccount.deposited` 웹훅 수신 로그 확인
- [ ] 웹훅 수신 로그: `nginx205 /var/log/nginx/seedream_webhook.log` 에 `POST /webhook/seedream 200` 기록됨
- [ ] HMAC 서명 검증 통과 (Go API 로그 `signature_valid=true`)

### 4.2. 방어선 점검

- [ ] `curl -X POST https://seedreamgift.com/webhook/seedream` (임의 IP) → **403** (IP 화이트리스트 차단)
- [ ] `curl -X GET https://seedreamgift.com/webhook/seedream` (194 IP 경유) → **405** (POST 아님)
- [ ] HMAC 서명 틀린 요청 → **401** (Go API 레이어)

### 4.3. 운영 지표 확인

- [ ] `logs/seedream_webhook.log` 접근 권한: Ops 만 (결제 이벤트 PII 포함)
- [ ] Seedream outbound IP(`103.97.209.194`) 가 nginx `set_real_ip_from` 체인을 통과하지 않음을 확인
  (CF 를 거치지 않는 직접 트래픽이므로 CF IP 목록에 포함되지 않아야 정상)

---

## §5. 운영 중 갱신 트리거

| 조건 | 필요 조치 |
|------|----------|
| SigningSecret 90일 경과 | 키 회전 절차 (§2.2.2 통합 문서 232행) |
| Seedream 서버 IP 변경 | nginx205.conf `allow 103.97.209.194;` 값 갱신 |
| Cloudflare IP 대역 갱신 | nginx205.conf `set_real_ip_from` 블록 갱신 (분기별 점검) |
| 키움 outbound IP 변경 | Seedream Ops 측 이슈 — 우리는 직접 영향 없음 |
| WebhookURL 변경 (도메인 이전 등) | Seedream Ops 에 `Partners.WebhookURL` UPDATE 요청 + 구 URL 은 최소 30일 병행 운영(재시도 버퍼) |

---

## §6. 보안 경고

- `SigningSecret` · `PrevSigningSecret` 은 Seedream DB 에 **평문 저장** (envelope encryption 미적용). Seedream Ops 와 함께 **90일 주기 회전** 스케줄 합의 필수.
- `/webhook/seedream` access log (`seedream_webhook.log`) 는 **결제 이벤트 PII** 포함. 로그 수명·접근권한을 일반 nginx access log 와 분리 관리.
- 씨드림기프트 Go API 의 `SEEDREAM_SIGNING_SECRET` 환경변수는 OS 레벨 secret store (Windows Credential Manager / Azure Key Vault / AWS SSM) 사용. `.env` 평문 저장 금지.
