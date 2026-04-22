# 이메일 + 카카오 알림톡 통합 알림 시스템 설계

## 1. 개요

거래 상태 변경 시 고객에게 **카카오 알림톡(즉시) + 이메일(상세)** 을 동시 발송하는 통합 알림 시스템.

## 2. 채널별 역할

| 채널 | 역할 | 도달률 |
|------|------|--------|
| 카카오 알림톡 | 즉시 알림 (간결) | 99%+ |
| 이메일 | 상세 영수증/기록 | 70-80% |
| 텔레그램 | 운영자 내부 알림 | 기존 유지 |

## 3. 트랜잭션별 알림 매트릭스

| 이벤트 | 카카오 | 이메일 | 텔레그램 |
|--------|:------:|:------:|:--------:|
| 회원가입 환영 | O | O | - |
| 비밀번호 재설정 | - | O | - |
| 주문 접수 | O | O | O |
| 결제 완료 | O | O (영수증) | - |
| PIN 발급 | O | O (PIN목록) | - |
| 주문 취소 | O | O | O |
| 매입 신청 | O | O | O |
| 매입 정산 완료 | O | O | - |

## 4. 기술 구조

```
pkg/notification/notification.go  — 통합 알림 서비스 (이벤트별 함수)
pkg/kakao/client.go               — 카카오 비즈메시지 API 클라이언트
pkg/kakao/alimtalk.go             — 알림톡 발송 함수
pkg/email/email.go                — 기존 이메일 (수정 불필요)
pkg/telegram/telegram.go          — 기존 텔레그램 (수정 불필요)
```

### NotificationService

```go
type NotificationService struct {
    email    *email.Service
    kakao    *kakao.Client
    telegram struct{ token, chatID string }
}

func (n *NotificationService) OrderCreated(order, user)        // 주문 접수
func (n *NotificationService) PaymentConfirmed(order, user)    // 결제 완료
func (n *NotificationService) DeliveryComplete(order, pins)    // PIN 발급
func (n *NotificationService) OrderCancelled(order, user)      // 주문 취소
func (n *NotificationService) TradeInSubmitted(tradeIn, user)  // 매입 접수
func (n *NotificationService) TradeInPaid(tradeIn, user)       // 매입 정산
func (n *NotificationService) Welcome(user)                    // 회원가입
```

각 함수 내부에서 이메일 + 카카오 + 텔레그램을 **비동기 병렬** 발송.

### 카카오 알림톡 API

```go
type Client struct {
    senderKey string  // 카카오 비즈니스 채널 발신 키
    apiKey    string  // 카카오 비즈메시지 API 키
    baseURL   string  // API 엔드포인트
}

func (c *Client) SendAlimtalk(phone, templateCode string, variables map[string]string) error
```

### SiteConfig 키

| 키 | 기본값 | 설명 |
|----|--------|------|
| `KAKAO_ALIMTALK_ENABLED` | false | 알림톡 활성화 |
| `KAKAO_SENDER_KEY` | "" | 발신 프로필 키 |
| `KAKAO_API_KEY` | "" | 비즈메시지 API 키 |

## 5. 수정 대상 파일

### 신규 생성
- `pkg/kakao/client.go` — 카카오 API 클라이언트
- `pkg/kakao/alimtalk.go` — 알림톡 템플릿별 발송
- `pkg/notification/notification.go` — 통합 알림 서비스

### 수정
- `internal/routes/container.go` — NotificationService 생성 및 주입
- `internal/api/handlers/order_handler.go` — 개별 이메일/텔레그램 → NotificationService 호출로 교체
- `internal/api/handlers/tradein_handler.go` — 동일
- `internal/api/handlers/admin_order_handler.go` — 동일
- `internal/api/handlers/auth_handler.go` — 회원가입 환영 + 비밀번호 재설정

## 6. 검증

1. `go build ./...` 빌드 확인
2. 카카오 API 키 미설정 시 알림톡만 건너뛰고 이메일/텔레그램은 정상 발송
3. 각 이벤트에서 3채널 비동기 발송 확인 (로그)
