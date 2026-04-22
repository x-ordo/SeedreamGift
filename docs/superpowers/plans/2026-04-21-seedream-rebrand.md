# Seedream Gift Rebrand Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** W Gift(wowgift.co.kr) 소스 스냅샷을 Seedream Gift(seedreamgift.com) 독립 서비스로 전환한다. 코드 식별자·도메인·브랜드·법인·DB 서버를 모두 신규 값으로 교체하고, 모든 빌드·테스트 게이트를 통과시킨다.

**Architecture:** 레이어별 수동 편집(Approach B). 8개 파일 그룹(G1~G8) 중 G8 제외 대상을 뺀 7개 그룹을 5단계 Phase로 순차 진행. 각 Phase 종료 시 검증 게이트(빌드/grep)로 회귀 방지.

**Tech Stack:** Go 1.21+ (Gin, GORM, Wails), React 18 + Vite + TypeScript, pnpm workspace, MSSQL, NSSM, nginx, PowerShell 배포.

**Spec Reference:** `docs/superpowers/specs/2026-04-21-seedream-rebrand-design.md`

---

## Phase 0: Pre-work

### Task 0: Git 초기화 및 스냅샷 커밋

**Files:**
- Create: `.gitignore` (존재 시 skip)

- [ ] **Step 1: 현재 디렉토리가 git 저장소가 아님을 확인**

Run: `git -C D:/dev/SeedreamGift status`
Expected: `fatal: not a git repository`

- [ ] **Step 2: .gitignore 존재 확인 후 없으면 생성**

Run: `ls D:/dev/SeedreamGift/.gitignore`

없으면 다음 내용으로 생성:
```
node_modules/
dist/
*.log
*.exe
.env
.env.production
coverage.out
go-server/build/
go-server/frontend/dist/
.playwright-mcp/
client/test-results-production/
scripts/db-migration/
```

- [ ] **Step 3: git 초기화**

```bash
cd D:/dev/SeedreamGift
git init
git branch -M main
```

- [ ] **Step 4: 초기 스냅샷 커밋**

```bash
git add .
git commit -m "chore: snapshot before seedream rebrand (import from wowgift)"
```

Expected: `[main (root-commit) xxxxxxx] ...` 출력

- [ ] **Step 5: 리브랜딩 브랜치 생성**

```bash
git checkout -b rebrand/seedream
```

---

## Phase 1: 루트 설정·메타 (G1)

### Task 1: wowsite.config.json → seedreamsite.config.json 파일 개명

**Files:**
- Rename: `wowsite.config.json` → `seedreamsite.config.json`
- Modify: `seedreamsite.config.json` (전체 재작성)

- [ ] **Step 1: 파일 개명**

```bash
cd D:/dev/SeedreamGift
git mv wowsite.config.json seedreamsite.config.json
```

- [ ] **Step 2: seedreamsite.config.json 전체 재작성**

파일 전체를 다음 내용으로 덮어쓰기:

```json
{
  "company": {
    "name": "주식회사 디앤더블유그룹",
    "nameShort": "씨드림기프트",
    "nameEn": "D&W Group Inc.",
    "brand": "SEEDREAM GIFT",
    "owner": "권종달",
    "licenseNo": "459-88-02135",
    "address": "경기도 화성시 장안면 장안로 607, 2동",
    "zipCode": "18583"
  },
  "contact": {
    "phone": "1551-9440",
    "phoneHref": "tel:1551-9440",
    "phoneHours": "평일 09:00 - 18:00",
    "email": "admin@seedream.com",
    "emailHref": "mailto:admin@seedream.com",
    "emailHours": "24시간 접수",
    "complianceEmail": "admin@seedream.com"
  },
  "privacy": {
    "officer": "권종달",
    "officerTitle": "대표이사",
    "handler": "권종달",
    "handlerTitle": "개인정보처리담당자",
    "department": "개인정보보호팀",
    "email": "admin@seedream.com",
    "phone": "1551-9440"
  },
  "urls": {
    "domain": "seedreamgift.com",
    "home": "https://seedreamgift.com",
    "admin": "https://seedreamgift.com/seedream_admin_portal/",
    "bizCheck": "https://www.ftc.go.kr/bizCommPop.do?wrkr_no=4598802135"
  },
  "seo": {
    "title": "씨드림기프트 - 상품권 최저가 구매 · 최고가 판매",
    "description": "백화점 상품권(신세계, 현대, 롯데) 최저가 구매 · 최고가 매입. 30초 즉시 PIN 발급. 정품 보장.",
    "ogImage": "/og-image.png"
  },
  "tradeIn": {
    "recipientName": "주식회사 디앤더블유그룹",
    "zipCode": "18583",
    "address": "경기도 화성시 장안면 장안로 607, 2동",
    "phone": "1551-9440",
    "notice": "상품권 수령 확인 후 영업일 1~2일 내에 입금됩니다."
  }
}
```

참고: 카카오 관련 3개 필드(`kakao`, `kakaoHref`, `kakaoHours`)는 **의도적으로 제거**. 이는 Task 6의 site.ts·기타 client 파일에서도 함께 제거해야 함.

- [ ] **Step 3: 커밋**

```bash
git add seedreamsite.config.json wowsite.config.json
git commit -m "feat(config): rename wowsite.config.json to seedreamsite.config.json with new company info"
```

### Task 2: site.config.json 전체 재작성

**Files:**
- Modify: `site.config.json`

- [ ] **Step 1: site.config.json 덮어쓰기**

```json
{
  "company": {
    "name": "주식회사 디앤더블유그룹",
    "nameShort": "씨드림기프트",
    "nameEn": "D&W Group Inc.",
    "brand": "SEEDREAM GIFT",
    "owner": "권종달",
    "licenseNo": "459-88-02135",
    "address": "경기도 화성시 장안면 장안로 607, 2동",
    "zipCode": "18583",
    "establishedDate": "2026-04-21"
  },
  "contact": {
    "phone": "1551-9440",
    "phoneHref": "tel:1551-9440",
    "phoneHours": "평일 09:00 - 18:00",
    "email": "admin@seedream.com",
    "emailHref": "mailto:admin@seedream.com",
    "emailHours": "24시간 접수",
    "complianceEmail": "admin@seedream.com"
  },
  "privacy": {
    "officer": "권종달",
    "officerTitle": "대표이사",
    "handler": "권종달",
    "handlerTitle": "개인정보처리담당자",
    "department": "개인정보보호팀",
    "email": "admin@seedream.com",
    "phone": "1551-9440"
  },
  "urls": {
    "domain": "seedreamgift.com",
    "home": "https://seedreamgift.com",
    "admin": "https://seedreamgift.com/seedream_admin_portal/",
    "bizCheck": "https://www.ftc.go.kr/bizCommPop.do?wrkr_no=4598802135"
  },
  "seo": {
    "title": "씨드림기프트 - 상품권 최저가 구매 · 최고가 판매",
    "description": "백화점 상품권(신세계, 현대, 롯데) 최저가 구매 · 최고가 매입. 30초 즉시 PIN 발급. 정품 보장.",
    "ogImage": "/og-image.png"
  },
  "tradeIn": {
    "recipientName": "주식회사 디앤더블유그룹",
    "zipCode": "18583",
    "address": "경기도 화성시 장안면 장안로 607, 2동",
    "phone": "1551-9440",
    "notice": "상품권 수령 확인 후 영업일 1~2일 내에 입금됩니다."
  }
}
```

- [ ] **Step 2: 커밋**

```bash
git add site.config.json
git commit -m "feat(config): replace site.config.json with seedream company info"
```

### Task 3: 루트 package.json 업데이트

**Files:**
- Modify: `package.json`

- [ ] **Step 1: 다음 edit 적용**

old_string:
```
  "name": "wow-gift",
  "version": "2.1.0",
  "private": true,
  "description": "W기프트 - 백화점 상품권 판매 및 매입 플랫폼 (NestJS + React Monorepo)",
```

new_string:
```
  "name": "seedream-gift",
  "version": "3.0.0",
  "private": true,
  "description": "씨드림기프트 - 백화점 상품권 판매 및 매입 플랫폼 (Go + React Monorepo)",
```

- [ ] **Step 2: 스크립트 필터명 일괄 교체**

`w-gift-server` → `seedream-gift-server` (6개 위치)

```bash
# 확인
grep -n "w-gift-server" package.json
```
Expected: 6개 라인 매치

이후 파일 내 모든 `w-gift-server` → `seedream-gift-server` 로 일괄 치환.

- [ ] **Step 3: 커밋**

```bash
git add package.json
git commit -m "feat(meta): rebrand root package.json to seedream-gift v3.0.0"
```

### Task 4: CLAUDE.md 핵심 섹션 업데이트

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: 프로젝트 제목 및 개요 교체**

```
old_string: **W기프트 (W Gift)** - 백화점 상품권 판매 및 매입 플랫폼
new_string: **씨드림기프트 (Seedream Gift)** - 백화점 상품권 판매 및 매입 플랫폼
```

- [ ] **Step 2: 배포 환경표 교체**

old: `| Production | wowgift.co.kr | wowgift.co.kr/wow_admin_portal/ | nginx `/api/` 프록시 |`
new: `| Production | seedreamgift.com | seedreamgift.com/seedream_admin_portal/ | nginx `/api/` 프록시 |`

- [ ] **Step 3: 환경변수 예시 교체**

```
old_string:
FRONTEND_URL=https://wowgift.co.kr
ADMIN_URL=https://wowgift.co.kr
COOKIE_SECURE=true
COOKIE_DOMAIN=.wowgift.co.kr
new_string:
FRONTEND_URL=https://seedreamgift.com
ADMIN_URL=https://seedreamgift.com
COOKIE_SECURE=true
COOKIE_DOMAIN=.seedreamgift.com
```

- [ ] **Step 4: 서버 토폴로지 섹션 업데이트 (DB 분리)**

```
old_string:
- **Server A** (103.97.209.205): nginx — client + admin 정적 파일 서빙
- **Server B** (103.97.209.194): Go API (NSSM 서비스) + MSSQL
new_string:
- **Server A** (103.97.209.205): nginx — client + admin 정적 파일 서빙
- **Server B** (103.97.209.194): Go API (NSSM 서비스명: SeedreamGiftAPI)
- **Server C** (103.97.209.131): MSSQL 전용 (SEEDREAM_GIFT_DB)
```

- [ ] **Step 5: URL·관리자 URL·admin 배포 방식 섹션 교체**

old: `- 고객: https://wowgift.co.kr`
new: `- 고객: https://seedreamgift.com`

old: `- 관리자: https://wowgift.co.kr/wow_admin_portal/`
new: `- 관리자: https://seedreamgift.com/seedream_admin_portal/`

old: `- Vite `base: '/wow_admin_portal/'` 설정`
new: `- Vite `base: '/seedream_admin_portal/'` 설정`

old: `- React Router `basename="/wow_admin_portal"` 설정`
new: `- React Router `basename="/seedream_admin_portal"` 설정`

old: `- 빌드 시 `admin/dist/` → `client/dist/wow_admin_portal/`로 자동 병합`
new: `- 빌드 시 `admin/dist/` → `client/dist/seedream_admin_portal/`로 자동 병합`

- [ ] **Step 6: 배포 섹션의 경로 업데이트**

old: `Expand-Archive client-*.zip -Dest C:\deploy-server\wow-gift\client -Force`
new: `Expand-Archive client-*.zip -Dest C:\deploy-server\seedream-gift\client -Force`

old:
```
nssm stop WowGiftAPI
Expand-Archive api-*.zip -Dest C:\deploy-server\wgift-api -Force
nssm start WowGiftAPI
```
new:
```
nssm stop SeedreamGiftAPI
Expand-Archive api-*.zip -Dest C:\deploy-server\seedream-api -Force
nssm start SeedreamGiftAPI
```

- [ ] **Step 7: 커밋**

```bash
git add CLAUDE.md
git commit -m "docs(claude): rebrand CLAUDE.md references to seedream and DB split"
```

### Task 5: pnpm-workspace.yaml 확인

**Files:**
- Read only: `pnpm-workspace.yaml`

- [ ] **Step 1: 파일 내용 재확인**

Run: `cat pnpm-workspace.yaml`
Expected: packages 목록(client/server/admin/partner)에 `wow-gift` 문자열이 없음을 확인. 있으면 교체.

- [ ] **Step 2: 변경 불필요 시 skip (가장 흔한 경우)**

변경 있으면 `git add pnpm-workspace.yaml && git commit -m "chore(meta): update workspace refs"`.

### Gate ①: Phase 1 검증

- [ ] **Step 1: validate-site-config 스크립트 실행**

```bash
cd D:/dev/SeedreamGift
node scripts/validate-site-config.js
```
Expected: 에러 없이 통과

- [ ] **Step 2: licenseNo ↔ bizCheck URL 일치 확인**

```bash
grep -o 'wrkr_no=[0-9]*' site.config.json seedreamsite.config.json
```
Expected: `wrkr_no=4598802135` (하이픈 제거된 459-88-02135)

---

## Phase 2: 프론트엔드 (G2)

### Task 6: client/ 루트 파일 업데이트

**Files:**
- Modify: `client/index.html`, `client/public/robots.txt`, `client/package.json`

- [ ] **Step 1: client/index.html <title> / meta 교체**

```bash
grep -n "wowgift\|W기프트\|W GIFT" client/index.html
```
매치된 모든 항목을 seedream 대응값으로 교체 (Task 2/4의 매핑 표 사용).

- [ ] **Step 2: client/public/robots.txt Sitemap URL 교체**

```
old_string: Sitemap: https://wowgift.co.kr/sitemap.xml
new_string: Sitemap: https://seedreamgift.com/sitemap.xml
```

- [ ] **Step 3: client/package.json 이름 변경 (있으면)**

```bash
grep -n "wow\|w-gift" client/package.json
```
매치 시 seedream 대응값으로 교체.

- [ ] **Step 4: 커밋**

```bash
git add client/index.html client/public/robots.txt client/package.json
git commit -m "feat(client): rebrand root files (html, robots, package)"
```

### Task 7: client/src/constants 업데이트 (카카오 제거 포함)

**Files:**
- Modify: `client/src/constants/site.ts`
- Modify: `client/src/constants/legal.ts`
- Modify: `client/src/constants/messages.ts`

- [ ] **Step 1: site.ts SUPPORT_CONTACT에서 카카오 필드 제거**

old_string:
```typescript
export const SUPPORT_CONTACT = {
  phone: siteConfig.contact.phone,
  phoneHref: siteConfig.contact.phoneHref,
  phoneHours: siteConfig.contact.phoneHours,
  kakao: siteConfig.contact.kakao,
  kakaoHref: siteConfig.contact.kakaoHref,
  kakaoHours: siteConfig.contact.kakaoHours,
  email: siteConfig.contact.email,
  emailHref: siteConfig.contact.emailHref,
  emailHours: siteConfig.contact.emailHours,
} as const;
```
new_string:
```typescript
export const SUPPORT_CONTACT = {
  phone: siteConfig.contact.phone,
  phoneHref: siteConfig.contact.phoneHref,
  phoneHours: siteConfig.contact.phoneHours,
  email: siteConfig.contact.email,
  emailHref: siteConfig.contact.emailHref,
  emailHours: siteConfig.contact.emailHours,
} as const;
```

- [ ] **Step 2: SUPPORT_CONTACT.kakao 사용처 제거**

다음 4개 파일에서 카카오 참조 제거:
- `client/src/pages/Legal/RefundPolicyPage.tsx`
- `client/src/pages/SupportHubPage/components/SupportContactBanner/index.tsx`
- `client/src/components/common/KakaoFloatingButton.tsx`
- `client/src/components/common/KakaoFloatingButton.css`

**옵션 A (권장)**: KakaoFloatingButton 컴포넌트 자체를 제거 — App.tsx/Layout에서 <KakaoFloatingButton /> 렌더링을 지우고, 해당 디렉토리 파일 2개를 삭제.

```bash
# 렌더링 위치 찾기
grep -rn "KakaoFloatingButton" client/src
```
각 import/render 라인 삭제 후:
```bash
rm client/src/components/common/KakaoFloatingButton.tsx client/src/components/common/KakaoFloatingButton.css
```

- [ ] **Step 3: constants/legal.ts 약관·개인정보처리방침 본문 내 브랜드/도메인 교체**

```bash
grep -n "wowgift\|W기프트\|와우기프트\|W GIFT" client/src/constants/legal.ts
```
매치 항목 모두 seedream 대응값으로 교체.

- [ ] **Step 4: constants/messages.ts 내 브랜드 언급 교체**

```bash
grep -n "wow\|W기프트" client/src/constants/messages.ts
```
매치 항목 교체.

- [ ] **Step 5: 타입 체크**

```bash
pnpm --filter client tsc --noEmit
```
Expected: 에러 없음

- [ ] **Step 6: 커밋**

```bash
git add client/src/
git commit -m "feat(client): remove kakao support channel and rebrand legal/messages"
```

### Task 8: client 스타일·프리셋 업데이트

**Files:**
- Modify: `client/src/styles/presets/default.css`

- [ ] **Step 1: CSS 내 브랜드 색상·주석 교체**

```bash
grep -n "wow\|W기프트" client/src/styles/presets/default.css
```
매치 항목의 주석·클래스명을 적절히 교체. CSS 변수(`--color-primary` 등)는 값 유지.

- [ ] **Step 2: 커밋**

```bash
git add client/src/styles/
git commit -m "feat(client): rebrand style preset comments"
```

### Task 9: admin 업데이트

**Files:**
- Modify: `admin/src/pages/AdminLoginPage.tsx`
- Modify: `admin/src/constants/legal.ts`
- Modify: `admin/vite.config.ts`
- Modify: `admin/package.json`

- [ ] **Step 1: admin/vite.config.ts base 경로 교체**

```
old_string: base: '/wow_admin_portal/'
new_string: base: '/seedream_admin_portal/'
```

- [ ] **Step 2: AdminLoginPage.tsx 브랜드 문구 교체**

```bash
grep -n "W기프트\|wowgift" admin/src/pages/AdminLoginPage.tsx
```
각 매치를 "씨드림기프트 관리자" / "seedreamgift" 로 교체.

- [ ] **Step 3: admin/src/constants/legal.ts 교체** (Task 7 Step 3과 동일 패턴)

- [ ] **Step 4: admin/package.json name 필드 교체**

```
old_string: "name": "admin"
(변경 없음; 현재도 단순 "admin"이면 그대로 유지)
```
현재값이 `wow-gift-admin` 같은 경우만 `seedream-gift-admin` 로 교체.

- [ ] **Step 5: move-client-build.js의 출력 경로 수정**

```bash
grep -n "wow_admin_portal" scripts/move-client-build.js
```
매치 시 `seedream_admin_portal` 로 교체.

- [ ] **Step 6: 커밋**

```bash
git add admin/ scripts/move-client-build.js
git commit -m "feat(admin): rebrand admin base path to /seedream_admin_portal/"
```

### Task 10: partner 업데이트

**Files:**
- Modify: `partner/src/pages/PartnerLoginPage.tsx`
- Modify: `partner/src/pages/Partner/PartnerPage.tsx`
- Modify: `partner/src/App.tsx`
- Modify: `partner/index.html`
- Modify: `partner/package.json`

- [ ] **Step 1: 각 파일에서 브랜드/도메인 교체**

```bash
for f in partner/src/pages/PartnerLoginPage.tsx partner/src/pages/Partner/PartnerPage.tsx partner/src/App.tsx partner/index.html partner/package.json; do
  grep -n "wow\|W기프트\|W GIFT" "$f"
done
```
각 매치를 seedream 대응값으로 교체.

- [ ] **Step 2: 커밋**

```bash
git add partner/
git commit -m "feat(partner): rebrand partner package files"
```

### Gate ②: Frontend 빌드 검증

- [ ] **Step 1: pnpm install (node_modules 일관성 확보)**

```bash
pnpm install
```
Expected: 성공. 변경된 package.json name 필드가 반영됨.

- [ ] **Step 2: 3개 빌드 실행**

```bash
pnpm --filter client build
pnpm --filter admin build
pnpm --filter partner build
```
Expected: 모두 성공

- [ ] **Step 3: 산출물에 구 브랜드 잔여 없음 확인**

```bash
grep -rE "wowgift|W기프트|W GIFT|와우기프트" client/dist admin/dist partner/dist
```
Expected: 매치 없음 (단, 무작위 해시 파일명은 OK)

- [ ] **Step 4: Gate 통과 커밋 태그**

```bash
git tag phase2-frontend-verified
```

---

## Phase 3: Go 서버 (G3)

### Task 11: go.mod 모듈명 및 import 경로 일괄 교체

**Files:**
- Modify: `go-server/go.mod`
- Modify: 모든 `go-server/**/*.go` (import 경로)

- [ ] **Step 1: go.mod의 module 선언 교체**

```
old_string: module w-gift-server
new_string: module seedream-gift-server
```

- [ ] **Step 2: 모든 Go 파일의 import 경로 일괄 치환**

PowerShell 기준:
```powershell
cd D:/dev/SeedreamGift/go-server
(Get-ChildItem -Recurse -Include *.go | Where-Object { $_.FullName -notmatch 'node_modules|\\frontend\\dist\\' }) | ForEach-Object {
  (Get-Content $_.FullName -Raw) -replace 'w-gift-server/', 'seedream-gift-server/' | Set-Content $_.FullName -NoNewline
}
```

또는 bash(git-bash) 기준:
```bash
cd D:/dev/SeedreamGift/go-server
find . -type f -name "*.go" -not -path "*/frontend/dist/*" -exec sed -i 's|w-gift-server/|seedream-gift-server/|g' {} +
```

- [ ] **Step 3: 치환 결과 검증**

```bash
grep -rE '"w-gift-server/' go-server --include="*.go"
```
Expected: 매치 없음

- [ ] **Step 4: go build 성공 확인**

```bash
cd D:/dev/SeedreamGift/go-server
go build ./...
```
Expected: 에러 없음

- [ ] **Step 5: 커밋**

```bash
git add go-server/go.mod go-server/
git commit -m "refactor(go): rename module w-gift-server to seedream-gift-server"
```

### Task 12: go-server 설정 파일·env 업데이트

**Files:**
- Modify: `go-server/.env`
- Modify: `go-server/.env.production`
- Modify: `go-server/internal/config/config.go`
- Modify: `go-server/wails.json`
- Modify: `go-server/main.go`
- Modify: `.env` (루트)

- [ ] **Step 1: 루트 .env 및 go-server/.env DATABASE_URL 교체**

old_string:
```
DATABASE_URL="sqlserver://103.97.209.194:7335;database=WOWGIFT_DB;user=dnflrhdwnghkdlxldsql;password=dnflrhdwnghkdlxld2024!@;encrypt=true;trustServerCertificate=true"
```
new_string:
```
DATABASE_URL="sqlserver://103.97.209.131:7335;database=SEEDREAM_GIFT_DB;user=dnflrhdwnghkdlxldsql;password=dnflrhdwnghkdlxld2024!@;encrypt=true;trustServerCertificate=true"
```

- [ ] **Step 2: go-server/.env.production 도메인·쿠키 교체**

`wowgift.co.kr` → `seedreamgift.com` (home, admin_url, cookie_domain, CORS 등 전부)

- [ ] **Step 3: go-server/internal/config/config.go 기본값 교체**

```bash
grep -n 'wowgift\|wow_admin_portal\|W기프트' go-server/internal/config/config.go
```
각 매치를 seedream 대응값으로 교체.

- [ ] **Step 4: wails.json 전체 교체**

```json
{
  "$schema": "https://wails.io/schemas/config.v2.json",
  "name": "seedream-gift-server",
  "outputfilename": "seedream-api",
  "frontend:install": "npm install",
  "frontend:build": "npm run build",
  "frontend:dev:watcher": "npm run dev",
  "frontend:dev:serverUrl": "http://localhost:5173",
  "wailsjsdir": "./frontend",
  "author": {
    "name": "Seedream Gift",
    "email": "admin@seedream.com"
  }
}
```

- [ ] **Step 5: main.go 앱 이름/로그 prefix 교체**

```bash
grep -n 'wowgift\|WowGift\|W기프트' go-server/main.go
```
매치 항목 교체.

- [ ] **Step 6: 커밋**

```bash
git add go-server/.env go-server/.env.production go-server/internal/config/ go-server/wails.json go-server/main.go .env
git commit -m "feat(go): rebrand config, env, wails metadata"
```

### Task 13: go-server 미들웨어 (보안 헤더) 업데이트

**Files:**
- Modify: `go-server/internal/api/middleware/security_middleware.go`

- [ ] **Step 1: CSP·HSTS·Allowed Origins 교체**

```bash
grep -n "wowgift\|wow_admin_portal" go-server/internal/api/middleware/security_middleware.go
```
CSP directive, allowed origins, redirect URL 등을 모두 seedream 도메인으로 교체.

- [ ] **Step 2: 빌드 확인**

```bash
cd go-server && go build ./...
```

- [ ] **Step 3: 커밋**

```bash
git add go-server/internal/api/middleware/
git commit -m "feat(go): update security middleware for seedream domain"
```

### Task 14: go-server 라우트 (admin URL prefix) 업데이트

**Files:**
- Modify: `go-server/internal/routes/*.go` (register.go, admin.go, protected.go, public.go, container.go)

- [ ] **Step 1: admin route prefix 교체**

```bash
grep -rn "wow_admin_portal\|wowgift\|W기프트" go-server/internal/routes/
```
각 매치를 `seedream_admin_portal` / `seedreamgift.com` / `씨드림기프트` 로 교체.

- [ ] **Step 2: 빌드 확인**

```bash
cd go-server && go build ./...
```

- [ ] **Step 3: 커밋**

```bash
git add go-server/internal/routes/
git commit -m "feat(go): rebrand route prefixes to /seedream_admin_portal"
```

### Task 15: go-server 서비스·핸들러 브랜드 문자열 교체

**Files:**
- Modify: `go-server/internal/app/services/*.go` (30+ files)
- Modify: `go-server/internal/api/handlers/*.go`
- Modify: `go-server/internal/cron/scheduler.go`
- Modify: `go-server/internal/infra/**/*.go`
- Modify: `go-server/internal/gui/app.go`

- [ ] **Step 1: 일괄 치환 (브랜드 문자열, 도메인)**

```bash
cd D:/dev/SeedreamGift/go-server
find internal/ -type f -name "*.go" -exec sed -i '
  s|wowgift\.co\.kr|seedreamgift.com|g;
  s|cs@wowgift\.co\.kr|admin@seedream.com|g;
  s|compliance@wowgift\.co\.kr|admin@seedream.com|g;
  s|wow_gift@naver\.com|admin@seedream.com|g;
  s|W기프트|씨드림기프트|g;
  s|와우기프트|씨드림기프트|g;
  s|W GIFT|SEEDREAM GIFT|g;
  s|WOW_GIFT|SEEDREAM_GIFT|g;
  s|wow_admin_portal|seedream_admin_portal|g
' {} +
```

- [ ] **Step 2: 단독 `wow` 또는 `WowGift` 잔여 수동 검토**

```bash
grep -rn "WowGift\|WOW_GIFT" go-server/internal
```
각 매치를 `SeedreamGift` / `SEEDREAM_GIFT` 로 맥락 확인 후 교체.

- [ ] **Step 3: 빌드·테스트 확인**

```bash
cd go-server
go build ./...
go test ./... -short
```
Expected: 모두 성공

- [ ] **Step 4: 커밋**

```bash
git add go-server/internal/
git commit -m "feat(go): bulk rebrand internal packages (services, handlers, infra)"
```

### Task 16: go-server pkg 업데이트

**Files:**
- Modify: `go-server/pkg/email/email.go`
- Modify: `go-server/pkg/notification/notification.go`
- Modify: `go-server/pkg/banner/banner.go`
- Modify: `go-server/pkg/thecheat/client.go`
- Modify: `go-server/pkg/response/response.go`

- [ ] **Step 1: 일괄 치환**

```bash
cd D:/dev/SeedreamGift/go-server
find pkg/ -type f -name "*.go" -exec sed -i '
  s|wowgift\.co\.kr|seedreamgift.com|g;
  s|cs@wowgift\.co\.kr|admin@seedream.com|g;
  s|W기프트|씨드림기프트|g;
  s|W GIFT|SEEDREAM GIFT|g;
  s|WOW_GIFT|SEEDREAM_GIFT|g
' {} +
```

- [ ] **Step 2: 빌드·테스트 확인**

```bash
cd go-server && go build ./... && go test ./pkg/...
```

- [ ] **Step 3: 커밋**

```bash
git add go-server/pkg/
git commit -m "feat(go): rebrand pkg (email, notification, banner, thecheat)"
```

### Task 17: go-server 바이너리 삭제 및 재빌드

**Files:**
- Delete: `go-server/w-gift-server.exe`
- Create: `go-server/seedream-gift-server.exe` (빌드 산출물)

- [ ] **Step 1: 구 바이너리 삭제**

```bash
rm -f go-server/w-gift-server.exe
rm -rf go-server/build go-server/frontend/dist
```

- [ ] **Step 2: wails build 실행 (CLAUDE.md 빌드 규칙)**

```bash
cd D:/dev/SeedreamGift/go-server
wails build -platform windows/amd64 -ldflags "-s -w"
```
Expected: `build/bin/seedream-api.exe` 또는 유사한 이름으로 생성

- [ ] **Step 3: 헤드리스 모드로 헬스체크**

```bash
cd D:/dev/SeedreamGift/go-server
HEADLESS=true go run . &
sleep 3
curl -s http://localhost:52201/api/v1/health
kill %1
```
Expected: JSON 응답 (DB 미연결이어도 health는 OK가 설계된 경우)

- [ ] **Step 4: 커밋**

```bash
git add go-server/build/ go-server/wails.json
git commit -m "build(go): rebuild go-server as seedream-api"
```

### Gate ③: Go 서버 검증

- [ ] **Step 1: 전체 go test**

```bash
cd D:/dev/SeedreamGift/go-server
go test ./...
```
Expected: 모든 기존 테스트 PASS (리브랜딩이 로직을 깨뜨리지 않음 증명)

- [ ] **Step 2: 구 브랜드 grep 검증**

```bash
grep -rE "wowgift|WowGift|WOW_GIFT|w-gift-server|wgift-api|WowGiftAPI|wow_admin_portal" go-server/ --include="*.go" --include="*.json" --include=".env*"
```
Expected: 매치 없음 (test data에 일부 허용되지만 실질 로직 아님을 확인)

- [ ] **Step 3: Gate 태그**

```bash
git tag phase3-goserver-verified
```

---

## Phase 4: 배포 인프라 (G4, G5)

### Task 18: PowerShell 배포 스크립트 업데이트

**Files:**
- Modify: `scripts/deploy-all.ps1`
- Modify: `scripts/deploy-client.ps1`
- Modify: `scripts/deploy-admin.ps1`
- Modify: `scripts/deploy-go-server.ps1`
- Modify: `scripts/setup-nginx-https.ps1`
- Modify: `scripts/validate-site-config.js`

- [ ] **Step 1: 일괄 치환**

```bash
cd D:/dev/SeedreamGift/scripts
for f in deploy-all.ps1 deploy-client.ps1 deploy-admin.ps1 deploy-go-server.ps1 setup-nginx-https.ps1; do
  sed -i '
    s|wowgift\.co\.kr|seedreamgift.com|g;
    s|wow-gift|seedream-gift|g;
    s|wgift-api|seedream-api|g;
    s|WowGiftAPI|SeedreamGiftAPI|g;
    s|wow_admin_portal|seedream_admin_portal|g;
    s|W기프트|씨드림기프트|g
  ' "$f"
done
```

- [ ] **Step 2: validate-site-config.js 내 파일명 참조 업데이트**

```bash
grep -n "wowsite.config.json" scripts/validate-site-config.js
```
매치 시 `seedreamsite.config.json` 으로 교체.

- [ ] **Step 3: seed_site_configs.go / schema-phase2.go 내 기본값 교체**

```bash
grep -rn "wowgift\|W기프트\|wow_admin_portal" scripts/ --include="*.go" --include="*.sql"
```
매치 모두 교체.

- [ ] **Step 4: drycast — 스크립트 일관성 확인**

```bash
grep -rE "wow|W기프트" scripts/ --include="*.ps1" --include="*.js" --include="*.go" --include="*.sql"
```
Expected: 매치 없음 (단독 `wow` 잔여는 수동 확인)

- [ ] **Step 5: 커밋**

```bash
git add scripts/
git commit -m "feat(scripts): rebrand deployment scripts and seed configs"
```

### Task 19: nginx 설정 업데이트

**Files:**
- Modify: `config/nginx/nginx.conf`
- Modify: `config/nginx/nginx-api-server.conf`
- Modify: `config/nginx/nginx-security.conf`

- [ ] **Step 1: 일괄 치환**

```bash
cd D:/dev/SeedreamGift/config/nginx
for f in nginx.conf nginx-api-server.conf nginx-security.conf; do
  sed -i '
    s|wowgift\.co\.kr|seedreamgift.com|g;
    s|wow_admin_portal|seedream_admin_portal|g;
    s|wow-gift|seedream-gift|g;
    s|wgift-api|seedream-api|g
  ' "$f"
done
```

- [ ] **Step 2: SSL 인증서 경로 수정 확인**

```bash
grep -n "ssl_certificate" config/nginx/nginx.conf
```
경로에 `wowgift` 포함 시 `seedreamgift` 로 교체. (실제 인증서 파일명은 배포 전 확정)

- [ ] **Step 3: nginx 문법 검사(옵션, nginx 로컬 설치 시)**

```bash
nginx -t -c D:/dev/SeedreamGift/config/nginx/nginx.conf
```
Expected: syntax OK

- [ ] **Step 4: 커밋**

```bash
git add config/nginx/
git commit -m "feat(nginx): rebrand server_name and paths"
```

### Gate ④: 인프라 설정 검증

- [ ] **Step 1: 전역 grep**

```bash
grep -rE "wowgift|wow-gift|wgift-api|WowGiftAPI|wow_admin_portal" scripts/ config/
```
Expected: 매치 없음

- [ ] **Step 2: Gate 태그**

```bash
git tag phase3-infra-verified
```

---

## Phase 5: 보조 자산 (G6, G7)

### Task 20: server/src (NestJS) 및 API spec 업데이트

**Files:**
- Modify: `server/src/seed.ts`
- Modify: `server/src/shared/seo/sitemap.controller.ts`
- Modify: `blacklist/blacklist-openapi.yaml`

- [ ] **Step 1: 일괄 치환**

```bash
cd D:/dev/SeedreamGift
for f in server/src/seed.ts server/src/shared/seo/sitemap.controller.ts blacklist/blacklist-openapi.yaml; do
  sed -i '
    s|wowgift\.co\.kr|seedreamgift.com|g;
    s|W기프트|씨드림기프트|g;
    s|W GIFT|SEEDREAM GIFT|g;
    s|WOW_GIFT|SEEDREAM_GIFT|g
  ' "$f"
done
```

- [ ] **Step 2: 커밋**

```bash
git add server/src/seed.ts server/src/shared/seo/sitemap.controller.ts blacklist/blacklist-openapi.yaml
git commit -m "feat(server): rebrand NestJS seed and openapi spec"
```

### Task 21: 루트 문서 업데이트

**Files:**
- Modify: `README.md`
- Modify: `WCAG_ACCESSIBILITY_AUDIT.md`
- Modify: `ACCESSIBILITY_QUICK_START.md`

- [ ] **Step 1: 일괄 치환**

```bash
for f in README.md WCAG_ACCESSIBILITY_AUDIT.md ACCESSIBILITY_QUICK_START.md; do
  sed -i '
    s|wowgift\.co\.kr|seedreamgift.com|g;
    s|wow-gift|seedream-gift|g;
    s|W기프트|씨드림기프트|g;
    s|와우기프트|씨드림기프트|g;
    s|W GIFT|SEEDREAM GIFT|g
  ' "$f"
done
```

- [ ] **Step 2: 커밋**

```bash
git add README.md WCAG_ACCESSIBILITY_AUDIT.md ACCESSIBILITY_QUICK_START.md
git commit -m "docs: rebrand root markdown files"
```

### Task 22: docs/ 디렉토리 업데이트 (legacy 제외)

**Files:**
- Modify: `docs/PRD.md`, `DEPLOYMENT.md`, `API_SPEC.md`, `CUSTOMIZATION_GUIDE.md`, `KYC_INTEGRATION.md`, `SMTP_SETUP.md`, `WINDOWS_NATIVE_ROADMAP.md`, `CLOUDFLARE_SETUP.md`
- Modify: `docs/superpowers/specs/2026-03-27-auth-restructure-design.md`
- Modify: `docs/superpowers/specs/2026-03-26-voucher-issuance-api-design.md`

- [ ] **Step 1: 일괄 치환 (legacy 제외)**

```bash
cd D:/dev/SeedreamGift/docs
find . -type f -name "*.md" -not -path "./legacy/*" -exec sed -i '
  s|wowgift\.co\.kr|seedreamgift.com|g;
  s|wow-gift|seedream-gift|g;
  s|wgift-api|seedream-api|g;
  s|WowGiftAPI|SeedreamGiftAPI|g;
  s|wow_admin_portal|seedream_admin_portal|g;
  s|W기프트|씨드림기프트|g;
  s|와우기프트|씨드림기프트|g;
  s|W GIFT|SEEDREAM GIFT|g
' {} +
```

- [ ] **Step 2: DEPLOYMENT.md 서버 표 DB IP 수정**

```
old_string: | MSSQL | 103.97.209.194 | — | 7335 | — |
new_string: | MSSQL | 103.97.209.131 | — | 7335 | — |
```

Server B 행의 "Go API (NSSM 서비스) + MSSQL" 텍스트에서 "+ MSSQL" 제거.

- [ ] **Step 3: CLOUDFLARE_SETUP.md 방화벽/서버 설명 수정**

Server B 섹션의 MSSQL 항목을 Server C(103.97.209.131) 섹션으로 이동.

- [ ] **Step 4: 커밋**

```bash
git add docs/
git commit -m "docs: rebrand technical docs and update infrastructure topology"
```

### Task 23: docs/legacy/ 파일에 레거시 주석 추가

**Files:**
- Modify: `docs/legacy/*.md`

- [ ] **Step 1: 모든 legacy 문서 상단에 주석 삽입**

```bash
cd D:/dev/SeedreamGift/docs/legacy
for f in *.md; do
  if ! head -n 3 "$f" | grep -q "레거시 참조용"; then
    sed -i '1i > **[Legacy] 레거시 참조용** — 이 문서는 구 W Gift(wowgift.co.kr) 시절 작성되었으며 역사 보존 목적으로만 유지됩니다. 현재 시스템은 Seedream Gift(seedreamgift.com)입니다.\n' "$f"
  fi
done
```

- [ ] **Step 2: 커밋**

```bash
git add docs/legacy/
git commit -m "docs(legacy): mark legacy docs as historical reference"
```

### Task 24: CHANGELOG.md에 3.0.0 항목 추가

**Files:**
- Modify: `CHANGELOG.md`

- [ ] **Step 1: 최상단에 3.0.0 항목 삽입**

파일의 `## [2.1.0] - 2026-02-16` 라인 **이전**에 다음 섹션 삽입:

```markdown
## [3.0.0] - 2026-04-21

### Changed (리브랜딩)
- **프로젝트명**: W Gift(wowgift.co.kr) → **Seedream Gift(seedreamgift.com)**
- **법인**: 주식회사 더블유에이아이씨 → 주식회사 디앤더블유그룹
- **대표자**: 권학재 → 권종달
- **사업자등록번호**: 731-87-02461 → 459-88-02135
- **브랜드명**: W기프트 / W GIFT → 씨드림기프트 / SEEDREAM GIFT
- **이메일**: cs@wowgift.co.kr / compliance@wowgift.co.kr → admin@seedream.com
- **전화**: 02-569-7334 → 1551-9440
- **주소**: 서울 강남 테헤란로 → 경기 화성시 장안로 607

### Infra (신규 / 분리)
- **DB 서버 분리**: 기존 Server B 공존 → **Server C (103.97.209.131)** 전용 MSSQL
- **DB 이름**: WOWGIFT_DB → SEEDREAM_GIFT_DB
- **NSSM 서비스**: WowGiftAPI → SeedreamGiftAPI
- **배포 경로**: C:\deploy-server\wow-gift / \wgift-api → \seedream-gift / \seedream-api
- **Admin URL**: /wow_admin_portal/ → /seedream_admin_portal/

### Removed
- 카카오 채널 플로팅 버튼 컴포넌트 (신규 채널 미확정)
- 파일 `wowsite.config.json` 개명 → `seedreamsite.config.json`

---

```

- [ ] **Step 2: 커밋**

```bash
git add CHANGELOG.md
git commit -m "docs(changelog): add 3.0.0 seedream rebrand entry"
```

### Gate ⑤: 전역 잔여 검사

- [ ] **Step 1: 코드 식별자 잔여**

```bash
cd D:/dev/SeedreamGift
grep -rE "wow[-_]?gift|WowGift|WOW_GIFT|w-gift-server|wgift-api|WowGiftAPI|wow_admin_portal" \
  --exclude-dir={node_modules,dist,logs,test-results-production,.playwright-mcp,legacy,.git} \
  --exclude="*.log" --exclude="*.exe" --exclude="CHANGELOG.md"
```
Expected: 매치 없음

- [ ] **Step 2: 도메인 잔여**

```bash
grep -rE "wowgift\.co\.kr" --exclude-dir={node_modules,dist,logs,legacy,.git} --exclude="CHANGELOG.md"
```
Expected: 매치 없음

- [ ] **Step 3: 브랜드 잔여**

```bash
grep -rE "W기프트|와우기프트|W GIFT" --exclude-dir={node_modules,dist,logs,legacy,.git} --exclude="CHANGELOG.md"
```
Expected: 매치 없음 (CHANGELOG·legacy는 의도된 잔여)

- [ ] **Step 4: 이메일 잔여**

```bash
grep -rE "wow_gift@|@wowgift\.co\.kr" --exclude-dir={node_modules,dist,logs,legacy,.git}
```
Expected: 매치 없음

- [ ] **Step 5: DB 잔여**

```bash
grep -rE "WOWGIFT_DB|103\.97\.209\.194:7335" --exclude-dir={node_modules,dist,logs,legacy,.git} --exclude="CHANGELOG.md"
```
Expected: 매치 없음

---

## Phase 6: 최종 재빌드 및 OpenAPI 재생성

### Task 25: dist / node_modules 정리 및 재설치

- [ ] **Step 1: 빌드 산출물 삭제**

```bash
cd D:/dev/SeedreamGift
rm -rf client/dist admin/dist partner/dist go-server/frontend/dist go-server/build
rm -rf client/.vite admin/.vite partner/.vite
```

- [ ] **Step 2: node_modules 재설치**

```bash
rm -rf node_modules client/node_modules admin/node_modules partner/node_modules server/node_modules
pnpm install
```
Expected: 성공. 변경된 package.json name 반영.

- [ ] **Step 3: Go 서버 기동 (OpenAPI 생성용)**

별도 터미널:
```bash
cd D:/dev/SeedreamGift/go-server
HEADLESS=true go run . &
```

- [ ] **Step 4: OpenAPI 클라이언트 재생성**

```bash
cd D:/dev/SeedreamGift
pnpm api:generate
```
Expected: `client/src/api/generated/` 갱신

- [ ] **Step 5: Go 서버 종료**

```bash
pkill -f "go run" || kill %1
```

- [ ] **Step 6: 커밋**

```bash
git add client/src/api/generated/ partner/src/api/generated/
git commit -m "chore: regenerate OpenAPI clients from seedream-api swagger"
```

### Task 26: 전체 재빌드

- [ ] **Step 1: pnpm build 전체**

```bash
cd D:/dev/SeedreamGift
pnpm build
```
Expected: client, admin, partner 전부 빌드 성공

- [ ] **Step 2: wails build**

```bash
cd D:/dev/SeedreamGift/go-server
wails build -platform windows/amd64 -ldflags "-s -w"
```
Expected: `build/bin/seedream-api.exe` 생성

- [ ] **Step 3: 산출물 검증**

```bash
cd D:/dev/SeedreamGift
grep -rE "wowgift|W기프트|W GIFT" client/dist admin/dist partner/dist go-server/build 2>/dev/null | head -20
```
Expected: 매치 없음 (또는 무작위 해시 파일명만)

- [ ] **Step 4: 빌드 산출물 커밋**

빌드 산출물은 보통 `.gitignore` 대상이지만, 최종 검증 후 태그 용도로만 staging:
```bash
git status
# 변경된 파일이 tracked 파일뿐인지 확인
git tag -a v3.0.0 -m "Seedream Gift v3.0.0 - initial rebrand"
```

### Gate ⑥: 최종 검증

- [ ] **Step 1: 전체 grep — 허용 목록 외 잔여 없음**

```bash
cd D:/dev/SeedreamGift
grep -rE "wowgift|wow-gift|wgift-api|WowGiftAPI|wow_admin_portal|W기프트|와우기프트|W GIFT|WOWGIFT_DB" \
  --exclude-dir={node_modules,dist,logs,test-results-production,.playwright-mcp,legacy,.git,build} \
  --exclude="*.log" --exclude="*.exe" --exclude="CHANGELOG.md" --exclude="*.md"
```
Expected: 매치 없음

- [ ] **Step 2: 배포 실행 시나리오 시뮬레이션 (drycast)**

```bash
cat scripts/deploy-all.ps1 | grep -E "Path|Service|Dest" | head -20
```
Expected: 모든 경로·서비스명이 seedream 기반임

- [ ] **Step 3: CHANGELOG 항목 최종 확인**

```bash
head -n 40 CHANGELOG.md
```
Expected: `[3.0.0] - 2026-04-21` 항목이 존재

- [ ] **Step 4: 리브랜딩 완료 태그**

```bash
git tag -a rebrand-complete -m "All rebrand phases verified"
git log --oneline -20
```

---

## Post-implementation Notes

### 운영 담당자 인계 사항 (Out of Scope)

1. **DNS 등록**: seedreamgift.com A 레코드 → 103.97.209.205 (Server A)
2. **SSL 인증서**: Cloudflare 또는 Let's Encrypt로 `seedreamgift.com` 발급
3. **DB 초기화**: Server C(103.97.209.131)에서 `CREATE DATABASE SEEDREAM_GIFT_DB` + 사용자 권한 부여
4. **방화벽**: Server B → Server C:7335 TCP 허용
5. **MX/SPF**: seedream.com 도메인의 메일 수신 설정
6. **NSSM 재설치**: 배포 후 `nssm install SeedreamGiftAPI "C:\deploy-server\seedream-api\seedream-api.exe"`

---

## Rollback

각 Phase 태그를 이용해 특정 지점으로 되돌릴 수 있음:
- `phase2-frontend-verified` — 프론트 검증 완료 시점
- `phase3-goserver-verified` — Go 서버 검증 완료 시점
- `phase3-infra-verified` — 인프라 설정 완료 시점
- `rebrand-complete` — 전체 완료

```bash
git reset --hard <tag>   # 작업 초기화
```
