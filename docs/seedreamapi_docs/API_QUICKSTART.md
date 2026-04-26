# 시드림(Seedream) 결제 API — 빠른 시작 가이드

> **대상**: 시드림 REST API를 호출해 결제를 연동하는 개발자(사람 + AI agent)
> **버전**: v2.0 (2026-04)
> **업데이트**: 2026-04-15
> **기초 문서**: [`docs/swagger.yaml`](swagger.yaml) · [`docs/swagger.json`](swagger.json) · [`docs/API_GUIDE.md`](API_GUIDE.md)
> **대화형 문서**: `GET /swagger/index.html` (서버 기동 후 브라우저 접근)

---

## TL;DR — 3분 실전 가이드

### 1. 인증

```http
X-API-Key: <64자 hex>
Idempotency-Key: <UUID 또는 고유 문자열>
```

- `X-API-Key`: 결제수단별로 다른 키. `internal-authkey.txt` 참조.
- `Idempotency-Key`: POST 요청에 권장. 동일 키 재전송 시 첫 응답 그대로 반환 (TTL 24h).
- 대안: `Authorization: Bearer <JWT>` (관리자 엔드포인트는 필수).

### 2. 기본 URL

| 환경 | URL | CPID |
|------|-----|------|
| TEST (개발) | `https://test.seedreamapi.kr` | `CTS11248` (키움 공용, 서버가 자동 주입) |
| PROD (운영) | `https://api.seedreamapi.kr` | 가맹점별 (서버가 자동 주입) |

> **CPID는 서버가 환경변수에서 자동 주입**. 클라이언트는 요청 바디에 포함하지 마세요 (리셀러 원칙).

### 3. 최소 동작 예시 — 카드 결제창 생성

```bash
curl -X POST "https://test.seedreamapi.kr/api/v1/payment/card" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: <카드결제용 내부 키>" \
  -H "Idempotency-Key: $(uuidgen)" \
  -d '{
    "orderNo":     "ORDER-20260415-0001",
    "amount":      10000,
    "productName": "디지털 상품 1개월 이용권",
    "productType": "1",
    "billType":    "1",
    "taxFreeCd":   "00",
    "userId":      "client-user-123",
    "email":       "user@example.com",
    "homeUrl":     "https://merchant.com/payment/complete",
    "returnUrl":   "https://merchant.com/payment/return",

    "reservedIndex1": "ch-mobile-app",
    "reservedIndex2": "promo-spring-2026"
  }'
```

**응답**:
```json
{
  "success": true,
  "data": {
    "id": 12345,
    "paymentMethod": "card",
    "orderNo": "ORDER-20260415-0001",
    "amount": 10000,
    "status": "PENDING",
    "rawResponse": "<!DOCTYPE html>... <form action=\"https://ssltest.kiwoompay.co.kr/...\">..."
  }
}
```

**다음 단계**: `rawResponse`의 HTML form을 브라우저에 주입 → 자동 submit → 키움 결제창 → 카드 입력 → 키움이 통지 콜백 호출.

---

## 개념 지도

```
[당신의 애플리케이션]
   │
   │ ① 결제 요청 (X-API-Key + Idempotency-Key)
   ▼
[시드림 API 서버]  ← 이 문서가 다루는 범위
   │   • 인증/감사/레이트리미트
   │   • 키움페이 어댑터 (EUC-KR, 해시 서명)
   │   • 상태 머신, DB 저장
   │ ② 결제창 URL/HTML 응답
   │◄─────────────────── ③ 브라우저에서 카드 입력 ───── [고객]
   │
   │ ④ 키움 통지 콜백 (⚠ 비동기, 인바운드)
[시드림 /notification/*] ◄── [KiwoomPay]
   │
   │ ⑤ Webhook으로 당신 서버에 전달 (선택, WEBHOOK_URL 등록 시)
   ▼
[당신의 Webhook 수신 엔드포인트]
```

### 핵심 단어 사전

| 용어 | 뜻 |
|------|-----|
| **시드림 (Seedream)** | 우리 미들웨어. 단일 KiwoomPay 계약으로 여러 가맹점 중개 |
| **KiwoomPay** | 외부 결제 프로세서. 시드림이 내부적으로 호출 |
| **CPID** | 키움페이 가맹점 ID. **서버 비밀**, 클라이언트 노출 금지 |
| **CallerID** | 시드림 내부 클라이언트 식별자. X-API-Key ↔ CallerID 매핑 |
| **DaouTrx** | 키움 거래번호. 결제 성공 후 응답/통지에 포함 |
| **orderNo** | 가맹점 주문번호. **가맹점이 부여**, 중복 가능하지만 Idempotency-Key로 보호 권장 |
| **reservedIndex1/2/string** | 가맹점 메타데이터 echo 필드. 키움 통지에 그대로 반환 |

---

## 주요 엔드포인트

### 결제창 (LINK) 생성 — **가장 자주 쓰는 API**

```
POST /api/v1/payment/{method}
```

- `method` 경로 파라미터: `card`, `cardk`, `bank`, `kakaopay`, `mobile`, `mobilepop`, `book`, `culture`, `happy`, `smartcard`, `teencash`, `eggmoney`, `tmoney`, `phonebill` (14종)
- 인증: `X-API-Key` (결제수단별)
- 요청 바디: `PaymentRequest` (아래 스키마 참고)
- 응답: `data.rawResponse`에 키움 결제창 HTML form. 브라우저에서 auto-submit.

### 가상계좌 발급

```
POST /api/v1/vaccount
```

- 응답: `accountNumber`, `bankCode`, `depositEndDate` 즉시 반환
- 이후 고객이 ATM/뱅킹에서 입금 → 키움이 `/notification/deposit` 호출 → 상태 SUCCESS

### 통합 결제창 (TOTALLINK)

```
POST /api/v1/payment/totallink
```

- 14종 결제수단을 단일 팝업에서 선택
- 응답: JS SDK 파라미터 (브라우저에서 `new KiwoomPay(...)` 호출)

### 결제 취소

```
POST /api/v1/payment/cancel
```

- 이미 승인된 거래 (status=SUCCESS)를 키움에 취소 요청
- `trxId` (= DaouTrx)와 `cancelReason` 필수
- 계좌이체(BANK) 취소 시 환불 계좌 3자리 은행코드 + 계좌번호 필수

### 전표 (영수증) URL

```
GET /api/v1/payment/slip?method=card&daouTrx=D...&status=11
```

- `status`: `11`(승인) / `12`(취소) / `16`(부분취소) / `A`(전체)
- 응답: `slipUrl` (브라우저에 열면 키움 영수증 페이지)

### 헬스체크

```
GET /health                    # 공개 (인증 없음)
GET /api/v1/admin/health       # JWT admin 필요 (상세)
```

### 관리자 API (JWT admin 필수)

| 경로 | 용도 |
|------|------|
| `GET /api/v1/admin/jobs` | 배치 작업 목록 |
| `GET /api/v1/admin/stats` | 종합 통계 |
| `GET /api/v1/admin/metrics` | 요청 메트릭 |
| `GET /api/v1/admin/dlq` | 데드레터 큐 조회 |
| `POST /api/v1/admin/dlq/{id}/retry` | DLQ 재시도 |

---

## 요청 바디 — `PaymentRequest` 스키마

### 모든 결제수단 공통 필수

| 필드 | 타입 | 길이 | 설명 |
|------|------|------|------|
| `orderNo` | string | 50 | 가맹점 주문번호. 파이프(`\|`) 금지 |
| `amount` | int64 | - | 결제금액 (원). 정수만, 소수점/콤마 금지 |
| `productName` | string | 50 | 결제창에 표시될 상품명 |
| `productType` | string | 2 | `1`:디지털, `2`:실물 |
| `billType` | string | 2 | `1`:일반결제, `13`:자동결제(승인API용) |

### 공통 선택

| 필드 | 타입 | 설명 |
|------|------|------|
| `userId` | string | 가맹점 고객 ID |
| `userName` | string | 구매자명 |
| `email` | string | 고객 이메일 |
| `productCode` | string | 가맹점 내부 상품코드 |
| `homeUrl` | string | 결제 완료 후 이동 URL (결제창에서 이동) |
| `returnUrl` | string | 새 창으로 이동 URL |
| `closeUrl` | string | WebView에서 X 버튼 클릭 시 URL |
| `failUrl` | string | 결제 실패 시 URL |
| `appUrl` | string | 모바일 앱 인증 복귀 deeplink |
| `directResultFlag` | string | `Y`: 키움 완료창 생략, 바로 homeUrl |
| **`reservedIndex1`** | string(20) | **통지 콜백에 echo** — 가맹점 메타데이터 추적 |
| **`reservedIndex2`** | string(20) | 동일 |
| **`reservedString`** | string(1024) | 긴 메타데이터. 관리자페이지엔 안 보임 |

### 결제수단별 필수 추가

| 결제수단 | 필수 추가 | 예시 값 |
|---------|-----------|---------|
| `card` (신용카드D) | `taxFreeCd` | `"00"`(과세) / `"01"`(비과세) / `"02"`(복합) |
| `cardk` (신용카드K) | `taxFreeCd`, `quotaOpt` | `"0"`(일시불만) / `"2~12"`(최대할부) |
| `kakaopay` | `freeAmt`, `cashReceiptFlag` | `"0"` / `"0"`=미발행·`"1"`=발행 |
| `smartcard` (게임문화) | `adultType` | `"0"`(일반) / `"1"`(성인) |
| `eggmoney` | `userId`, `ipAddress` | `"127.0.0.1"` 등 고객 IP |
| `tmoney` (티머니) | `tmoneyCardType` | `"2"`(교통) / `"3"`(후불교통) / `"4"`(캐시) / `"5"`(후불캐시) |
| `phonebill` (KT 집전화) | `certType` | `"06"`(KT 유선) / `"07"`(KT 인터넷전화) |

### 가상계좌 (`POST /api/v1/vaccount`) 추가

| 필드 | 설명 |
|------|------|
| `payMethod` | `"VACCT"` (고정) |
| `type` | `"P"`(PC) / `"M"`(모바일) / `"W"`(WebView) |
| `bankCode` | 은행 제한 콤마구분. 공백 시 모든 은행. `"04"`(국민) 테스트 발급 가능 |
| `depositEndDate` | 입금만료일 `YYYYMMDDhhmmss` |
| `receiverName` | 수취인명 (미지정 시 키움 가맹점명 사용) |
| `cashReceiptFlag` | `0`/`1` |
| `vtaxFreeCd` | `00`/`01`/`02` (가상계좌 전용) |

---

## 응답 형식

### 성공

```json
{
  "success": true,
  "data": { /* 엔드포인트별 데이터 */ }
}
```

### 실패

```json
{
  "success": false,
  "error": "사용자 친화적 메시지",
  "errorCode": "VALIDATION",
  "errorId": "ERR-B38E97B5DDCC1D26",
  "validationErrors": {
    "taxFreeCd": "과세여부는 00(과세)/01(비과세)/02(복합)이어야 합니다"
  }
}
```

| errorCode | HTTP | 뜻 |
|-----------|------|-----|
| `VALIDATION` | 400 | 요청 필드 검증 실패 (validationErrors 참고) |
| `UNAUTHORIZED` | 401 | X-API-Key / JWT 누락 또는 불일치 |
| `FORBIDDEN` | 403 | 권한 있으나 엔드포인트 접근 불가 (CallerID 권한) |
| `NOT_FOUND` | 404 | 경로/리소스 없음 |
| `RATE_LIMITED` | 429 | 레이트리밋 초과 |
| `EXTERNAL_API_ERROR` | 502 | 키움 API 에러 (재시도 가능) |
| `TIMEOUT` | 504 | 키움 API 타임아웃 |
| `INTERNAL` | 500 | 서버 내부 오류 |

`errorId`는 `ERR-<16자 hex>` 형식. 지원 요청 시 이 ID로 로그 역추적 가능.

---

## 통지 콜백 수신 (인바운드)

### 엔드포인트 — 키움이 시드림에 호출

| 경로 | 시점 |
|------|------|
| `GET /notification/payment` | 결제 완료 후 (카드/계좌이체/카카오페이 등) |
| `GET /notification/issue` | 가상계좌 발급 직후 |
| `GET /notification/deposit` | 가상계좌 입금 완료 |
| `GET /notification/cancel` | 결제 취소 완료 |
| `GET /notification/deposit-cancel` | 가상계좌 입금 후 취소 |

- 키움이 **GET 쿼리 파라미터**로 전송
- 시드림이 검증 후 DB 업데이트
- **응답으로 `<RESULT>SUCCESS</RESULT>` HTML 반환 필수** (키움 재시도 방지)

### 가맹점 알림 (webhook forward)

시드림이 통지 수신 → DB 저장 → **가맹점의 webhook URL로 전달** (등록 시).

Webhook 페이로드 예시:
```json
{
  "event":   "payment.completed",
  "orderNo": "ORDER-20260415-0001",
  "daouTrx": "D2026041512345678",
  "status":  "SUCCESS",
  "amount":  10000,
  "method":  "card",
  "reservedIndex1": "ch-mobile-app",
  "reservedIndex2": "promo-spring-2026",
  "signedAt": "2026-04-15T14:30:12Z",
  "signature": "HMAC-SHA256(secret, body)"
}
```

#### Webhook 서명 검증

수신한 webhook의 무결성을 반드시 검증하세요. 시드림은 `X-Seedream-Signature`와 `X-Seedream-Timestamp` 헤더를 포함합니다.

**검증 프로토콜:**
```
signed_payload = "{timestamp}.{body}"
signature      = HMAC-SHA256(SigningSecret, signed_payload)
헤더           = X-Seedream-Signature: sha256=<hex>
```

**Python 예시:**
```python
import hmac, hashlib, time

def verify_webhook(secret: str, body: bytes, ts_header: str, sig_header: str, max_age: int = 600) -> bool:
    # 1. timestamp 검증 (10분 이내)
    ts = int(ts_header)
    if abs(time.time() - ts) > max_age:
        return False
    # 2. HMAC-SHA256 서명 검증
    signed_payload = f"{ts}.".encode() + body
    expected = hmac.new(secret.encode(), signed_payload, hashlib.sha256).hexdigest()
    actual = sig_header.removeprefix("sha256=")
    return hmac.compare_digest(expected, actual)
```

**TypeScript/Node.js 예시:**
```typescript
import crypto from 'crypto';

function verifyWebhook(secret: string, body: Buffer, tsHeader: string, sigHeader: string): boolean {
  const ts = parseInt(tsHeader, 10);
  if (Math.abs(Date.now() / 1000 - ts) > 600) return false;
  const payload = `${ts}.${body.toString()}`;
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  const actual = sigHeader.replace('sha256=', '');
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(actual));
}
```

**Go 예시** (직접 import 가능):
```go
import "seedream-api-server/pkg/webhookverify"

err := webhookverify.Verify(signingSecret, body, tsHeader, sigHeader, 10*time.Minute)
if err != nil {
    // 서명 불일치 — 요청 거부
}
```

---

## 멱등성 (Idempotency)

POST 요청에 `Idempotency-Key` 헤더 권장:

```http
Idempotency-Key: 550e8400-e29b-41d4-a716-446655440000
```

- TTL: 24h
- 저장 범위: `{CallerID}:{rawKey}:{METHOD}:{PATH}` (CallerID별 격리)
- 재전송 시: **첫 응답 그대로** 반환 (HTTP 상태/바디 동일)
- 네트워크 타임아웃 시 안전한 재시도 가능

---

## 예시 코드

### Python (requests)

```python
import os, uuid, requests

def create_card_payment(amount, order_no, product_name):
    resp = requests.post(
        "https://test.seedreamapi.kr/api/v1/payment/card",
        headers={
            "X-API-Key":       os.environ["SEEDREAM_CARD_KEY"],
            "Idempotency-Key": str(uuid.uuid4()),
        },
        json={
            "orderNo":     order_no,
            "amount":      amount,
            "productName": product_name,
            "productType": "1",
            "billType":    "1",
            "taxFreeCd":   "00",
            "userId":      "user-123",
            "homeUrl":     "https://merchant.com/complete",
            "returnUrl":   "https://merchant.com/return",
            "reservedIndex1": "py-client",
        },
        timeout=35,
    )
    resp.raise_for_status()
    return resp.json()["data"]
```

### TypeScript (fetch)

```ts
async function createCardPayment(amount: number, orderNo: string, productName: string) {
  const r = await fetch(`${BASE}/api/v1/payment/card`, {
    method: "POST",
    headers: {
      "Content-Type":     "application/json",
      "X-API-Key":        process.env.SEEDREAM_CARD_KEY!,
      "Idempotency-Key":  crypto.randomUUID(),
    },
    body: JSON.stringify({
      orderNo, amount, productName,
      productType: "1", billType: "1", taxFreeCd: "00",
      userId: "user-123",
      homeUrl: "https://merchant.com/complete",
      returnUrl: "https://merchant.com/return",
    }),
  })
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  const body = await r.json()
  if (!body.success) throw new Error(body.error)
  return body.data
}
```

### Go (net/http)

```go
func CreateCardPayment(ctx context.Context, amount int64, orderNo, productName string) (map[string]any, error) {
    body, _ := json.Marshal(map[string]any{
        "orderNo": orderNo, "amount": amount, "productName": productName,
        "productType": "1", "billType": "1", "taxFreeCd": "00",
        "userId": "user-123",
        "homeUrl": "https://merchant.com/complete",
        "returnUrl": "https://merchant.com/return",
    })
    req, _ := http.NewRequestWithContext(ctx, "POST",
        "https://test.seedreamapi.kr/api/v1/payment/card", bytes.NewReader(body))
    req.Header.Set("Content-Type", "application/json")
    req.Header.Set("X-API-Key", os.Getenv("SEEDREAM_CARD_KEY"))
    req.Header.Set("Idempotency-Key", uuid.NewString())
    resp, err := http.DefaultClient.Do(req)
    if err != nil { return nil, err }
    defer resp.Body.Close()
    var parsed struct { Success bool; Data map[string]any; Error string }
    if err := json.NewDecoder(resp.Body).Decode(&parsed); err != nil { return nil, err }
    if !parsed.Success { return nil, errors.New(parsed.Error) }
    return parsed.Data, nil
}
```

---

## AI Agent를 위한 참조

다음은 AI agent가 본 문서 기반으로 새 연동 코드를 생성할 때 체크해야 할 원칙입니다.

1. **CPID 절대 요청 바디에 포함 금지** — 서버가 env로 자동 주입
2. `X-API-Key`는 결제수단별로 **다른 키**. 잘못된 키 사용 시 403 (권한 없음)
3. `Idempotency-Key`는 **UUID 또는 시스템 고유값** 사용. 재전송 안전
4. `reservedIndex1/2/string`에 **주문 메타데이터** (채널/프로모션/세션ID 등) 포함 — 통지에 echo됨. **PII/비밀 금지**
5. 통지 콜백 수신 엔드포인트가 있다면 **`<RESULT>SUCCESS</RESULT>` 반드시 반환**
6. 결제수단별 필수 추가 필드 누락 시 400 + `validationErrors` 반환 — 응답 파싱해서 사용자에 표시
7. 응답 `success: false` 시 `errorCode`로 재시도 판단:
   - `VALIDATION`/`FORBIDDEN`/`UNAUTHORIZED`: 재시도 금지 (원인 수정 필요)
   - `EXTERNAL_API_ERROR`/`TIMEOUT`: 지수 백오프 재시도 (같은 Idempotency-Key 사용)
   - `RATE_LIMITED`: `Retry-After` 헤더 참고

---

## 참고 자료

| 문서 | 용도 |
|------|------|
| `docs/swagger.yaml` | 기계 가독 OpenAPI 2.0 스펙 |
| `docs/swagger.json` | 동일 (JSON 형식) |
| `docs/API_GUIDE.md` | 기존 한글 가이드 (레거시) |
| `docs/manual-vs-code-audit.md` | 키움 매뉴얼 ↔ 코드 구현 매핑 감사 |
| `kiwoom_docs/` | 키움페이 원본 매뉴얼 (14개 결제수단별) |
| `/swagger/index.html` | 대화형 Swagger UI (서버 기동 후) |

---

## 변경 이력

| 날짜 | 변경 |
|------|------|
| 2026-04-15 | 초안 — 본 문서 + swagger CPID 숨김 + 리셀러 원칙 반영 |
