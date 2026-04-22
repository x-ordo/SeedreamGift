# Cloudflare 인프라 설정 가이드

> 등록일: 2026-03-28 | 플랜: Free | 적용 대상: seedreamgift.com

## 인프라 구조 (Cloudflare 적용 후)

```
사용자 (HTTPS)
    ↓
Cloudflare (CDN, DDoS 방어, SSL 종료)
    ↓ Origin 연결 (HTTPS, Full Strict)
Server A — 103.97.209.205 (Windows Server)
    ├─ nginx :443 (리버스 프록시, SSL, 정적 파일)
    │   ├─ / → client SPA (정적 파일)
    │   ├─ /seedream_admin_portal/ → admin SPA
    │   ├─ /seedream_partner_portal/ → partner SPA
    │   └─ /api/* → 프록시 → Server B
    └─ :80 → 301 HTTPS 리다이렉트

Server B — 103.97.209.194 (Windows Server)
    └─ Go API :52201 (NSSM 서비스, 내부 전용) → Server C 연결

Server C — 103.97.209.131 (Windows Server)
    └─ MSSQL :7335 (Server B에서만 접근)
```

## 1. nginx 설정 변경 사항

### 1.1 Cloudflare 실제 IP 복원 (필수)

Cloudflare 프록시를 거치면 `$remote_addr`가 Cloudflare IP로 바뀌어
rate limiting, 로그, 보안 차단이 오작동합니다.

`nginx.conf`의 `http` 블록에 아래를 추가:

```nginx
# CF IP 목록: https://www.cloudflare.com/ips/
set_real_ip_from 173.245.48.0/20;
set_real_ip_from 103.21.244.0/22;
set_real_ip_from 103.22.200.0/22;
set_real_ip_from 103.31.4.0/22;
set_real_ip_from 141.101.64.0/18;
set_real_ip_from 108.162.192.0/18;
set_real_ip_from 190.93.240.0/20;
set_real_ip_from 188.114.96.0/20;
set_real_ip_from 197.234.240.0/22;
set_real_ip_from 198.41.128.0/17;
set_real_ip_from 162.158.0.0/15;
set_real_ip_from 104.16.0.0/13;
set_real_ip_from 104.24.0.0/14;
set_real_ip_from 172.64.0.0/13;
set_real_ip_from 131.0.72.0/22;
# IPv6
set_real_ip_from 2400:cb00::/32;
set_real_ip_from 2606:4700::/32;
set_real_ip_from 2803:f800::/32;
set_real_ip_from 2405:b500::/32;
set_real_ip_from 2405:8100::/32;
set_real_ip_from 2a06:98c0::/29;
set_real_ip_from 2c0f:f248::/32;
real_ip_header CF-Connecting-IP;
```

**동작 원리:**
- `set_real_ip_from` — 이 IP 대역에서 온 요청만 헤더를 신뢰 (화이트리스트)
- `real_ip_header CF-Connecting-IP` — Cloudflare가 설정한 실제 클라이언트 IP 헤더
- Cloudflare를 거치지 않는 요청 → 소스 IP가 CF 대역이 아님 → 헤더 무시, `$remote_addr` 유지
- **paysolus.kr은 Cloudflare를 걸지 않아도 안전** (IP 변조 불가)

### 1.2 paysolus.kr 보안 강화

paysolus.kr 서버 블록에 seedreamgift.com과 동일한 보안 차단 규칙 추가:
- 봇/스캐너 차단, dotfiles 차단, CMS/VPN/Docker 프로브 차단
- `ssl_stapling on` + `ssl_stapling_verify on` 추가
- `proxy_set_header Connection ""` keepalive 추가

## 2. Go 서버 설정 변경 사항

### 2.1 Trusted Proxy IP 추가

`.env.production`에 추가:

```env
TRUSTED_PROXY_IPS=103.97.209.205
```

- nginx(Server A)만 신뢰하면 됨
- Cloudflare IP는 nginx의 `real_ip_header`가 이미 처리하므로 Go에 추가 불필요
- Go 서버가 `X-Real-IP` 헤더에서 실제 클라이언트 IP를 정확히 읽을 수 있게 됨

### 2.2 Telegram 환경변수 키 수정

```env
# 수정 전 (버그): TELEGRAM_BOT_TOKEN=...
# 수정 후:
TELEGRAM_TOKEN=...
```

config.go가 `TELEGRAM_TOKEN`을 기대하므로 키 이름 일치 필요.

## 3. Cloudflare 대시보드 설정

### 3.1 SSL/TLS

| 설정 | 값 | 이유 |
|------|---|------|
| **SSL 모드** | **Full (Strict)** | Origin에 유효한 SSL 인증서 있음. Flexible 사용 시 무한 리다이렉트 발생 |
| Always Use HTTPS | On | nginx에도 HTTP→HTTPS 있으므로 중복이지만 문제없음 |
| Minimum TLS Version | 1.2 | nginx와 동일 |

### 3.2 캐싱

| 설정 | 값 | 이유 |
|------|---|------|
| Browser Cache TTL | Respect Existing Headers | nginx가 `/assets/` 1년, `index.html` no-cache로 이미 설정 |
| Cache Level | Standard | 기본값 유지 |

**Cache Rules (권장):**

```
Rule 1: /api/* → Bypass Cache
  이유: API 응답이 캐싱되면 인증/데이터 불일치

Rule 2: /assets/* → Cache Everything, Edge TTL 1 year
  이유: Vite content hash 기반, 파일명 변경 시 자동 무효화

Rule 3: / → Bypass Cache
  이유: SPA index.html은 항상 최신 버전 필요
```

### 3.3 보안

| 설정 | 값 | 이유 |
|------|---|------|
| Bot Fight Mode | On | nginx 봇 차단과 이중 방어 |
| Security Level | Medium | 기본값 적절 |
| Challenge Passage | 30 minutes | 기본값 |

### 3.4 Speed

| 설정 | 값 | 이유 |
|------|---|------|
| Auto Minify | JS, CSS, HTML 모두 Off | Vite가 이미 minify 처리, 이중 처리 시 오류 가능 |
| Brotli | On | Gzip보다 압축률 높음, nginx Gzip과 공존 가능 |

## 4. 배포 순서

```
1. nginx.conf → Server A에 복사
   > nginx -t            # 설정 검증
   > nginx -s reload     # 적용

2. .env.production → Server B에 복사
   > nssm stop SeedreamGiftAPI
   > copy .env.production C:\deploy-server\seedream-api\.env
   > nssm start SeedreamGiftAPI

3. Cloudflare 대시보드
   - SSL: Full (Strict) 설정
   - Cache Rules 3개 추가
   - DNS A 레코드: seedreamgift.com → 103.97.209.205 (프록시 활성화, 주황 구름)
```

## 5. 검증 체크리스트

배포 후 확인:

- [ ] `curl -I https://seedreamgift.com` → `cf-ray` 헤더 존재 확인 (Cloudflare 경유 확인)
- [ ] `curl -I https://seedreamgift.com` → `strict-transport-security` 헤더 확인
- [ ] 로그인/회원가입 정상 동작 (쿠키, CORS)
- [ ] Server B 로그에서 실제 클라이언트 IP 확인 (Cloudflare IP가 아닌 것)
- [ ] API rate limiting 정상 동작 (특정 IP만 차단, 전체 차단 아닌 것)
- [ ] paysolus.kr 정상 접속 (Cloudflare 미적용 상태에서 영향 없는 것)
- [ ] 텔레그램 에러 알림 수신 확인 (`TELEGRAM_TOKEN` 키 수정 후)

## 6. paysolus.kr Cloudflare 적용 여부

현재 paysolus.kr은 Cloudflare **미적용** 상태이며, **적용하지 않아도 안전합니다.**

`set_real_ip_from`은 화이트리스트 방식이므로:
- Cloudflare를 거치지 않는 요청 → 소스 IP가 CF 대역 아님 → `CF-Connecting-IP` 헤더 무시
- `$remote_addr`가 실제 클라이언트 IP 그대로 유지

트래픽이 늘거나 DDoS 방어가 필요하면 Cloudflare Free에 추가 등록하면 됩니다.

## 7. Cloudflare IP 업데이트 주기

Cloudflare IP 대역은 드물게 변경됩니다. **반기 1회** 확인 권장:

```
확인: https://www.cloudflare.com/ips/
갱신: nginx.conf의 set_real_ip_from 블록 업데이트 후 reload
```
