# 상품권 도메인 전문가 검수 결과 & 로드맵

> 2026-03-23 검수 기준. SMS_VERIFICATION 테이블 = PASS KYC 인증 데이터.

## 현재 평가: 3.5/5

### 잘 된 점
- 트랜잭션 안전성 (UPDLOCK + 멱등성 키)
- 가격 모델 (price → discountRate → buyPrice → tradeInRate)
- KYC 인프라 (1원 인증 + PASS 본인인증 via SMS_VERIFICATION)
- AES-256 암호화, bcrypt, JWT HttpOnly 쿠키
- Rate limiting + 브루트포스 방어

---

## ✅ 이번 세션에서 완료된 항목

| # | 항목 | 상태 |
|---|------|------|
| P1-6 | PIN 평문 노출 차단 (마스킹) | ✅ 완료 |
| Schema | Order: PaymentDeadlineAt, WithdrawalDeadlineAt, DigitalDeliveryAt | ✅ 완료 |
| Schema | TradeIn: VerifiedByAdminId, VerificationMethod, AmlRiskScore, PaymentRefNumber 등 | ✅ 완료 |
| Schema | VoucherCode: Source, IssuerVerifiedAt, DisputedAt, DisputeReason 등 | ✅ 완료 |
| Schema | Product: Denomination, MinPurchaseQty, MaxPurchaseQty, IssuerId | ✅ 완료 |
| Schema | User: CustomLimitPerMonth, CustomLimitPerYear | ✅ 완료 |
| 한도 | 월간(5천만원)/연간(2억원) 구매 한도 서버 검증 | ✅ 완료 |
| SQL | `scripts/schema-domain-upgrade.sql` 마이그레이션 스크립트 | ✅ 생성됨 (미실행) |

---

## 📋 추후 진행 로드맵

### P1: 법적/규제 리스크 (반드시 수정)

#### 1. PIN 발급사 검증 연동 (4-6주)
- **현재**: 매입 시 PIN 유효성 미검증 (해시 중복만 체크)
- **필요**: 신한카드, BC네트웍스 등 발급사 API 연동
- **작업**:
  - 발급사별 API 스펙 확보
  - `IssuerValidationService` 구현
  - VoucherCode.IssuerVerifiedAt 활용
  - TradeIn 제출 시 자동 검증 → 수동 대비 처리 시간 90% 단축
- **비용**: API 연동 계약 필요

#### 2. 청약철회 7일 시행 (2-3주)
- **현재**: WithdrawalDeadlineAt 필드 추가됨 (미사용)
- **필요**:
  - 7일 이내 환불 요청 자동 승인 로직
  - PIN 미사용 여부 확인 (발급사 API 연동 후)
  - 환불 → 원래 결제수단 반환
  - UI: 마이페이지 주문 상세에 "청약철회 기한: D-5" 표시
- **법적 근거**: 전자상거래법 §17

#### 3. 의심거래보고 STR/CTR (1-2주)
- **현재**: 미구현
- **필요**:
  - 2천만원 이상 거래 자동 CTR 기록
  - 패턴 탐지 (같은 IP에서 다수 계정, 단기간 대량 매입 등)
  - ComplianceReport 모델 추가
  - 관리자 대시보드에 "의심거래" 탭
- **법적 근거**: 특정금융거래정보법

#### 4. 현금영수증 연동 (1주)
- **현재**: CashReceiptNumber 필드만 존재, 국세청 API 미연동
- **필요**:
  - 국세청 현금영수증 발급 API 연동 (또는 PG사 통한 자동 발급)
  - CashReceiptIssuedAt, CashReceiptProvider 필드 추가
  - 결제 시 "현금영수증 발급" 자동 처리
- **대안**: PG사(토스페이먼츠) 연동 시 자동 발급됨

#### 5. 실명인증 강화 (2주)
- **현재**: SMS_VERIFICATION 테이블 = PASS 본인인증 (CI 저장)
- **추가 필요**:
  - User.CI 필드 연동 (SMS_VERIFICATION._CI 값 매핑)
  - User.RealNameVerifiedAt 필드 활용
  - 100만원 이상 거래 시 실명인증 필수 강제
  - CI 기반 중복 계정 탐지

### P2: 경쟁력 개선 (빠른 개선 필요)

#### 7. 브랜드 확장 (1-2주)
- **현재**: 신세계, 현대, 롯데, 다이소, 올리브영 (5개)
- **추가 우선순위**:
  1. 문화상품권 (문예진흥기금) — 시장 점유율 최대
  2. 해피머니 (GS Networks) — 편의점 유통
  3. 신한카드 상품권 — 금융권 유통
- **작업**: DB Brand 테이블에 추가 + 프론트엔드 brandTheme 확장

#### 8. 매입 실시간 검증 (4-6주)
- P1-1(발급사 API) 완료 후 진행
- 매입 신청 → 즉시 검증 → 자동 승인 → 당일 정산
- 경쟁사(yk24) 대비 핵심 차별점

#### 9. 모바일 바코드/QR (완료 대기)
- **스키마**: VoucherCode에 GiftNumber + PinCode 이미 존재
- **필요**: 프론트엔드에 QR/바코드 컴포넌트 추가
- **라이브러리**: `qrcode.react` (React QR 생성)
- **위치**: MyPage 주문 상세 → PIN 표시 옆에 QR 버튼

#### 10. 잔액 조회 (발급사 API 의존)
- P1-1(발급사 API) 완료 후 진행
- `GET /vouchers/:id/balance` 엔드포인트 추가
- 발급사 API로 실시간 잔액 확인

#### 11. B2B 기능 (3-4주)
- **스키마**: PARTNER 역할 이미 존재
- **필요**:
  - 파트너 전용 대시보드 (대량 주문, 월간 정산)
  - CSV 대량 주문 업로드
  - 월간 세금계산서 자동 발행
  - Net-30 후불 결제 지원
  - 전용 할인율 (User.PartnerTier 활용)

### P3: 차별화 기능 (Nice-to-have)

| 기능 | 설명 | 예상 소요 |
|------|------|----------|
| 동적 매입가 | 시장 수요/공급 기반 자동 조정 | 2주 |
| PIN 분실 보험 | 유료 옵션, 분실 시 재발급 | 3주 |
| 선물 포장/카드 | GiftWrapOption, GreetingCardTemplate | 1주 |
| 정기 구매 | Subscription 모델 + 크론 자동 주문 | 3주 |
| 유효기간 알림 | 만료 30일 전 이메일 알림 | 1주 |
| 가격 보장제 | 7일 이내 차액 반환 정책 | 2주 |
| 모바일 앱 | React Native / Flutter | 8-12주 |

---

## 데이터베이스 참고

### SMS_VERIFICATION 테이블 (PASS KYC)
- `_UNIQUEID` — 고유 인증 ID
- `_PHONE` — 인증된 전화번호
- `_CI` — 개인 고유 식별자 (Common Info)
- `_BANKCODE`, `_BANKNUMBER`, `_BANKUSER` — 인증된 계좌 정보
- `_BIRTH`, `_GENDER`, `_NATIONALITY` — 개인정보
- `_DATETIME` — 인증 시점

### 신규 마이그레이션 (미실행)
- `scripts/schema-domain-upgrade.sql` — Order, TradeIn, VoucherCode, Product, User 필드 추가
- 실행 전 반드시 DB 백업 필수

---

## 타임라인 요약

```
즉시    : P1-6 PIN 마스킹 ✅, 스키마 업데이트 ✅, 월/연 한도 ✅
1-2주   : 현금영수증, 브랜드 확장, 유효기간 알림
2-4주   : 청약철회 시행, 실명인증 강화, STR/CTR
4-8주   : 발급사 API 연동, 실시간 매입 검증, B2B
8-12주  : 모바일 앱, 동적 매입가, 정기 구매
```
