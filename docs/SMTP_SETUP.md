# SMTP 이메일 설정 가이드

W기프트 서버의 이메일 발송 기능 설정 방법입니다.

## 지원 기능

| 기능 | 설명 |
|------|------|
| 비밀번호 재설정 | `/forgot-password` 요청 시 재설정 링크 이메일 발송 |
| 주문 접수 확인 | 주문 완료 시 주문번호/결제금액 안내 이메일 |
| 매입 신청 확인 | 판매 신청 시 상품/예상 정산액 안내 이메일 |

---

## 1. Gmail SMTP 설정 (권장)

### 1-1. Google 앱 비밀번호 생성

Gmail은 보안 정책상 일반 비밀번호로 SMTP 로그인이 차단됩니다.
반드시 **앱 비밀번호**를 생성해야 합니다.

1. https://myaccount.google.com/security 접속
2. **2단계 인증** 활성화 (이미 활성화되어 있으면 건너뛰기)
3. https://myaccount.google.com/apppasswords 접속
4. 앱 이름에 `WowGift` 입력 후 **만들기** 클릭
5. 생성된 **16자리 비밀번호** 복사 (예: `abcd efgh ijkl mnop`)

### 1-2. 환경 변수 설정

`go-server/.env` (개발) 또는 `go-server/.env.production` (프로덕션)에 추가:

```env
SMTP_ENABLED=true
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-gmail@gmail.com
SMTP_PASSWORD=abcdefghijklmnop
SMTP_FROM=noreply@wowgift.co.kr
SMTP_FROM_NAME=W기프트
```

| 변수 | 설명 | 예시 |
|------|------|------|
| `SMTP_ENABLED` | 이메일 발송 활성화 여부 | `true` / `false` |
| `SMTP_HOST` | SMTP 서버 주소 | `smtp.gmail.com` |
| `SMTP_PORT` | SMTP 서버 포트 (STARTTLS) | `587` |
| `SMTP_USER` | 로그인 계정 (Gmail 주소) | `wowgift.noreply@gmail.com` |
| `SMTP_PASSWORD` | 앱 비밀번호 (띄어쓰기 제거) | `abcdefghijklmnop` |
| `SMTP_FROM` | 발신자 이메일 (표시용) | `noreply@wowgift.co.kr` |
| `SMTP_FROM_NAME` | 발신자 이름 (표시용) | `W기프트` |

### 1-3. 서버 재시작

```bash
# 개발 환경
cd go-server && go run .

# 프로덕션 (NSSM 서비스)
nssm restart WowGiftAPI
```

---

## 2. 다른 SMTP 서비스 사용 시

### Naver Mail

```env
SMTP_HOST=smtp.naver.com
SMTP_PORT=587
SMTP_USER=your-id@naver.com
SMTP_PASSWORD=네이버 비밀번호
```

네이버 메일 설정 > POP3/SMTP 사용 활성화 필요

### Amazon SES (대량 발송 권장)

```env
SMTP_HOST=email-smtp.ap-northeast-2.amazonaws.com
SMTP_PORT=587
SMTP_USER=AWS_ACCESS_KEY_ID
SMTP_PASSWORD=AWS_SECRET_ACCESS_KEY
```

SES 콘솔에서 발신 도메인 인증 + 프로덕션 전환 필요

### SendGrid

```env
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASSWORD=SG.xxxxxxxxxxxxxxxx
```

---

## 3. 테스트

### 비밀번호 재설정 테스트

1. `.env`에서 `SMTP_ENABLED=true` 설정
2. 서버 재시작
3. 브라우저에서 `/forgot-password` 접속
4. 가입된 이메일 주소 입력
5. 이메일 수신함(스팸함 포함) 확인
6. "비밀번호 재설정하기" 버튼 클릭 → `/reset-password` 페이지로 이동

### 로그 확인

이메일 발송 결과는 서버 로그에 기록됩니다:

```
# 성공
INFO  email sent  {"to": "user@example.com", "subject": "[W기프트] 비밀번호 재설정 안내"}

# SMTP 비활성 상태
WARN  email not sent: SMTP disabled  {"to": "user@example.com"}

# 발송 실패
ERROR failed to send email  {"to": "user@example.com", "error": "..."}
```

---

## 4. 주의사항

| 항목 | 내용 |
|------|------|
| Gmail 일일 한도 | 무료 계정: 500건/일, Workspace: 2,000건/일 |
| 발신자 표시 | `SMTP_FROM`과 실제 Gmail 주소가 다르면 수신자에게 "via gmail.com"으로 표시될 수 있음 |
| 스팸 방지 | 커스텀 도메인 사용 시 SPF, DKIM, DMARC 레코드 설정 권장 |
| 보안 | `.env` 파일은 절대 git에 커밋하지 말 것 (`.gitignore`에 포함 확인) |
| TLS | 포트 587은 STARTTLS 자동 적용 (Go `net/smtp` 내장) |
| 프로덕션 | 일일 500건 이상 필요 시 Amazon SES, SendGrid, Mailgun 등 전용 서비스 사용 권장 |

---

## 5. 파일 구조

```
go-server/
├── .env                          # 개발용 SMTP 설정
├── .env.production               # 프로덕션 SMTP 설정
├── internal/config/config.go     # SMTP 설정 필드 정의 + 기본값
├── pkg/email/email.go            # EmailService (SMTP 발송 로직)
└── internal/api/handlers/
    └── auth_handler.go           # ForgotPassword에서 EmailService 호출
```
