# 씨드림기프트 빌드 & 배포 가이드

## 프로젝트 구조

```
seedream-gift/
├── client/          → seedreamgift.com (고객 SPA)
├── admin/           → seedreamgift.com/seedream_admin_portal/ (관리자 SPA, client에 통합 배포)
├── go-server/       → Go API (Server B에서 실행)
│   ├── main.go      ← 진입점 (루트에 위치 — Wails 요구사항)
│   ├── frontend/    ← Wails 관리 콘솔 React 앱
│   ├── wails.json   ← Wails 빌드 설정
│   └── .env.production ← 프로덕션 환경 설정
├── config/
│   └── nginx/nginx.conf ← Server A nginx 설정 (원본)
├── scripts/
│   ├── deploy-all.ps1   ← 통합 배포 스크립트
│   ├── deploy-client.ps1 ← client+admin 개별 빌드
│   └── deploy-go-server.ps1 ← Go API 개별 빌드
└── deploy/          ← 생성된 ZIP 패키지
```

## 서비스 현황

| 서비스 | 서버 | 외부 포트 | 내부 | URL |
|--------|------|----------|------|-----|
| 고객 SPA | 103.97.209.205 | 443 | nginx 정적 파일 | seedreamgift.com |
| 관리자 SPA | 103.97.209.205 | 443 | nginx 정적 파일 | seedreamgift.com/seedream_admin_portal/ |
| Go API | 103.97.209.194 | 443 | **52201** (Go exe) | 내부 프록시 전용 |
| MSSQL | 103.97.209.131 | — | 7335 | — |

> admin은 별도 서브도메인이 아닌 **같은 도메인 하위 경로**로 서빙. SSL 인증서 추가 불필요.
> API는 외부 도메인 없이 **nginx 프록시(`/api/`)로만 접근**. 프론트엔드가 직접 호출하지 않음.

## 인프라 구성

```
              외부 요청 (:443 HTTPS)
                    │
                    ▼
              seedreamgift.com
                    │
    ┌───────────────┴───────────────┐
    │ Server A: 103.97.209.205     │
    │                               │
    │ nginx :443                    │
    │  ├─ /                         │
    │  │   → client/ 정적 서빙     │
    │  ├─ /seedream_admin_portal/           │
    │  │   → client/seedream_admin_portal/  │
    │  └─ /api/                     │
    │      → proxy ─────────────────┼──→ Server B
    └───────────────────────────────┘    103.97.209.194
                                         │
                                    ┌────┴────────┐
                                    │ Go API      │
                                    │  :52201     │
                                    └──────┬──────┘
                                           │ MSSQL 연결
                                           ▼
                                    ┌─────────────┐
                                    │ Server C    │
                                    │ 103.97.209.131 │
                                    │ MSSQL :7335 │
                                    └─────────────┘
```

---

## 1. 로컬 개발 환경

### 필수 도구

| 도구 | 버전 | 용도 |
|------|------|------|
| Go | ≥ 1.21 | API 서버 빌드 |
| Node.js | ≥ 20 | 프론트엔드 빌드 |
| pnpm | ≥ 9 | 패키지 매니저 |
| Wails CLI | v2.x | GUI 관리 콘솔 빌드 (선택) |

### 개발 서버 실행

```powershell
# API 서버 (헤드리스)
cd go-server
$env:HEADLESS="true"
go run .

# 클라이언트 (포트 5173)
pnpm dev:client

# 어드민 (포트 5174)
pnpm dev:admin
```

---

## 2. 빌드

### 2-A. 자동 빌드 (권장)

```powershell
# 전체 빌드 (client + admin + Go API)
.\scripts\deploy-all.ps1

# 개별 빌드
.\scripts\deploy-all.ps1 -Target client    # client만 (admin 미포함)
.\scripts\deploy-all.ps1 -Target admin     # admin만 (client dist에 병합)
.\scripts\deploy-all.ps1 -Target api       # Go API만

# 의존성 설치 생략
.\scripts\deploy-all.ps1 -SkipInstall
```

생성되는 파일:
```
deploy/
├── client-YYYYMMDD-HHmmss.zip   # ~5 MB (client + admin 통합) → Server A
└── api-YYYYMMDD-HHmmss.zip      # ~13 MB → Server B
```

> **admin은 별도 ZIP이 아닌 client ZIP에 포함됩니다.**
> 빌드 시 `admin/dist/` → `client/dist/seedream_admin_portal/`로 자동 병합.

### 2-B. 수동 빌드

```powershell
# 1. Client 빌드
cd client && pnpm build

# 2. Admin 빌드 + Client에 병합
cd admin && pnpm build
Copy-Item -Path admin\dist -Destination client\dist\seedream_admin_portal -Recurse -Force

# 3. ZIP 생성
Compress-Archive -Path client\dist\* -DestinationPath deploy\client-latest.zip -Force
```

### 2-C. Go API 빌드 (반드시 Wails 사용)

```powershell
cd go-server
wails build -platform windows/amd64 -ldflags "-s -w"
# → build/bin/seedream-api.exe 생성
```

> **주의**: `go build .`는 사용 금지. Wails 프론트엔드 임베딩이 누락됩니다.
> `main.go`가 go-server 루트에 위치해야 합니다 (Wails 요구사항).

---

## 3. 배포

### 3-A. Server A 배포 (103.97.209.205 — 프론트엔드)

```powershell
# RDP로 103.97.209.205 접속 후:

# 1. client ZIP 압축 해제 (admin 포함)
Expand-Archive client-*.zip -DestinationPath C:\deploy-server\seedream-gift\client -Force

# 끝. nginx가 즉시 반영 — 재시작 불필요.
```

> - 고객 사이트: https://seedreamgift.com
> - 관리자: https://seedreamgift.com/seedream_admin_portal/

### 3-B. Server B 배포 (103.97.209.194 — Go API)

```powershell
# RDP로 103.97.209.194 접속 후:

nssm stop SeedreamGiftAPI
Expand-Archive api-*.zip -DestinationPath C:\deploy-server\seedream-api -Force
nssm start SeedreamGiftAPI

# 헬스체크
curl http://127.0.0.1:52201/health
```

### 3-C. 첫 배포 시 추가 작업

#### Server B — NSSM 서비스 등록

```powershell
nssm install SeedreamGiftAPI C:\deploy-server\seedream-api\seedream-api.exe
nssm set SeedreamGiftAPI AppDirectory C:\deploy-server\seedream-api
nssm set SeedreamGiftAPI AppEnvironmentExtra HEADLESS=true GIN_MODE=release
nssm set SeedreamGiftAPI DisplayName "SEEDREAM-GIFT Go API Server"
nssm set SeedreamGiftAPI Start SERVICE_AUTO_START
nssm start SeedreamGiftAPI
```

---

## 4. DNS 설정 (가비아)

| 타입 | 호스트 | 값 | TTL |
|------|--------|------|-----|
| A | `@` | 103.97.209.205 | 3600 |
| A | `www` | 103.97.209.205 | 3600 |
| A | `api` | 103.97.209.194 | 600 |

> `admin` 서브도메인 DNS는 **불필요** (같은 도메인 경로 사용).

---

## 5. SSL 인증서

Server A: GlobalSign 인증서 (`seedreamgift.com`, `www.seedreamgift.com`)
- 경로: `C:/nginx/ssl/seedreamgift.com/`
- admin은 같은 도메인이므로 추가 인증서 불필요

Server B: 외부 직접 접근 없음 (nginx 프록시만) → SSL 선택사항

---

## 6. nginx 설정

실제 설정 파일: `config/nginx/nginx.conf`

핵심 구조:
```nginx
upstream goapi {
    server 103.97.209.194:52201;
    keepalive 32;
}

server {
    listen 443 ssl;
    server_name seedreamgift.com www.seedreamgift.com;

    root C:/deploy-server/seedream-gift/client;

    # Client SPA 자산
    location /assets/ { expires 1y; add_header Cache-Control "public, immutable"; }

    # API → Go 서버
    location /api/ { proxy_pass http://goapi; ... }

    # Admin SPA (같은 도메인 하위 경로)
    location /seedream_admin_portal/ { try_files $uri $uri/ /seedream_admin_portal/index.html; }

    # Client SPA fallback
    location / { try_files $uri $uri/ /index.html; }
}
```

---

## 7. 환경 변수

### Go 서버 (.env.production → 배포 시 .env)

```env
DATABASE_URL=sqlserver://...
JWT_SECRET=<비밀키>
ENCRYPTION_KEY=<암호화키>
PORT=52201
GIN_MODE=release
HEADLESS=true

JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=168h

COOKIE_SECURE=true
COOKIE_DOMAIN=.seedreamgift.com

FRONTEND_URL=https://seedreamgift.com
ADMIN_URL=https://seedreamgift.com
```

> `ADMIN_URL`은 같은 도메인 (서브도메인 아님)

### Client (.env.production)

```env
VITE_API_URL=/api/v1
```

> 상대 경로 — nginx가 Go 서버로 프록시

---

## 8. 배포 후 검증

```powershell
# 고객 사이트
curl -I https://seedreamgift.com

# 관리자 사이트
curl -I https://seedreamgift.com/seedream_admin_portal/

# API (nginx 프록시 경유)
curl https://seedreamgift.com/api/v1/brands

# 보안 헤더
curl -I https://seedreamgift.com
# Strict-Transport-Security, X-Content-Type-Options, X-Frame-Options

# 봇 차단
curl -I https://seedreamgift.com/.env              # → 444
curl -I https://seedreamgift.com/wp-admin           # → 444
```

---

## 9. 운영

```powershell
# Go API 로그
Get-Content C:\deploy-server\seedream-api\logs\api.log -Tail 50 -Wait

# 서비스 제어
nssm status SeedreamGiftAPI
nssm restart SeedreamGiftAPI
```

---

## 10. 방화벽

### Server A (103.97.209.205)

```powershell
New-NetFirewallRule -DisplayName "HTTP" -Direction Inbound -Protocol TCP -LocalPort 80 -Action Allow
New-NetFirewallRule -DisplayName "HTTPS" -Direction Inbound -Protocol TCP -LocalPort 443 -Action Allow
```

### Server B (103.97.209.194 — Go API)

```powershell
New-NetFirewallRule -DisplayName "HTTPS" -Direction Inbound -Protocol TCP -LocalPort 443 -Action Allow
New-NetFirewallRule -DisplayName "SEEDREAM-GIFT API" -Direction Inbound -Protocol TCP -LocalPort 52201 -RemoteAddress 127.0.0.1,103.97.209.205 -Action Allow
```

### Server C (103.97.209.131 — MSSQL)

```powershell
# MSSQL 포트는 Server B(Go API)에서만 접근 허용
New-NetFirewallRule -DisplayName "MSSQL" -Direction Inbound -Protocol TCP -LocalPort 7335 -RemoteAddress 103.97.209.194 -Action Allow
```

---

## 빠른 참조

| 작업 | 명령어 |
|------|--------|
| 전체 빌드 | `.\scripts\deploy-all.ps1` |
| API만 빌드 | `.\scripts\deploy-all.ps1 -Target api -SkipInstall` |
| 개발 서버 | `pnpm dev:client` / `pnpm dev:admin` |
| Go 개발 | `cd go-server && $env:HEADLESS="true" && go run .` |
| Server A 배포 | `Expand-Archive client-*.zip -Dest C:\deploy-server\seedream-gift\client -Force` |
| Server B 배포 | `nssm stop` → ZIP 풀기 → `nssm start` |
| 고객 사이트 | https://seedreamgift.com |
| 관리자 | https://seedreamgift.com/seedream_admin_portal/ |
