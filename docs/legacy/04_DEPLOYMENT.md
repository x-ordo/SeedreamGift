> **[Legacy] 레거시 참조용** — 이 문서는 구 W Gift(wowgift.co.kr) 시절 작성되었으며 역사 보존 목적으로만 유지됩니다. 현재 시스템은 Seedream Gift(seedreamgift.com)입니다.

# 04. Deployment & Operations

## 1. 배포 환경

### 1.1 환경 구성

| 환경 | OS | 경로/URL |
|------|-----|----------|
| **Development** | Windows | `C:\Dev\httrack_download_pages\wow-gift` |
| **Production** | Windows Server | `C:\deploy-server\w-gift` |
| **Service URL** | - | https://wowgift.co.kr |

### 1.2 배포 방식

```
개발 PC                              운영 서버
┌────────────────────┐              ┌────────────────────┐
│ 1. 코드 작성       │              │                    │
│ 2. pnpm build      │    RDP      │ C:\deploy-server\  │
│ 3. 패키지 생성     │ ──────────▶ │   wow-gift\        │
│    (ZIP)           │    복사     │                    │
└────────────────────┘              └────────────────────┘
```

---

## 2. 빠른 배포 가이드

### 2.1 개발 PC에서 패키지 생성

```powershell
cd C:\Dev\httrack_download_pages\wow-gift
.\scripts\build-package.ps1
# → deploy\deploy-package-{timestamp}.zip 생성
```

### 2.2 운영 서버에서 설치

```powershell
# 1. 압축 해제
Expand-Archive -Path "C:\Temp\deploy-package-*.zip" -DestinationPath "C:\deploy-server\w-gift" -Force

# 2. 환경 변수 설정 (최초 1회)
cd C:\deploy-server\wow-gift
Copy-Item server\.env.example server\.env
notepad server\.env

# 3. 의존성 설치
pnpm install --prod --filter server

# 4. 서버 시작
.\start.ps1
```

---

## 3. 상세 배포 절차

### 3.1 개발 PC 작업

#### Step 1: 코드 빌드
```powershell
cd C:\Dev\httrack_download_pages\wow-gift
pnpm build
```

#### Step 2: 배포 패키지 생성
```powershell
.\scripts\build-package.ps1
```

**결과물**: `deploy\deploy-package-YYYYMMDD-HHMMSS.zip` (~10MB)

**패키지 내용**:
```
deploy-package-*.zip
├── ecosystem.config.js      # PM2 설정 (PORT=5140)
├── package.json
├── pnpm-lock.yaml
├── pnpm-workspace.yaml
├── start.ps1                # 시작 스크립트
├── server/
│   ├── dist/                # 컴파일된 NestJS
│   ├── public/              # 컴파일된 React
│   ├── prisma/              # DB 스키마
│   ├── src/shared/prisma/generated/  # Prisma Client
│   ├── package.json
│   └── .env.example
└── logs/
```

### 3.2 운영 서버 작업

#### Step 1: RDP 접속
```
mstsc /v:103.97.209.205
```

#### Step 2: 파일 복사
- RDP 드라이브 공유로 ZIP 파일 복사
- 또는 네트워크 공유 폴더 사용

#### Step 3: 기존 서버 중지 (업데이트 시)
```powershell
pm2 stop w-gift-server
```

#### Step 4: 압축 해제
```powershell
Expand-Archive -Path "C:\Temp\deploy-package-*.zip" -DestinationPath "C:\deploy-server\wow-gift" -Force
```

#### Step 5: 환경 변수 설정 (최초 1회)
```powershell
cd C:\deploy-server\wow-gift
Copy-Item server\.env.example server\.env
notepad server\.env
```

**server\.env 내용**:
```env
DATABASE_URL="sqlserver://localhost:1433;database=wgift;user=sa;password=YourPassword;encrypt=true;trustServerCertificate=true"
JWT_SECRET=your-64-character-random-string
ENCRYPTION_KEY=another-64-character-random-string
PORT=5140
PAYMENT_GATEWAY=mock
```

**키 생성**:
```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

#### Step 6: 의존성 설치
```powershell
pnpm install --prod --filter server
```

#### Step 7: 서버 시작
```powershell
.\start.ps1
```

---

## 4. 운영 서버 초기 설정 (최초 1회)

### 4.1 필수 소프트웨어

```powershell
# 관리자 PowerShell

# Node.js 20 LTS
winget install OpenJS.NodeJS.LTS

# pnpm
npm install -g pnpm

# PM2
npm install -g pm2

# PM2 Windows Service (재부팅 시 자동 시작)
npm install -g pm2-windows-service
pm2-service-install -n PM2
```

### 4.2 방화벽

```powershell
New-NetFirewallRule -DisplayName "WowGift HTTP" -Direction Inbound -Port 80 -Protocol TCP -Action Allow
New-NetFirewallRule -DisplayName "WowGift HTTPS" -Direction Inbound -Port 443 -Protocol TCP -Action Allow
```

### 4.3 디렉토리 생성

```powershell
New-Item -ItemType Directory -Force -Path "C:\deploy-server\wow-gift"
New-Item -ItemType Directory -Force -Path "C:\deploy-server\wow-gift\logs"
```

---

## 5. PM2 관리

### 5.1 기본 명령어

```powershell
pm2 status                    # 상태 확인
pm2 logs w-gift-server        # 로그 확인
pm2 logs w-gift-server --lines 100
pm2 logs w-gift-server --err  # 에러 로그만
pm2 restart w-gift-server     # 재시작
pm2 stop w-gift-server        # 중지
pm2 delete w-gift-server      # 삭제
pm2 monit                     # 실시간 모니터링
pm2 save                      # 설정 저장
```

### 5.2 ecosystem.config.js

```javascript
module.exports = {
  apps: [{
    name: 'w-gift-server',    // PM2 프로세스 이름
    script: './server/dist/src/main.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    wait_ready: true,
    listen_timeout: 10000,
    env_production: {
      NODE_ENV: 'production',
      PORT: 5140
    },
    error_file: './server/logs/pm2-err.log',
    out_file: './server/logs/pm2-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss'
  }]
};
```

---

## 6. 디렉토리 구조

### 6.1 운영 서버

```
C:\deploy-server\wow-gift\
├── ecosystem.config.js
├── package.json
├── pnpm-lock.yaml
├── pnpm-workspace.yaml
├── start.ps1
├── server\
│   ├── dist\                          # 컴파일된 백엔드
│   ├── public\                        # 컴파일된 프론트엔드
│   ├── prisma\                        # DB 스키마
│   ├── src\shared\prisma\generated\   # Prisma Client + 바이너리
│   ├── node_modules\                  # 런타임 의존성
│   ├── package.json
│   └── .env                           # 환경 변수
└── logs\
    ├── out.log
    └── err.log
```

---

## 7. 업데이트 배포

### 7.1 표준 배포 (권장)

```powershell
# 개발 PC
pnpm build:server
.\scripts\build-package.ps1

# 운영 서버 (RDP)
Expand-Archive -Path "deploy-package-*.zip" -DestinationPath "C:\deploy-server\wow-gift" -Force
cd C:\deploy-server\wow-gift
.\start.ps1
```

### 7.2 빠른 재시작 (코드만 변경, 의존성 동일)

```powershell
# 운영 서버
cd C:\deploy-server\wow-gift
.\quick-restart.ps1
```

### 7.3 의존성 변경 시

```powershell
# start.ps1이 자동으로 pnpm install 실행
.\start.ps1
```

### 7.4 DB 스키마 변경 시

```powershell
cd C:\deploy-server\wow-gift\server
pnpm exec prisma migrate deploy
pm2 restart w-gift-server
```

---

## 8. 트러블슈팅

### 8.1 서버 시작 실패

```powershell
# 로그 확인
pm2 logs w-gift-server --lines 50
pm2 logs w-gift-server --err --lines 50

# 직접 실행하여 에러 확인
cd C:\deploy-server\wow-gift
node server\dist\src\main.js
```

### 8.2 포트 충돌

```powershell
# 내부 NestJS 포트 확인
netstat -ano | findstr :5140
taskkill /PID <PID> /F

# nginx 포트 확인
netstat -ano | findstr :80
netstat -ano | findstr :443
```

### 8.3 .env 파일 없음

```powershell
cd C:\deploy-server\wow-gift
Copy-Item server\.env.example server\.env
notepad server\.env
```

### 8.4 Prisma 런타임 에러

**에러**: `Cannot find module '@prisma/client-runtime-utils'`

```powershell
cd C:\deploy-server\wow-gift\server
pnpm add @prisma/client-runtime-utils
pm2 restart w-gift-server
```

### 8.5 path-to-regexp 에러

**에러**: `Missing parameter name at index 5: /api*`

**원인**: path-to-regexp 8.x에서 와일드카드 문법 변경

**해결**: `app.module.ts`에서 exclude 패턴 수정
```typescript
// Before (deprecated)
exclude: ['/api*', '/docs*']

// After (path-to-regexp 8.x)
exclude: ['/api{/*path}', '/docs{/*path}']
```

### 8.6 Seed 실행 시 FK 제약 에러

**에러**: `Foreign key constraint violated on voucher_codes_productId_fkey`

**원인**: Product 삭제 전 VoucherCode 삭제 필요

```typescript
// seed-light.ts에서 순서
await prisma.voucherCode.deleteMany({});  // 먼저
await prisma.product.deleteMany({});       // 나중에
```

### 8.7 PM2 상태 확인 시 메모리 0b

**증상**: `pm2 status`에서 메모리가 `0b`, 재시작 횟수 계속 증가

**원인**: 서버가 시작 직후 크래시

```powershell
# 에러 로그 확인
pm2 logs w-gift-server --err --lines 50

# 또는 직접 실행
pm2 stop w-gift-server
node server\dist\src\main.js
```

---

## 9. 체크리스트

### 9.1 최초 배포

- [ ] Node.js, pnpm, PM2 설치
- [ ] PM2 Windows Service 등록
- [ ] 방화벽 80/443 포트 허용
- [ ] `C:\deploy-server\wow-gift` 디렉토리 생성
- [ ] ZIP 복사 및 압축 해제
- [ ] `server\.env` 설정
- [ ] `pnpm install --prod --filter server`
- [ ] `.\start.ps1`
- [ ] https://wowgift.co.kr 접속 확인

### 9.2 업데이트 배포

- [ ] 개발 PC: `pnpm build:server && .\scripts\build-package.ps1`
- [ ] ZIP 파일 운영 서버로 복사
- [ ] `Expand-Archive -Path "*.zip" -DestinationPath "C:\deploy-server\wow-gift" -Force`
- [ ] `.\start.ps1` (또는 빠른 재시작: `.\quick-restart.ps1`)
- [ ] 접속 확인: https://wowgift.co.kr
- [ ] 로그 확인: `pm2 logs w-gift-server --lines 20`

---

## 10. 접속 정보

| 항목 | 값 |
|------|-----|
| **서비스 URL** | https://wowgift.co.kr |
| **API 문서** | https://wowgift.co.kr/api/docs |
| **운영 경로** | `C:\deploy-server\wow-gift` |
| **로그 위치** | `C:\deploy-server\wow-gift\logs\` |
