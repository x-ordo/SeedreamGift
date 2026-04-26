# 시드림(Seedream) 결제 미들웨어 API 가이드

> **버전**: 2.1 | **최종 수정**: 2026-04-18
>
> Swagger UI: `http://{서버주소}:{포트}/swagger/index.html` (release 모드에선 비활성)
>
> **리셀러 모델 원칙**: 시드림은 단일 키움페이 계약으로 다수 가맹점을 중개합니다.
> 키움 CPID·인증키는 서버가 관리하며 **클라이언트 API 응답에 노출되지 않습니다**.
> 가맹점은 `X-API-Key`로 식별되며(CallerID), 주문 매칭은 RESERVED* 필드를 사용하세요.

---

## 목차

1. [개요](#1-개요)
2. [인증](#2-인증)
3. [공통 사항](#3-공통-사항)
4. [결제 API](#4-결제-api)
5. [취소 API](#5-취소-api)
6. [가상계좌 API](#6-가상계좌-api)
7. [TOTALLINK 통합결제창](#7-totallink-통합결제창)
8. [LINK V3.1 보안 결제창](#8-link-v31-보안-결제창)
9. [전표(영수증) URL](#9-전표영수증-url)
10. [조회 API](#10-조회-api)
11. [통지 콜백](#11-통지-콜백)
12. [관리자 API](#12-관리자-api)
13. [통지 시뮬레이션 (E2E 테스트)](#13-통지-시뮬레이션-e2e-테스트)
14. [에러 코드](#14-에러-코드)
15. [결제수단 코드표](#15-결제수단-코드표)
16. [실결제 전환 체크리스트](#16-실결제-전환-체크리스트)

---

## 1. 개요

키움페이(KiwoomPay) 외부 결제 API와 클라이언트 사이의 미들웨어 서버입니다.

- **Base URL**: `http://{서버주소}:{포트}`
- **프로토콜**: HTTPS 권장 (프로덕션 필수)
- **인코딩**: UTF-8 (키움페이 API 호출 시 내부적으로 EUC-KR 변환)

### 아키텍처

```
클라이언트 → [미들웨어 API] → 키움페이 외부 API
                 ↑
            키움페이 서버 (통지 콜백)
```

---

## 2. 인증

모든 `/api/v1/*` 엔드포인트는 인증이 필요합니다. 두 가지 방식 중 하나를 선택합니다.

### 2.1. API Key 인증 (권장)

결제수단별 전용 API Key를 `X-API-Key` 헤더에 설정합니다.

```http
X-API-Key: 2877729aac8b113ba395dacb83377ce58f294a430f43c210437a73d95bf1d884
```

각 API Key는 허용된 엔드포인트에서만 동작합니다:

| 결제수단 | 허용 엔드포인트 |
|---------|---------------|
| 계좌이체 | `/api/v1/payment/bank*` |
| 현금영수증 | `/api/v1/payment/cashreceipt*` |
| 네이버페이 | `/api/v1/payment/naverpay*` |
| 카카오페이 | `/api/v1/payment/kakaopay*` |
| 가상계좌 | `/api/v1/vaccount*` |
| 신용카드 | `/api/v1/payment/card*`, `/api/v1/payment/cardk*` |
| 삼성페이 | `/api/v1/payment/samsungpay*` |

잘못된 키 또는 권한 없는 엔드포인트 접근 시 `401` 또는 `403`을 반환합니다.

### 2.2. JWT Bearer 인증

관리자 API 또는 전체 접근이 필요한 경우 JWT를 사용합니다.

```http
Authorization: Bearer eyJhbGciOi...
```

---

## 3. 공통 사항

### 3.1. 응답 형식

모든 API 응답은 동일한 구조입니다:

```json
{
  "success": true,
  "data": { ... },
  "error": "",
  "errorId": ""
}
```

실패 시:

```json
{
  "success": false,
  "data": null,
  "error": "에러 메시지",
  "errorId": "trace-id-for-debugging"
}
```

### 3.2. 멱등성 (Idempotency)

`POST`, `PUT`, `PATCH`, `DELETE` 요청에 `Idempotency-Key` 헤더를 포함하면, 동일한 키로 재요청 시 이전 응답을 **HTTP 상태 코드·본문 그대로** 복원하여 반환합니다. 네트워크 타임아웃 등으로 재시도할 때 이중 결제·이중 발급을 방지합니다.

```http
Idempotency-Key: unique-request-id-12345
```

**제약**
- 길이: 최대 **256자**. 영숫자·`-`·`_`·`:` 권장.
- TTL: **24시간**. 이후 같은 키 재사용 시 신규 요청으로 처리됩니다.
- 스코프: `{CallerID}:{Idempotency-Key}:{HTTP METHOD}:{PATH}` 조합으로 격리. 서로 다른 CallerID의 동일 키는 충돌하지 않습니다.
- 요청 본문 해시가 이전 요청과 다르면 **422 Unprocessable Entity** (`errorCode: IDEMPOTENCY_KEY_REUSE`).
- 최초 요청이 처리 중(`IN_PROGRESS`)일 때 동일 키로 재요청이 들어오면 5분까지 대기하며, 이후에도 완료되지 않으면 503을 반환합니다.

**권장 전략**
- **POST 가상계좌/결제 요청**: UUIDv4 또는 `{orderNo}-{timestamp}` 형식. 재시도 시 **반드시 같은 키** 사용.
- **PATCH 웹훅 업데이트**: 반드시 필요하지 않으나 네트워크 재시도에 안전하게 만들려면 사용.
- **GET 요청**: 멱등 키 불요 (GET은 본질적으로 멱등).

### 3.3. orderNo 중복 정책

`orderNo`는 클라이언트가 제공하는 고유 식별자입니다. 중복 처리 규칙:

| 시나리오 | 동작 |
|----------|------|
| 같은 `orderNo` + 같은 `Idempotency-Key` | 멱등 처리 — 이전 응답 반환 |
| 같은 `orderNo` + **다른** `Idempotency-Key` | 새 요청으로 처리, DB에 별도 레코드 생성 (동일 orderNo 복수 레코드 존재 가능) |
| 같은 `orderNo` + `Idempotency-Key` 미지정 | 새 요청, 중복 레코드 생성. **이 조합은 피하세요**. |

**권장**: 프로덕션에서는 모든 POST에 `Idempotency-Key` 지정 — orderNo 자체는 중복 검증 키로 간주되지 않습니다. 조회는 `GET /api/v1/vaccount?orderNo=...`를 사용하면 해당 orderNo의 모든 레코드를 목록으로 확인할 수 있습니다.

### 3.4. 파이프라인 문자 금지

주문번호(`orderNo`), 상품명(`productName`) 등에 파이프라인(`|`) 문자를 사용할 수 없습니다.

---

## 4. 결제 API

### 4.1. 결제 요청 (LINK 결제창)

결제수단별 결제창을 통한 결제를 처리합니다.

```
POST /api/v1/payment/{method}
```

**Path Parameter**: `method` — 결제수단 코드 (아래 [결제수단 코드표](#13-결제수단-코드표) 참조)

**Request Body**:

```json
{
  "orderNo": "ORD20260404001",
  "amount": 10000,
  "productName": "테스트 상품",
  "productType": "1",
  "billType": "13",
  "userId": "user123",
  "email": "user@example.com",
  "homeUrl": "https://example.com/complete",
  "returnUrl": "https://example.com/callback"
}
```

**결제수단별 추가 필드**:

| 결제수단 | 추가 필수/선택 필드 |
|---------|-------------------|
| bank | `userSSN`(6자리 YYMMDD), `checkSSNYN`(Y/N — Y일 때 userSSN 필수) |
| card | `taxFreeCd`(필수), `cpQuota`, `cardList`, `cardQuota`, `skipYn` |
| cardk | `taxFreeCd`(필수), `quotaOpt`, `engFlag` |
| kakaopay | `freeAmt`, `payType`, `cashReceiptFlag` |
| mobile | `mobileCompanyList`, `fixTelNo` |
| phonebill | `certType` |
| smartcard | `adultType` |
| eggmoney | `ipAddress` |
| tmoney | `tmoneyCardType` |

**필드 길이 제한 (매뉴얼 각 §2.2)**:

| 필드 | 최대 길이 | 비고 |
|------|----------|------|
| `orderNo` | 50 | `\|` 금지 |
| `productName` | 50 | `\|` 금지 |
| `email` | 100 | |
| `userId` | 50 | |
| `userName` | 50 | `\|` 금지 |
| `productCode` | 10 | |
| `reservedIndex1`, `reservedIndex2` | 20 | `\|` 금지 |
| `reservedString` | **1024** | `\|` 금지 (bank·LINK V3.1 매뉴얼 §2.2) |
| `directResultFlag` | 1 | Y 또는 N |
| `userSSN` (bank) | 6 | 숫자 전용 YYMMDD |

**Response** (성공):

```json
{
  "success": true,
  "data": {
    "id": 1,
    "paymentMethod": "card",
    "orderNo": "ORD20260404001",
    "amount": 10000,
    "status": "PENDING",
    "createdAt": "2026-04-04T10:00:00Z"
  }
}
```

### 4.2. WebView URL 생성

모바일 앱에서 WebView로 결제창을 띄울 때 사용합니다.

```
GET /api/v1/payment/{method}/webview?orderNo=ORD001&productName=상품&amount=10000&homeUrl=https://...&closeUrl=https://...&failUrl=https://...
```

**공통 필수 URL 파라미터**: `homeUrl`, `closeUrl`, `failUrl` (HTTPS 권장).

**bank WebView 추가 필수 (매뉴얼 §2.2)**:

| 파라미터 | 필수 | 설명 |
|---------|------|------|
| `appUrl` | O | 인증 완료 후 앱으로 복귀할 URL. HTTPS 또는 모바일 앱 custom scheme(`myapp://...`) 허용. `javascript:`/`data:`/`file:`/`ftp:` 등 차단 |

> bank WebView는 **팝업 호출이 아닌 페이지 전환**으로 호출해야 정상 작동합니다 (매뉴얼 §2.1).

**Response**:

```json
{
  "success": true,
  "data": {
    "redirectUrl": "https://ssltest.kiwoompay.co.kr/m/card_webview/...",
    "token": "hmac-token",
    "expiresAt": "2026-04-04T10:30:00Z"
  }
}
```

### 4.3. 결제 승인 (CARD-KEYGEN / BATCH / VACCOUNT 등)

서버-서버 승인 API. 결제창을 띄우지 않고 카드 수기/정기/가상계좌 발급 등을 처리합니다.

```
POST /api/v1/payment/approve/{payMethod}
```

**Path Parameter**: `payMethod` — 승인 API V2.1 §2.3.4 17개:
`CARD-SUGI`, `CARDK-SUGI`, `CARD-KEYGEN`, `CARDK-KEYGEN`, `CARD-BATCH`, `CARDK-BATCH`, `MOBILE-BATCH`, `PMOBILE-BATCH`, `KT-BATCH`, `CULTURE`, `BOOKNLIFE`, `TEENCASH`, `EGGMONEY`, `GAMECARD`, `CASHREC`, `VACCOUNT-ISSUE`, `VACCOUNT-ASSIGN`

**공통 필수 필드** (§2.6):

| 필드 | 비고 |
|------|------|
| `orderNo`, `billType` | 항상 필수. `billType`는 1/2/13/14/18 중 하나 |
| `ipAddress`, `userId` | 항상 필수. `ipAddress`는 **최종 고객(구매자) IP** — 파트너사 서버가 Seedream 을 호출하는 구조이므로 Seedream 은 서버 IP 를 자동 추출하지 않습니다. 파트너사가 최종 고객 IP 를 명시적으로 전달해야 합니다 (매뉴얼 §2.6 "고객IP정보") |
| `productType`, `amount`, `productName` | **CARD-KEYGEN/CARDK-KEYGEN 제외** — 키 발급 단계에서는 상품 정보 없이도 가능 |

**결제수단별 주요 필수 필드** (§2.7):

| 결제수단 | 추가 필수 |
|---------|----------|
| `CARD-SUGI`/`CARDK-SUGI`, `CARD-KEYGEN`/`CARDK-KEYGEN` | `cardNo`, `expireDt`(YYYYMM); `cardAuth`·`cardPassword`는 **`billType=13/14`일 때만 필수**. `CARDK-KEYGEN`은 `cardPassword` 제외 |
| `CARD-KEYGEN`/`CARDK-KEYGEN` | `directYN`(Y/N). `Y`일 때 `quota` 필수 |
| `CARD-BATCH` | `autoKey`. `taxFreeCd=02`일 때 `productCode`는 **비과세 금액**(숫자, ≤ amount)으로 사용 (§2.6 비고) |
| `CARDK-BATCH`, `MOBILE-BATCH`, `PMOBILE-BATCH`, `KT-BATCH` | `autoKey` |
| `CULTURE`/`BOOKNLIFE` | `giftId`, `giftPwd` |
| `EGGMONEY`/`TEENCASH`/`GAMECARD` | `pinList` (콤마 구분 최대 5개) |
| `CASHREC` | `cpTelNo`, `cpName`, `cashReceiptUse`(1/2/9), `cashReceiptInfo`, `cpBusinessNo` |
| `VACCOUNT-ISSUE` | `receiverName`, `bankCode`(3자리), `depositorName`, `cpBusinessNo`, `depositEndDate` |
| `VACCOUNT-ASSIGN` (고정식) | 위 + `accountNo`(16), `depositEndDate` 필수. `taxFreeCd`는 **00/01만** (복합 02 불가) |

> ⚠ **`reservedString` 납치 주의** (매뉴얼 §2.8.6)
>
> `CASHREC` 또는 `VACCOUNT-ISSUE` + `taxFreeCd=02`(복합과세) 조합에서는 `reservedString` 필드가
> **비과세 대상금액 전용**으로 용도가 변경됩니다. 형식: `^[비과세금액]` (금액은 `amount` 보다 작아야 함).
>
> 이 조합을 사용하는 파트너사는 **자체 매칭 데이터를 `reservedString` 에 담을 수 없고** `reservedIndex1`/`reservedIndex2`
> 를 활용해야 합니다. 다른 포맷으로 `reservedString` 을 전달하면 400 에러.

**rate limit (§1.8)**: BATCH/KEYGEN 결제수단은 CallerID × payMethod 당 **초당 5건 제한** (권장 3건).
초과 시 `429 Too Many Requests`.

**Request Body**: 위 필수 필드 + 선택 필드 — Swagger 참조.
멱등성을 위해 `Idempotency-Key` 헤더 권장.

---

## 5. 취소 API

### 5.1. 결제 취소 요청

```
POST /api/v1/payment/cancel
```

**Request Body**:

```json
{
  "payMethod": "CARD",
  "trxId": "CTS12345678901234567",
  "amount": "10000",
  "cancelReason": "고객 요청 취소"
}
```

**선택 필드**:

| 필드 | 설명 | 조건 |
|------|------|------|
| `taxFreeAmt` | 비과세 취소금액 | **허용 결제수단**: `CARD`/`CARDK`(및 `*-BATCH`), `KAKAOPAY`, `NAVERPAY`, `SAMSUNGPAY`, `APPLEPAY`, `FOREIGNCARD`. 다른 결제수단에 지정 시 400. 취소금액보다 클 수 없음 (매뉴얼 §2.7.5) |
| `bankCode` | 환불 은행코드 (3자리) | 계좌이체(`BANK`) 환불 시 필수 |
| `accountNo` | 환불 계좌번호 | 계좌이체(`BANK`) 환불 시 필수 |

**`cancelReason` 특수 포맷**:

| 포맷 | 조건 | 설명 |
|------|------|------|
| `[STOPREQ]{사유}` | `payMethod=VACCOUNT-ASSIGNCAN` 만 허용 | 고정식 가상계좌 **영구 중지** (매뉴얼 §2.7.8-9). 중지 후 해당 계좌는 재사용 불가 |
| `{사유}^[{비과세금액}]` | `payMethod=BANK` 만 허용 | 계좌이체 복합과세 거래의 비과세 금액 분리 취소 (§2.7.6). 금액은 10자리 이하 숫자 |
| 일반 사유 | 모든 결제수단 | `^`·`[`·`]` 문자는 위 두 포맷 외에서 사용 금지 |

**은행코드 (3자리)**:

| 코드 | 은행 |
|------|------|
| 003 | 기업은행 |
| 004 | 국민은행 |
| 011 | 농협은행 |
| 020 | 우리은행 |
| 023 | SC제일은행 |
| 032 | 부산은행 |
| 071 | 우체국 |
| 081 | 하나은행 |
| 088 | 신한은행 |

**취소 PAYMETHOD 코드** (통합취소 API V2.0 §2.3.4 26개):
`KT`, `KT-BATCH`, `MOBILE`, `MOBILE-BATCH`, `PMOBILE`, `PMOBILE-BATCH`, `CARDK`, `CARDK-BATCH`, `CARD`, `CARD-BATCH`, `BANK`, `VACCOUNT-ISSUECAN`, `VACCOUNT-ASSIGNCAN`, `CULTURE`, `BOOKNLIFE`, `TEENCASH`, `EGGMONEY`, `GAMECARD`, `TMONEY`, `CASHREC`, `KAKAOPAY`, `NAVERPAY`, `SAMSUNGPAY`, `PAYCO`, `APPLEPAY`, `FOREIGNCARD`

**⚠ 승인 PAYMETHOD → 취소 PAYMETHOD 매핑 (비대칭)**

승인 API 와 취소 API 의 PAYMETHOD 코드가 일부 다릅니다. 취소 요청 시 아래 표의 **취소 코드**를 사용하세요.

| 승인 (§2.3.4) | 취소 (§2.3.4) |
|---------------|---------------|
| `CARD-SUGI` | `CARD` |
| `CARDK-SUGI` | `CARDK` |
| `CARD-KEYGEN` | `CARD` (BATCH 진행된 경우만 취소 가능) |
| `CARDK-KEYGEN` | `CARDK` |
| `CARD-BATCH` | `CARD-BATCH` (동일) |
| `CARDK-BATCH` | `CARDK-BATCH` (동일) |
| `VACCOUNT-ISSUE` | `VACCOUNT-ISSUECAN` |
| `VACCOUNT-ASSIGN` | `VACCOUNTASSIGNCAN` (하이픈 없음 주의) |
| `MOBILE-BATCH`/`PMOBILE-BATCH`/`KT-BATCH` | `MOBILE-BATCH`/`PMOBILE-BATCH`/`KT-BATCH` (동일) |
| `CULTURE`/`BOOKNLIFE`/`EGGMONEY`/`TEENCASH`/`GAMECARD`/`CASHREC` | 동일 |

> 주의: Seedream 은 `payMethod` 를 자동 변환하지 않습니다. 클라이언트가 취소 코드를 직접 전달해야 합니다.

### 5.3. 부분취소 지원 결제수단 (매뉴얼 §2.7.10)

부분취소(취소요청금액 < 승인금액)는 아래 결제수단에서만 지원:

- **카드 계열**: `CARD`, `CARDK`, `CARD-SUGI`, `CARDK-SUGI`, `CARD-BATCH`, `CARDK-BATCH`
- **간편결제**: `KAKAOPAY`, `NAVERPAY`, `SAMSUNGPAY`, `PAYCO`, `APPLEPAY`, `FOREIGNCARD`
- **상품권**: `CULTURE`(문화상품권)**만** 지원

> **주의**: `BOOKNLIFE`/`TEENCASH`/`EGGMONEY`/`GAMECARD`/`TMONEY`/`BANK`/`MOBILE`/`KT` 등은 **전체취소만** 가능. 부분취소 요청 시 400 에러.

### 5.4. 현금영수증 취소 가능 범위 (매뉴얼 §2.7.11)

취소 API로 **현금영수증을 취소할 수 있는 결제수단**은 다음으로 제한됩니다:

- `VACCOUNT-ISSUECAN` (가상계좌)
- `NAVERPAY`
- `CASHREC` (현금영수증 API)

> **계좌이체(`BANK`)에 연동 발행된 현금영수증**은 승인 상태를 유지하면서 현금영수증만 취소하는 기능이 이 API로는 불가능합니다. 키움페이 상점관리자(`https://agent.kiwoompay.co.kr`)에서 처리하세요.

### 5.5. 취소 결과 통지 (인바운드)

키움페이가 취소 성공 시 `/notification/payment` (또는 `/notification/deposit-cancel`)로 보내는 `PAYMETHOD`는 두 패턴으로 구분됩니다 (매뉴얼 §4.3):

| 결제수단 | 통지 PAYMETHOD (언더스코어) |
|----------|------------------------------|
| 신용카드(D/K), 삼성페이, 애플페이 | `CARD_CANCEL` |
| 계좌이체 | `BANK_CANCEL` |
| 삼성페이(개별) | `SAMSUNGPAY_CANCEL` |
| 애플페이(개별) | `APPLEPAY_CANCEL` |
| 해외카드 | `FCARD_CANCEL` |

| 결제수단 | 통지 PAYMETHOD (언더스코어 없음) |
|----------|--------------------------------|
| 카카오페이 | `KAKAOCANCEL` |
| 네이버페이 | `NAVERPAYCANCEL` |
| 페이코 | `PAYCOCANCEL` |

> 취소 통지 URL은 키움 상점관리자에서 CPID + 결제수단별로 등록하거나 `support@kiwoompay.co.kr`에 메일로 요청 가능 (§4.2, §4.4).

**Response** (성공):

```json
{
  "success": true,
  "data": {
    "TOKEN": "...",
    "RESULTCODE": "0000",
    "ERRORMESSAGE": "",
    "TRXID": "CTS12345678901234567",
    "AMOUNT": "10000",
    "CANCELDATE": "20260404100000"
  }
}
```

### 5.2. 정기결제 중단

`cancelReason`에 `[STOPREQ]` 접두사를 붙이면 정기결제를 중단합니다.

```json
{
  "payMethod": "CARD-BATCH",
  "trxId": "CTS12345678901234567",
  "amount": "0",
  "cancelReason": "[STOPREQ]정기결제 해지 요청"
}
```

---

## 6. 가상계좌 API

### 6.1. 가상계좌 발급

```
POST /api/v1/vaccount
```

**Request Body**: `adapter.VAccountRequest` (Swagger 참조)

#### 6.1.1. 2단계 발급 플로우 (기본)

키움페이 실시간 가상계좌는 즉시 계좌번호를 반환하지 **않습니다**. 키움은 먼저 은행선택 HTML 페이지를 준비하고, 고객이 해당 페이지에서 은행을 선택·입금해야 최종 계좌번호가 통지 콜백으로 들어옵니다.

```
┌──────────────┐  (1) POST /api/v1/vaccount
│   클라이언트   │ ────────────────────────────┐
└──────────────┘                             ▼
                                      ┌──────────────┐   (2) 키움 호출
                                      │  시드림 서버   │ ─────────────┐
                                      └──────────────┘              ▼
                                              ▲                ┌──────────┐
         (3) 응답: status=PENDING              │                │  키움페이  │
             accountNumber=null                │                └──────────┘
             resultCode=0000                   │                     │
             rawResponse.targetUrl=...         │ (HTML 폼 반환)       │
                   ◀───────────────────────────┘◀────────────────────┘

(4) 클라이언트가 targetUrl로 고객 리다이렉트 (hidden form POST)
                   ─────▶  고객이 은행 선택 + 입금
(5) 키움이 GET /notification/issue 콜백 → 서버가 accountNumber, bankCode, daouTrx 저장, status=SUCCESS
(6) 클라이언트는 서버로부터 웹훅(선택) 또는 폴링으로 SUCCESS 상태 확인
```

**1차 응답 (1단계 완료, HTML 폼 경로)**:

```json
{
  "success": true,
  "data": {
    "id": 1234,
    "orderNo": "ORD20260418001",
    "amount": 10000,
    "status": "PENDING",
    "accountNumber": null,
    "bankCode": null,
    "daouTrx": null,
    "resultCode": "0000",
    "createdAt": "2026-04-18T20:43:02+09:00"
  }
}
```

> 🛈 **이 시점의 `PENDING`은 정상**입니다. 실패가 아니라 "은행선택 페이지 준비 완료, 고객 대기 중" 의미입니다. `rawResponse.targetUrl`(또는 Wails 관리 콘솔의 **"키움 응답 해석" → `PAGE_READY`**)로 1단계 성공 여부를 확인할 수 있습니다.

**클라이언트 사용법** — 서버 응답의 `rawResponse.targetUrl` + `rawResponse.formData`를 hidden form으로 POST 전송:

```html
<form id="payForm" method="POST" action="{targetUrl}">
  <!-- formData의 각 키-값을 hidden input으로 생성 -->
</form>
<script>document.getElementById('payForm').submit();</script>
```

**최종 상태 (통지 콜백 이후)**:

```json
{
  "id": 1234,
  "orderNo": "ORD20260418001",
  "status": "SUCCESS",
  "accountNumber": "1234567890123456",
  "bankCode": "004",
  "daouTrx": "D20260418ABC",
  "depositEndDate": "20260425235959"
}
```

#### 6.1.2. 즉시 발급 모드 (`directResultFlag=Y`)

요청 바디에 `"directResultFlag": "Y"`를 포함하면 키움이 JSON으로 계좌번호를 즉시 반환하므로 1차 응답에 `accountNumber`가 채워집니다. 고객의 은행선택 UI가 불필요한 **서버-서버 승인 시나리오**에만 사용하세요.

> ⚠ 이 옵션은 **키움과 사전 협의된 CPID**에 한해 허용됩니다. 미허용 CPID에서 `Y`를 보내면 키움이 HTML 폼 응답으로 fallback 합니다 (기존 2단계 플로우).

#### 6.1.3. `status` 필드 해석 가이드

| status | resultCode | accountNumber | 의미 | 클라이언트 액션 |
|--------|-----------|---------------|------|------------------|
| `PENDING` | `0000` | `null` | HTML 폼 준비 완료, 고객 은행선택 대기 | `targetUrl`로 리다이렉트 후 통지 대기 |
| `PENDING` | `0000` | 값 존재 | 통지 처리 중 race (곧 `SUCCESS`로 전이) | 1~2초 후 재조회 |
| `SUCCESS` | `0000` | 값 존재 | 최종 계좌 발급 + 입금 확인 완료 | 완료 처리 |
| `FAILED` | `9011` 등 | `null` | 키움 측 거부 (상세는 ERROR_CODES.md §키움 결과코드) | 원인 수정 후 재시도 |
| `FAILED` | `0304` | `null` | 키움 **테스트 환경** 한도 초과 (운영 미발생) | 테스트 환경 제약 — 운영 영향 없음 |

#### 6.1.4. 요청 필드 정책 (리셀러 경계)

**서버 결정 필드 — 바디에 보내도 무시됩니다:**

| 필드 | 이유 |
|------|------|
| `cpid` | 리셀러 내부 식별자. `KIWOOM_CPID` 환경변수에서 서버가 자동 주입. |
| `payMethod` | 가상계좌 엔드포인트 URL이 상품을 결정하므로 Link 매뉴얼 §2.2에 정의되지 않은 필드. 서버가 항상 내부 상수(`VACCT`)로 처리하며 form body에는 송신하지 않음. |

**클라이언트 지정 필드 — `type`**

`type` 필드는 서버가 PC/모바일 엔드포인트를 선택하는 데 사용됩니다 (Link 매뉴얼 §2.1):

| 값 | 대상 키움 엔드포인트 |
|-----|-----------------------|
| `"P"` (기본) | `/vaccount/DaouVaccountMng.jsp` |
| `"M"` | `/m/vaccount/DaouVaccountMng.jsp` |
| `"W"` | ❌ 이 엔드포인트에서 거부됨 — §6.5 `/api/v1/vaccount/webview` 사용 |

#### 6.1.5. 통지 콜백 엔드포인트

```
GET /notification/issue      # 계좌 발급 통지
GET /notification/deposit    # 입금 통지
```

- 키움 서버가 **EUC-KR 인코딩**으로 호출합니다. 시드림 서버가 디코딩·검증 후 DB 업데이트합니다.
- **성공 응답 필수**: `<RESULT>SUCCESS</RESULT>` HTML을 반환해야 합니다. 미반환 시 키움이 3분 간격 10회 재시도합니다.
- 클라이언트는 이 엔드포인트를 **직접 호출하지 않습니다** — 키움 → 시드림 전용 경로입니다. 클라이언트는 웹훅 구독 또는 주문 조회(§6.x)로 상태 변화를 감지합니다.

### 6.2. 배치 가상계좌 발급

```
POST /api/v1/vaccount/batch
```

여러 건의 가상계좌를 한번에 발급합니다. 비동기 처리되며 작업 상태를 조회할 수 있습니다.

### 6.3. 배치 작업 상태 조회

```
GET /api/v1/vaccount/batch/{id}
```

### 6.4. 배치 작업 취소

```
DELETE /api/v1/vaccount/batch/{id}
```

### 6.5. WebView 가상계좌

모바일 WebView에서 사용할 가상계좌 발급 URL과 HMAC 토큰을 반환합니다.
GET(쿼리스트링) / POST(JSON body) 모두 지원 — SDK/포털에서는 POST를 권장합니다.

```
GET  /api/v1/vaccount/webview?orderNo=ORD001&productName=상품&amount=10000&productType=1&billType=1&homeUrl=...&closeUrl=...&failUrl=...
POST /api/v1/vaccount/webview
Content-Type: application/json
{ "orderNo": "ORD001", "productType": "1", "billType": "1", "productName": "상품", "amount": 10000, "homeUrl": "...", "closeUrl": "...", "failUrl": "..." }
```

**Query Parameters**: §4.2와 동일 (`orderNo`, `productName`, `amount`, `homeUrl`, `closeUrl`, `failUrl`).

**Response**:

```json
{
  "success": true,
  "data": {
    "redirectUrl": "https://ssltest.kiwoompay.co.kr/m/vaccount_webview/...",
    "token": "hmac-signed-token",
    "expiresAt": "2026-04-18T10:30:00Z"
  }
}
```

### 6.6. 입금후취소

```
POST /api/v1/vaccount/deposit-cancel
```

이미 입금된 가상계좌의 환불 계좌를 발급합니다.

---

### 6.7. 고정식 가상계좌 (가맹점 고객별 영구 부여)

**개념**: 1회용 가상계좌가 아닌, 가맹점이 정의한 **고객 ID(`customerKey`)**에 가상계좌 1개를
영구적으로 결속합니다. 같은 `customerKey`로 반복 발급 요청해도 **항상 같은 계좌**가 반환되며
(멱등), 입금이 발생하면 webhook으로 즉시 통보됩니다.

**언제 사용하나**:
- 월정액·구독 모델 (고객마다 고정 계좌로 매월 입금)
- 회원제 e-커머스 (회원번호별 가상계좌)
- B2B 정산 (거래처별 가상계좌 영구 발급)

**전체 흐름**:
```
1) 시드림에 풀(가용 가상계좌 N개) 사전 적재 (운영자가 admin API로)
2) 가맹점: POST /api/v1/vaccount/fixed/allocate {customerKey:"CUST-123"}
   → 풀에서 1개 픽업 → (CallerID, customerKey)에 영구 결속 → 가상계좌번호 반환
3) 가맹점: 자기 고객에게 가상계좌번호 안내 (이후 영구 사용)
4) 고객 송금 → 키움 → 시드림 통지 처리 (자동)
5) 시드림 → 가맹점 webhook (vaccount.fixed_deposited) 발신
6) 고객 해지 시: DELETE /api/v1/vaccount/fixed/allocations/{customerKey}
   → 풀 슬롯 RETIRED (재사용 X — 키움 §2.7.8 ASSIGNCAN 시맨틱)
```

#### 6.7.1. 발급 (멱등)

```
POST /api/v1/vaccount/fixed/allocate
X-API-Key: {{발급받은 키}}
Content-Type: application/json

{
  "customerKey": "CUST-123",        // 필수, 100자 이내, '|' 금지 (가맹점 고객 식별자)
  "expectedAmount": 50000,           // 선택, 예상 금액(원). 입금 시 자동 대조
  "receiverName": "홍길동",           // 선택, 30자 이내
  "willDepositorName": "홍길동",      // 선택, 예상 입금자명. 입금 시 일치 검증 → webhook depositorMatch 필드
  "notes": "월정액 A급"               // 선택, 500자 이내 (내부 메모)
}
```

**응답**:

| HTTP | 의미 | data 키 |
|------|------|---------|
| 201 Created | 신규 발급 | `alreadyExisted=false` |
| 200 OK      | 멱등 — 동일 customerKey 재요청 → 기존 계좌 반환 | `alreadyExisted=true` |
| 503 + Retry-After | 풀 소진 (`errorCode=POOL_EXHAUSTED`) | — |

```json
{
  "success": true,
  "data": {
    "allocationId": 42,
    "customerKey": "CUST-123",
    "bankCode": "088",
    "bankName": "신한은행",
    "vaccountNo": "1234567890123456",
    "expectedAmount": 50000,
    "receiverName": "홍길동",
    "status": "ACTIVE",
    "createdAt": "2026-04-19T10:00:00Z",
    "alreadyExisted": false
  }
}
```

**cURL 예제**:
```bash
curl -X POST https://api.seedream.kr/api/v1/vaccount/fixed/allocate \
  -H "X-API-Key: ${SEEDREAM_API_KEY}" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: alloc-CUST-123-001" \
  -d '{"customerKey":"CUST-123","expectedAmount":50000,"willDepositorName":"홍길동"}'
```

**`alreadyExisted` 활용 가이드**:
- `false` → 첫 발급 — 자기 DB에 (customerKey, vaccountNo) 매핑 INSERT
- `true`  → 기존 매핑 있음 — DB와 일치 확인만 (보통 No-op). 응답의 `vaccountNo`가 기존과 다르면 데이터 정합성 사고이므로 알람.

#### 6.7.2. 조회

```
GET  /api/v1/vaccount/fixed/allocations/{customerKey}            # 단건 + 최근 입금 5건
GET  /api/v1/vaccount/fixed/allocations/{customerKey}/deposits   # 입금 이력 페이지네이션
GET  /api/v1/vaccount/fixed/allocations?status=ACTIVE&limit=50   # 내 고객 목록
```

CallerID 자동 격리 — 다른 가맹점의 customerKey는 404로 응답되며 데이터 노출 없음.

```bash
# 단건 + 최근 입금
curl https://api.seedream.kr/api/v1/vaccount/fixed/allocations/CUST-123 \
  -H "X-API-Key: ${SEEDREAM_API_KEY}"

# 입금 이력 페이지
curl "https://api.seedream.kr/api/v1/vaccount/fixed/allocations/CUST-123/deposits?limit=50&offset=0" \
  -H "X-API-Key: ${SEEDREAM_API_KEY}"
```

#### 6.7.3. 영구 회수 (해지)

```
DELETE /api/v1/vaccount/fixed/allocations/{customerKey}
```

고객 탈회/계약 해지 시 호출. **풀 슬롯이 영구 RETIRED 처리되어 재사용되지 않습니다**
(키움페이 §2.7.8/§2.7.9 ASSIGNCAN 시맨틱). 따라서 동일 customerKey로 재발급하면 풀에서
**다른** 새 슬롯이 할당됩니다 (이전 번호 부활 X). 이 정책은 입금자가 해지된 계좌로
계속 송금하는 사고를 방지하기 위함입니다.

```bash
curl -X DELETE https://api.seedream.kr/api/v1/vaccount/fixed/allocations/CUST-123 \
  -H "X-API-Key: ${SEEDREAM_API_KEY}"
```

| 응답 | 의미 |
|------|------|
| 200 + `alreadyRevoked=false` | 정상 회수 완료 |
| 200 + `alreadyRevoked=true`  | 이미 회수된 키 (멱등 — 재호출 안전) |
| 404 | 해당 customerKey의 할당 없음 |

#### 6.7.4. 입금 webhook (`vaccount.fixed_deposited`)

키움이 시드림으로 통지한 입금을 가맹점이 등록한 webhook URL로 즉시 forward합니다.
일반 가상계좌 webhook(`vaccount.deposited`)과 **다른 이벤트 타입**이며 페이로드 구조가 다릅니다
(고정식은 `orderNo` 없음, `customerKey`/`vaccountNo`/`allocationId`로 식별).

**HTTP 헤더**:
```
X-Seedream-Event: vaccount.fixed_deposited
X-Seedream-Signature: t=1713520000,v1=<HMAC-SHA256>
X-Seedream-Timestamp: 1713520000
X-Seedream-Delivery-Id: 12345
```

**페이로드**:
```json
{
  "eventId": "uuid",
  "callerId": "your-caller-id",
  "customerKey": "CUST-123",
  "vaccountNo": "1234567890123456",
  "allocationId": 42,
  "amount": 50000,
  "depositedAt": "2026-04-19T11:30:00+09:00",
  "status": "SUCCESS",
  "daouTrx": "DAOU-XXX",
  "bankCode": "04",
  "depositBankCode": "088",
  "depositorName": "홍길동",            // 키움이 보낸 USERNAME (입금 고객명)
  "expectedAmount": 50000,              // (선택) 발급 시 등록한 예상 금액
  "expectedDepositorName": "홍길동",     // (선택) 발급 시 등록한 예상 입금자명
  "depositorMatch": true                // (선택) expectedDepositorName 과 일치 여부 boolean
}
```

**가맹점 응답 의무**: 2xx 반환. 5xx/408/429는 재시도 큐에 적재(MaxRetries 도달 시 DLQ).
4xx(400/401/403/404/422)는 즉시 fail.

**서명 검증**: HMAC-SHA256(`secret`, `timestamp.body`)을 v1과 비교. 자세한 코드는
[Webhook 보안 가이드](#114-웹훅-보안) 참조.

#### 6.7.5. 결제 취소(`vaccount.deposit_canceled`)

이미 처리된 입금이 취소(반환)된 경우 동일 outbox로 발신됩니다. 페이로드에 `reason`, `canceledAt`
포함. 가맹점은 자기 시스템에서 환불·정산 회계 처리 트리거로 사용.

#### 6.7.6. 운영 팁 (가맹점)

- **풀 부족 503**: 운영자에게 풀 충전(BankCode,VAccountNo CSV 업로드) 요청. 충전 후 즉시 발급 가능.
- **`alreadyExisted=true`로만 응답이 오면**: 이미 그 customerKey가 발급된 상태. 풀 비용 안 들고 안전.
- **마스킹된 가상계좌번호**: 시드림 관리 콘솔(포털)은 보안상 끝 4자리만 표시. 고객 안내용 전체 번호는 본 API로 받아 사용.
- **HTTPS만 사용**: webhook URL은 HTTPS 권장 (HMAC 서명 외에 TLS로 추가 보호).

---

## 7. TOTALLINK 통합결제창

키움페이 JS SDK를 사용한 통합 결제창 파라미터를 생성합니다.

```
POST /api/v1/payment/totallink
```

**Request Body**:

```json
{
  "orderNo": "ORD20260404001",
  "amount": 10000,
  "productName": "테스트 상품",
  "type": "P",
  "homeUrl": "https://example.com/complete",
  "userId": "user123",
  "svcCdIn": "CARD,BANK,KAKAOPAY"
}
```

| 필드 | 설명 |
|------|------|
| `type` | `P`(PC) / `M`(모바일) / `W`(WebView) |
| `svcCdIn` | 표시할 결제수단 필터 (콤마 구분) |
| `svcCdNotin` | 제외할 결제수단 필터 |
| `freeAmt` | 카카오페이 비과세금액 |
| `cpQuota` | 카드 할부 설정 (`0:2:3:4~12`) |
| `depositEndDate` | 가상계좌 입금기한 (`YYYYMMDD24MISS`) |
| `receiverName` | 가상계좌 수취인명 |
| `cashReceiptFlag` | 현금영수증 발급 (`1`:발급, `0`:미발급) |

**Response**:

```json
{
  "success": true,
  "data": {
    "params": {
      "kiwoomEnc": "NmUwM2Q5Ym...",
      "type": "P",
      "orderNo": "ORD20260404001",
      "amount": "10000",
      "productName": "테스트 상품",
      "sdkUrl": "https://ssl-v2.kiwoompay.co.kr/sdk/v1/latest/kiwoompayEnc.js",
      "sdkMode": "DEV",
      "merchantId": "<서버가 주입 — 가공하지 말 것>"
    }
  }
}
```

> ⚠ **merchantId**는 키움 SDK가 요구하는 가맹점 식별자입니다. 시드림 서버가 자동 주입하며,
> 클라이언트는 **값을 저장·로깅·다른 시스템에 전달하지 마세요**. 브라우저→키움 SDK 전달 경로에서만 사용합니다.

**프론트엔드 사용법**:

```html
<script src="{params.sdkUrl}" charset="EUC-KR"></script>
<script>
  KiwoomPaySDK.f_setInit("{params.sdkMode}", "FRAME");
  KiwoomPaySDK.f_payTotalLink({
    KIWOOM_ENC: "{params.kiwoomEnc}",
    TYPE: "{params.type}",
    CPID: "{params.merchantId}",
    ORDERNO: "{params.orderNo}",
    AMOUNT: "{params.amount}",
    PRODUCTNAME: "{params.productName}",
    HOMEURL: "https://example.com/complete"
  });
</script>
```

---

## 8. LINK V3.1 보안 결제창

KIWOOM_ENC 해시를 포함한 보안 결제창 폼 데이터를 생성합니다.

```
POST /api/v1/payment/{method}/link
```

**Request Body**: 결제 요청과 동일 (`payment.PaymentRequest`)

**Response**:

```json
{
  "success": true,
  "data": {
    "targetUrl": "https://apitest.kiwoompay.co.kr/pay/linkEnc",
    "formData": {
      "PAYMETHOD": "CARD",
      "CPID": "<서버 주입 — 재사용·로깅 금지>",
      "ORDERNO": "ORD20260404001",
      "AMOUNT": "10000",
      "KIWOOM_ENC": "NmUwM2Q5Ym...",
      "TYPE": "P",
      "PRODUCTNAME": "테스트 상품"
    }
  }
}
```

> ⚠ `formData.CPID`는 키움 SDK에 바로 전달하는 용도로만 사용하세요. 클라이언트 서버 DB에 저장하거나 다른 가맹점 처리 로직과 섞이면 리셀러 경계가 깨집니다.

**프론트엔드 사용법**: `targetUrl`로 `formData`를 POST 폼으로 전송합니다.

```html
<form id="payForm" method="POST" action="{targetUrl}">
  <!-- formData의 각 키-값을 hidden input으로 생성 -->
</form>
<script>document.getElementById('payForm').submit();</script>
```

---

## 9. 전표(영수증) URL

결제 전표(영수증) 조회 페이지 URL을 생성합니다.

```
GET /api/v1/payment/slip?method={method}&daouTrx={거래번호}&status={상태}
```

**Parameters**:

| 파라미터 | 필수 | 설명 |
|---------|------|------|
| `method` | O | 결제수단 (`card`, `cardk`, `bank`, `vaccount`, `kakaopay`, `naverpay`, `cashreceipt`, `universal`) |
| `daouTrx` | O | 키움페이 거래번호 (DAOUTRX) |
| `status` | X | `11`(승인), `12`(취소), `16`(부분취소), `A`(전체). 기본값 `A` — **`card`/`cardk`/`bank`/`naverpay`에서만 유효**, 그 외 결제수단에선 무시됨 |

### 9.1. 결제수단별 매핑 (키움 전표 매뉴얼 §1-§3 준수)

| method | 키움 경로 | STATUS | 비고 |
|--------|-----------|--------|------|
| `card` | `PayInfoPrintDirectCard.jsp` | 필요 | 신용카드D |
| `cardk` | `PayInfoPrintCreditCard.jsp` | 필요 | 신용카드K (해외카드 포함) |
| `bank` | `PayInfoPrintBank.jsp` | 필요 | 계좌이체 |
| `vaccount` | `PayInfoPrintVaccount.jsp` | 불필요 | 가상계좌 |
| `kakaopay` | `PayInfoPrintKakaoPay.jsp` | 불필요 | 카카오페이 |
| `naverpay` | `PayInfoPrintNaverPay.jsp` | 필요 | 네이버페이 |
| `cashreceipt` | `CashRecInfoPrint.jsp` | 불필요 | **운영 환경 전용** (매뉴얼 §2.2) |
| `universal` | `PayInfoPrint.jsp` | 불필요 | 거래내역 확인증 (그 외 모든 결제수단용) |

### 9.2. 환경별 제약

- `cashreceipt`는 키움페이가 **개발/스테이징 환경에서 지원하지 않습니다**. `KIWOOM_ENV != prod`에서 호출 시 400 에러로 차단됩니다 (매뉴얼 §2.2).
- `agent.kiwoompay.co.kr`(운영)과 `agenttest.kiwoompay.co.kr`(개발)은 거래번호를 서로 조회할 수 없습니다 (매뉴얼 §3.3).

### 9.3. Response (기본)

```json
{
  "success": true,
  "data": {
    "slipUrl": "https://agenttest.kiwoompay.co.kr/common/PayInfoPrintDirectCard.jsp?DAOUTRX=CTS123&STATUS=A"
  }
}
```

### 9.4. `universal` 전표 — 리셀러 경계 경고

`universal` (거래내역 확인증)은 **키움 매뉴얼 §3.5 포맷상** URL 쿼리에 가맹점 식별자가 포함됩니다. 우회 불가능.

```json
{
  "success": true,
  "data": {
    "slipUrl": "https://agent.kiwoompay.co.kr/common/PayInfoPrint.jsp?CPID=...&DAOUTRX=CTS123",
    "warning": "거래내역 확인증 URL에는 가맹점 식별자가 포함됩니다. 고객 브라우저 이동용으로만 사용하고, 이 URL을 서버/DB에 저장하거나 외부 시스템으로 전달하지 마세요.",
    "warningCode": "MERCHANT_ID_IN_URL"
  }
}
```

**클라이언트 측 준수 사항**:
- URL을 **서버 DB/로그에 저장 금지** — 장기 보존 시 리셀러 경계 유출
- 외부 모니터링/알림 시스템에 URL 전달 금지
- 고객에게 전표 보기 버튼 클릭 → 브라우저로 곧바로 이동하는 용도로만 사용
- 서버는 `universal` 사용을 감사 로그에 기록 (WARN 레벨)

> 🛈 가능하면 해당 결제수단의 전용 전표(§9.1의 `card`/`vaccount` 등)를 사용하세요. `universal`은 전용 경로가 없는 결제수단(`book`, `culture`, `happy`, `mobile`, `teencash`, `eggmoney`, `tmoney`, `phonebill`, `smartcard`, `mobilepop`)의 fallback입니다.

---

## 10. 조회 API

### 10.1. 결제수단 목록 조회

활성화된 결제수단의 설정값(허용 금액 범위, 필수 필드 등)을 조회합니다. 인증 필수.

```
GET /api/v1/payment/methods
```

**Response** (요약):

```json
{
  "success": true,
  "data": [
    {
      "code": "card",
      "name": "신용카드D",
      "paymethod": "CARD",
      "minAmount": 100,
      "maxAmount": 10000000,
      "webviewSupported": true,
      "requiredFields": ["orderNo", "productName", "amount", "taxFreeCd"]
    }
  ]
}
```

### 10.2. 주문번호로 결제 상태 조회

자기 가맹점(CallerID) 주문만 조회 가능 — 타 가맹점 주문 조회 시 `404`. 리셀러 격리 원칙.
**PaymentResults(일반 결제) → VAccountResults(가상계좌) 순으로 조회**하여 어느 한쪽에 있으면 성공 응답.

```
GET /api/v1/payment/status/{orderNo}
```

**Response**:

```json
{
  "success": true,
  "data": {
    "id": 1234,
    "orderNo": "ORD20260418001",
    "paymentMethod": "card",
    "amount": 10000,
    "status": "SUCCESS",
    "daouTrx": "CTS12345678901234567",
    "callerId": "client-a",
    "reservedIndex1": "user123",
    "reservedIndex2": "campaign-A",
    "reservedString": "메모",
    "createdAt": "2026-04-18T10:00:00Z"
  }
}
```

> RESERVED* 필드는 요청 시 보낸 값이 그대로 반환됩니다(왕복 무결성). 클라이언트 DB와 주문 매칭 시 사용하세요.

### 10.3. 키움 거래번호(DaouTrx)로 결제 조회

키움 통지 콜백에서 수신한 `DAOUTRX`를 사용해 조회합니다. CallerID 격리 적용.

```
GET /api/v1/payment/lookup?daouTrx=CTS12345678901234567
```

응답 포맷은 §10.2와 동일.

---

## 11. 통지 콜백

키움페이 서버가 결제/취소 완료 시 호출하는 엔드포인트입니다. **인증 불필요** (IP 화이트리스트로 검증).

| 엔드포인트 | 설명 |
|-----------|------|
| `GET /notification/issue` | 가상계좌 발급 통지 |
| `GET /notification/deposit` | 가상계좌 입금 통지 |
| `GET /notification/cancel` | 가상계좌 취소 통지 |
| `GET /notification/deposit-cancel` | 입금후취소 완료 통지 |
| `GET /notification/payment` | 통합 결제 완료 통지 |

> **주의**: 이 엔드포인트들은 키움페이 서버에서만 호출됩니다. 클라이언트가 직접 호출하지 않습니다.

통지 IP 화이트리스트:
- 운영: `27.102.213.200` ~ `27.102.213.209`
- 개발/스테이징: `123.140.121.205`

### 11.1. 입금후취소 통지 특수 정책 (`/notification/deposit-cancel`)

입금후취소 매뉴얼 §3.1.2에 따라 키움페이는 **재통지하지 않습니다**(단발, Timeout 9초).
이 경로는 다른 통지와 처리 정책이 다릅니다:

| 상황 | 다른 통지 (issue/deposit/cancel/payment) | deposit-cancel |
|------|------------------------------------------|----------------|
| 처리 실패 시 | 5xx 반환 → 키움 3분 간격 10회 재시도 | **SUCCESS 반환** + 내부 DLQ 기록 (키움 재시도 없음) |
| 내부 데드라인 | 없음 | 7초 (키움 9초 타임아웃 대비) |
| 재처리 경로 | 재통지 자동 수신 | GUI에서 DLQ 항목 수동 재처리 |

실패 이벤트는 `SystemEvents` 테이블의 `category=dlq`, `EventType=DLQ_ENQUEUED`로 기록되며,
GUI 운영 콘솔의 DLQ 탭에서 조회·수동 재처리 가능.

### 11.2. 입금후취소 통지 URL 등록

키움페이가 통지를 보내려면 **CPID별 통지 URL을 키움에 등록**해야 합니다. 등록은 이메일 요청으로만 가능:

```
To:      support@kiwoompay.co.kr
제목:    입금 후 취소 통지URL 등록 요청
내용:    CPID={프로덕션 CPID}
         URL=https://seedreamapi.kr/notification/deposit-cancel
```

> 운영 도메인을 `https://api.seedreamapi.kr/notification/deposit-cancel`로 쓰는 경우 해당 URL을 등록.

---

## 12. 관리자 API

JWT 인증 + `admin` 역할 필요. 모든 경로는 `/api/v1/admin` 하위.

### 12.1. 배치·통계·헬스

| 엔드포인트 | 설명 |
|-----------|------|
| `GET /jobs` | 배치 작업 목록 (`?state=PENDING&page=1&limit=20`) |
| `GET /jobs/{id}` | 배치 작업 상세 |
| `GET /stats` | 시스템 통계 (요청 수·성공률·큐 깊이 등) |
| `GET /metrics` | Prometheus 스타일 서버 메트릭 |
| `GET /health` | **상세** 헬스체크 (DB·Kiwoom 연결·CB 상태 등) |

> `/health` 는 인증 없이도 접근 가능한 간이 엔드포인트가 `GET /health` (루트)로 존재합니다 — `"ok"` 또는 `"degraded"`만 반환해 정보 노출을 막습니다. 운영 중 상세 상태는 반드시 `/api/v1/admin/health` 사용.

### 12.2. DLQ (Dead Letter Queue) 관리

처리 실패 이벤트가 축적되는 DLQ를 조회·재시도·폐기합니다.

| 엔드포인트 | 설명 |
|-----------|------|
| `GET /dlq` | DLQ 항목 목록 (`?eventType=notification&page=1`) |
| `GET /dlq/stats` | DLQ 집계 (이벤트타입별 건수·최근 시각) |
| `POST /dlq/{id}/retry` | 특정 항목 재시도 큐 재투입 |
| `POST /dlq/{id}/discard` | 특정 항목 영구 폐기 (감사 로그 자동 기록) |

### 12.3. 웹훅 전달 재시도

클라이언트 웹훅 전달 실패 시 수동 재배송합니다 (Sub-project 2).

```
POST /api/v1/admin/webhook-deliveries/{id}/redeliver
```

**Response**: `204 No Content` (성공) / `404` (id 없음) / `409` (이미 DELIVERED).

---

## 13. 통지 시뮬레이션 (E2E 테스트)

> **활성 조건**: `ENABLE_NOTIFICATION_SIMULATION=true` 환경변수 설정 시에만 라우트 등록.
> 프로덕션에서는 반드시 `false` 유지.

가맹점이 실제 키움 통지 없이 자체 E2E 흐름을 테스트할 수 있도록 제공합니다.
API Key/JWT 인증 + CallerID 스코프가 적용되므로 타 가맹점 주문을 조작할 수 없습니다.

| 엔드포인트 | 설명 | 시뮬레이션 대상 |
|-----------|------|----------------|
| `POST /api/v1/test/notification/issue` | 가상계좌 발급 통지 | `/notification/issue` |
| `POST /api/v1/test/notification/deposit` | 가상계좌 입금 통지 | `/notification/deposit` |
| `POST /api/v1/test/notification/cancel` | 취소 통지 | `/notification/cancel` |
| `POST /api/v1/test/notification/payment` | 통합 결제 완료 통지 | `/notification/payment` |

**Request 예시 (deposit)**:

```json
{
  "orderNo": "ORD20260418001",
  "daouTrx": "CTS12345678901234567",
  "amount": "10000",
  "bankCode": "088",
  "vAccountNo": "900012345678",
  "depositDate": "20260418100000"
}
```

**Response**:

```json
{ "success": true, "data": { "notificationStatus": "PROCESSED" } }
```

자기 CallerID에 속한 `orderNo`가 아닐 경우 `404 NOT_FOUND`.

---

## 14. 에러 코드

### 미들웨어 에러

| HTTP | 의미 | 설명 |
|------|------|------|
| 400 | Bad Request | 요청 검증 실패 |
| 401 | Unauthorized | 인증 실패 (API Key 또는 JWT) |
| 403 | Forbidden | 권한 없음 (해당 엔드포인트 접근 불가) |
| 409 | Conflict | 멱등성 키 충돌 (요청 본문 불일치) |
| 429 | Too Many Requests | 레이트 리미트 초과 |
| 502 | Bad Gateway | 키움페이 외부 API 오류 |
| 503 | Service Unavailable | 서킷 브레이커 열림 |

### 키움페이 RESULTCODE

> 키움 원인 코드 전체 목록과 권장 대응은 [ERROR_CODES.md §키움 결과코드](./ERROR_CODES.md#키움-결과코드-외부-api--resultcode-필드) 단일 출처(SSOT)를 참조. 본 섹션은 개요만 유지:
>
> - `0000` — 성공
> - `9011` — 파이프라인(`&#124;`) 문자 포함 (매뉴얼 §1.6)
> - `9029` — 취소 가능 금액 부족 → **입금후취소 API(`/v1/refunds`)** 필수 (본 문서 §17)
> - `FAIL,FAIL` — 암호화 키 미설정 또는 결제수단 미오픈 (매뉴얼 §1.5)
>
> 카드/가맹점/가상계좌 별 상세 코드(9101-9105, 9201-9206, 0304 등)는 위 링크 참조.

---

## 15. 결제수단 코드표

### LINK 결제창 (method 값)

| 코드 | 결제수단 | WebView |
|------|---------|---------|
| `bank` | 계좌이체 | O |
| `card` | 신용카드D | O |
| `cardk` | 신용카드K | O |
| `book` | 도서문화상품권 | O |
| `culture` | 문화상품권 | O |
| `happy` | 해피머니 | O |
| `kakaopay` | 카카오페이 | O |
| `mobile` | 휴대폰 | O |
| `mobilepop` | 모바일팝 | O |
| `smartcard` | 게임문화상품권 | O |
| `teencash` | 틴캐시 | O |
| `eggmoney` | 에그머니 | X |
| `tmoney` | 티머니 | X |
| `phonebill` | 폰빌(KT) | X |

### TOTALLINK 서비스 코드 (svcCdIn/svcCdNotin)

`CARD`, `PHONEBILL`, `MOBILE`, `BANK`, `VACCOUNT`, `BOOK`, `CULTURE`, `GAMECARD`, `EGGMONEY`, `TEENCASH`, `TMONEY`, `KAKAOPAY`, `NAVERPAY`, `SAMSUNGPAY`, `PAYCO`, `APPLEPAY`

### 승인 API PAYMETHOD

`CARD-SUGI`, `CARDK-SUGI`, `CARD-KEYGEN`, `CARDK-KEYGEN`, `CARD-BATCH`, `CARDK-BATCH`, `MOBILE-BATCH`, `PMOBILE-BATCH`, `KT-BATCH`, `CULTURE`, `BOOKNLIFE`, `TEENCASH`, `EGGMONEY`, `GAMECARD`, `CASHREC`, `VACCOUNT-ISSUE`, `VACCOUNT-ASSIGN`

### 취소 API PAYMETHOD

`CARD`, `CARDK`, `CARD-BATCH`, `CARDK-BATCH`, `BANK`, `MOBILE`, `KT`, `PMOBILE`, `CULTURE`, `BOOKNLIFE`, `TEENCASH`, `EGGMONEY`, `GAMECARD`, `TMONEY`, `CASHREC`, `KAKAOPAY`, `NAVERPAY`, `SAMSUNGPAY`, `PAYCO`, `APPLEPAY`, `FOREIGNCARD`, `VACCOUNT-ISSUECAN`, `VACCOUNT-ASSIGNCAN`

---

## 16. 실결제 전환 체크리스트

개발·스테이징에서 운영(실결제)으로 넘어가기 전 아래 항목을 **전부** 확인하세요.

### 16.1. 환경 변수

| 항목 | 값 |
|------|---|
| `KIWOOM_ENV` | `prod` (기본값 `dev`, 스테이징 `staging`) |
| `GIN_MODE` | `release` (Swagger UI 자동 비활성) |
| `KIWOOM_CPID` | 프로덕션 CPID (키움 계약서의 서비스 ID) |
| `KIWOOM_AUTH_KEY` | 프로덕션 Auth Key (Hash API용) |
| `DATABASE_URL` | `SEEDREAM_API_PROD` DB 접속 문자열 |
| `JWT_SECRET` / `JWT_SECRETS` | 32자 이상 랜덤 |
| `JWT_AUDIENCE` | `seedream-api-prod` (env 불일치 토큰 차단) |
| `ENABLE_NOTIFICATION_SIMULATION` | **반드시 `false`** |

### 16.2. 네트워크·IP

- [ ] Nginx: 키움 통지 IP(`27.102.213.200-209`)만 `/notification/*`에 허용
- [ ] 앱 레벨: `adapter.KiwoomNotificationIPs["prod"]`이 동일 IP 대역을 포함함
- [ ] Cloudflare 프록시 사용 시 `CLOUDFLARE_PROXY=true` 설정 → `CF-Connecting-IP` 신뢰
- [ ] `/api/v1/*` IP 화이트리스트(`IPWhitelistEntries`) — 필요 시에만 활성화 (비어있으면 모두 허용)

### 16.3. 리셀러 경계 정적 검증

```bash
pwsh scripts/check-no-cpid-exposure.ps1
# [OK] No CPID exposure in client response surface or public API spec
```

회귀 방지용 테스트:

```bash
go test ./internal/api/handler/ -run TestClientResponse_NoCPID
go test ./internal/domain/ -run TestPaymentResult_JSONExcludesCPID
go test ./internal/service/ -run TestNotificationService_PersistsReservedRoundTrip
go test ./internal/api/middleware/ -run TestIdempotency_ScopedByCaller
```

### 16.4. 수수료·정산 데이터 확인

- [ ] `FeeConfigs` 테이블에 14개 결제수단 키움 수수료가 모두 시드됨
- [ ] 클라이언트별 수수료(`ClientFeeConfigs`) 계약에 맞춰 입력됨 — 누락 시 `SETTLEMENT_FEE_MISSING` 발생
- [ ] 정산 주기(T+N 영업일) 각 결제수단별 설정 검토

### 16.5. 모니터링

- [ ] GUI 대시보드: 최근 1시간 `monitor.IncCallerIDMissing()` 증가가 있는지 → CallerID 누락 경로 존재 시사
- [ ] GUI: `monitor.IncReservedRoundTripLoss()` 증가 → RESERVED 왕복 깨짐 (회귀 버그)
- [ ] DLQ: 시작 직후 누적이 비정상 증가하지 않는지
- [ ] 웹훅: `webhook_deliveries` 테이블에 `FAILED` 누적 모니터링

### 16.6. 키움 매뉴얼 QA 체크

- [ ] 통지 성공 시 `<RESULT>SUCCESS</RESULT>` HTML 본문 반환 (미반환 시 3분 간격 10회 재시도)
- [ ] EUC-KR 응답 인코딩 유지
- [ ] 은행코드 3중 체계 (결제창 / 통지 2자리 / 취소 3자리) 매핑 일관성
- [ ] 파이프라인(`|`) 문자 금지 검증 (`orderNo`, `productName`, RESERVED*)

---

## 17. 환불 (입금후취소 · depositCancel)

**근거 매뉴얼**: `kiwoom_docs/키움 페이 메뉴얼/depositCancel/키움페이 입금후취소API.pdf` (V1.1) + `…/키움페이 입금후취소 통지매뉴얼.pdf` (V1.0)
**설계 스펙**: `docs/superpowers/specs/2026-04-21-deposit-cancel-unified-design.md`

신용카드(또는 간편결제) 취소 시 "상점의 취소가능 금액이 부족"(키움 코드 `9029`) 이 반환되면, 환불용 가상계좌를 발급받아 입금함으로써 취소를 확정하는 플로우를 **단일 리소스 `/v1/refunds`** 로 통합 제공합니다.

### 17.1 POST /v1/refunds — 환불 요청 생성

**인증**: combinedAuth (JWT 또는 API Key) + Idempotency

```json
{
  "originalDaouTrx": "CTS12345678901234",
  "service": "CARD",
  "cancelAmt": 10000
}
```

| 필드 | 타입 | 검증 |
|---|---|---|
| `originalDaouTrx` | string | 1~20자. 원 거래의 키움 DAOUTRX |
| `service` | string | `CARD` · `CARDK` · `KAKAOPAY` · `NAVERPAY` · `PAYCO` · `SAMSUNGPAY` 중 하나 (PDF §2.3.5) |
| `cancelAmt` | int64 | 1 ~ 9,999,999,999 (10자리 이내) |

**성공 응답 (200)**:
```json
{
  "success": true,
  "data": {
    "id": 123,
    "status": "ISSUED",
    "refundDaouTrx": "KWM20260421000789",
    "bankName": "국민은행",
    "accountNoMasked": "12*****7890",
    "depositAmt": "10000",
    "depositEndDate": "2026-04-21T23:59:59+09:00"
  }
}
```

**실패 매핑**:
- `400 VALIDATION_FAILED` — bind·enum·길이 위반
- `403 FORBIDDEN` — 원 거래의 소유자가 아닌 CallerID
- `404 NOT_FOUND` — OriginalDaouTrx 미존재
- `502 EXTERNAL_API_ERROR` — 키움 RESULTCODE ≠ 0000 (ERRORMESSAGE 전파)

**리셀러 경계**: 서버 CPID 는 응답에서 완전히 제외(`json:"-"`). AccountNo 는 평문 저장하되 JSON 응답은 `pkg/masking.MaskAccountNo` 로 마스킹된 `accountNoMasked` 만 노출.

### 17.2 GET /v1/refunds/:id — 단건 조회

**인증**: combinedAuth + CallerID scope. 본인 건만 조회됨 (cross-tenant 방지).

조회 시점에 `DepositEndDate < now AND Status = ISSUED` 이면 **lazy EXPIRED** 로 전이됩니다(Cron 과 이중 방어).

### 17.3 GET /v1/refunds — 리스트

**Query params**:
- `from`, `until` (RFC3339, 기본 최근 7일, 범위 상한 31일)
- `status` — ISSUED / DEPOSITED / FORWARDED / FORWARD_FAILED / EXPIRED
- `service` — CARD 등
- `pageSize` (기본 100, max 1000)
- `cursor` (base64-encoded `CreatedAt|ID` — 응답의 `nextCursor` 사용)

### 17.4 인바운드 통지 (키움 → 시드림)

`GET /notification/deposit-cancel` 은 PAYMETHOD 로 분기합니다:
- `CARD_CANCEL` → 신규 RefundService.MarkDeposited (DEPOSITED 전이 + 가맹점 포워딩).
- 기타 8개 취소 PAYMETHOD (BANK_CANCEL / KAKAOCANCEL / …) → 기존 범용 취소 통지 경로.
- 매뉴얼 외 PAYMETHOD → SystemEvent 기록 + SUCCESS 반환.

**가맹점 측**: 자사 WebhookURL 에 `deposit_cancel.deposited` 타입의 이벤트가 들어옵니다.
```json
{
  "type": "deposit_cancel.deposited",
  "data": {
    "refundDaouTrx": "KWM20260421000789",
    "amount": "10000",
    "cancelDate": "20260421143000"
  }
}
```

### 17.5 운영 메타

`GET /v1/refunds/notification-url` — 운영자 대시보드 전용. 현재 환경의 수신 URL, 키움 등록 여부, 등록 이메일 템플릿 힌트를 반환.

### 17.6 만료 정책

- 키움 PDF §2.5.4: `DEPOSITENDDATE` 는 발급 당일 23:59:59 고정.
- Cron `deposit-cancel-expiry` 가 매일 **KST 00:05** 에 `Status=ISSUED ∧ DepositEndDate<now` 를 일괄 `EXPIRED` 전이 + SystemEvent 발행.
- 조회 시점 lazy 전이도 병행 (이중 안전).

### 17.7 하위 호환

기존 `POST /v1/vaccount/deposit-cancel` 은 deprecation warn 로그를 남기고 기존 어댑터 직접 호출 경로를 유지합니다 (라이프사이클 row 미생성). 3개월 후 제거 예정 — 신규 연동은 `/v1/refunds` 사용.

### 17.8 회귀 방지 테스트 (CI fail-fast 포함)

```bash
go test ./internal/domain        -run TestDepositCancelRequest_JSONExcludesCPID
go test ./internal/domain        -run TestValidateDCRTransition
go test ./internal/domain        -run TestIsValidDepositCancelService
go test ./internal/service/refund -run TestRefundService_Create_CrossTenantRejected
go test ./internal/service/refund -run TestRefundService_MarkDeposited_HappyPath
go test ./internal/worker        -run TestDepositCancelExpiryJob
```

