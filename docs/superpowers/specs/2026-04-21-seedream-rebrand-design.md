# Seedream Gift 리브랜딩 설계안

- **Date**: 2026-04-21
- **Author**: park david (parkdavid31@gmail.com) + Claude
- **Type**: Project-level rebrand (identifier, domain, brand, company, infrastructure)
- **Source project**: W Gift (wowgift.co.kr)
- **Target project**: Seedream Gift (seedreamgift.com)

---

## 1. Context & Motivation

현재 프로젝트(`D:\dev\SeedreamGift`)는 W Gift(`wowgift.co.kr`)를 디렉토리째 복사한 스냅샷이다. 목표는 이 소스를 **새 법인·새 도메인의 독립 서비스**(Seedream Gift / `seedreamgift.com`)로 전환하는 것이다.

### 결정 사항

| 항목 | 결정 |
|------|------|
| 리브랜딩 범위 | **옵션 D**: 표시명 + 도메인 + 내부 식별자(패키지명/admin URL/NSSM/배포 경로) + 회사정보 + DB 서버 |
| 병행 운영 | 기존 wowgift.co.kr는 별개 소스로 취급. 본 작업은 독립 소스에서 신규 배포 준비 |
| 데이터 이관 | **Out of Scope** — 빈 SEEDREAM_GIFT_DB 기준 |
| 접근 방식 | 레이어별 수동 편집(Approach B) — 그룹 단위 커밋·검증 |

---

## 2. String Mapping Tables

### 2.1. 코드 식별자 (case variants)

| 현재 | 신규 | 용례 |
|------|------|------|
| `wow-gift` | `seedream-gift` | npm 패키지명, 디렉토리 경로 |
| `wow_gift` | `seedream_gift` | 변수명 (⚠️ 이메일 로컬파트에는 쓰지 말 것) |
| `wowgift` | `seedreamgift` | 도메인 slug, URL host |
| `WowGift` | `SeedreamGift` | Go 패키지, 타입명 |
| `WOW_GIFT` | `SEEDREAM_GIFT` | 상수, env prefix, DB 명 |
| `w-gift-server` | `seedream-gift-server` | server 패키지명, 빌드 산출물 |
| `wgift-api` | `seedream-api` | 배포 디렉토리 |
| `WowGiftAPI` | `SeedreamGiftAPI` | NSSM 서비스명 |
| `wow_admin_portal` | `seedream_admin_portal` | Admin URL 경로 |

### 2.2. 도메인 / URL

| 현재 | 신규 |
|------|------|
| `wowgift.co.kr` | `seedreamgift.com` |
| `https://wowgift.co.kr` | `https://seedreamgift.com` |
| `.wowgift.co.kr` (쿠키 도메인) | `.seedreamgift.com` |
| `https://wowgift.co.kr/wow_admin_portal/` | `https://seedreamgift.com/seedream_admin_portal/` |

### 2.3. 브랜드 표시명

| 현재 | 신규 |
|------|------|
| `W기프트` | `씨드림기프트` |
| `W GIFT` | `SEEDREAM GIFT` |
| `와우기프트` | `씨드림기프트` |
| `WAIC Inc.` / `Voucher Factory Inc.` | `D&W Group Inc.` |

### 2.4. 이메일

⚠️ 이메일 도메인은 `seedream.com` (사이트 도메인 `seedreamgift.com`과 다름).

| 현재 | 신규 |
|------|------|
| `cs@wowgift.co.kr` | `admin@seedream.com` |
| `compliance@wowgift.co.kr` | `admin@seedream.com` |
| `wow_gift@naver.com` | `admin@seedream.com` |

### 2.5. 회사 정보 (site.config.json / seedreamsite.config.json)

| 필드 | 신규값 |
|------|--------|
| `company.name` | 주식회사 디앤더블유그룹 |
| `company.nameShort` | 씨드림기프트 |
| `company.nameEn` | D&W Group Inc. |
| `company.brand` | SEEDREAM GIFT |
| `company.owner` | 권종달 |
| `company.licenseNo` | 459-88-02135 |
| `company.address` | 경기도 화성시 장안면 장안로 607, 2동 |
| `company.zipCode` | 18583 |
| `company.establishedDate` | 2026-04-21 |
| `contact.phone` / `phoneHref` | 1551-9440 / tel:1551-9440 |
| `contact.email` / `emailHref` | admin@seedream.com / mailto:admin@seedream.com |
| `contact.complianceEmail` | admin@seedream.com |
| `contact.kakao*` | **제거** (3개 필드: kakao, kakaoHref, kakaoHours) |
| `privacy.officer` / `officerTitle` | 권종달 / 대표이사 |
| `privacy.handler` / `handlerTitle` | 권종달 / 개인정보처리담당자 (대표가 겸임하되 법정 역할명은 유지) |
| `privacy.email` / `phone` | admin@seedream.com / 1551-9440 |
| `urls.domain` | seedreamgift.com |
| `urls.home` | https://seedreamgift.com |
| `urls.admin` | https://seedreamgift.com/seedream_admin_portal/ |
| `urls.bizCheck` | https://www.ftc.go.kr/bizCommPop.do?wrkr_no=4598802135 |
| `seo.title` | 씨드림기프트 - 상품권 최저가 구매 · 최고가 판매 |
| `seo.description` | (동일 문구, 브랜드명만 교체) |
| `tradeIn.recipientName` | 주식회사 디앤더블유그룹 |
| `tradeIn.zipCode` / `address` / `phone` | 18583 / 경기도 화성시 장안면 장안로 607, 2동 / 1551-9440 |

### 2.6. DB / 인프라

| 구분 | 현재 | 신규 |
|------|------|------|
| DB 호스트 | 103.97.209.194 | **103.97.209.131** (분리 서버) |
| DB 이름 | WOWGIFT_DB | SEEDREAM_GIFT_DB |
| DB 포트 | 7335 | 7335 (유지) |
| DB 계정/비밀번호/옵션 | (유지) | (유지) |
| Server A (nginx, static) | 103.97.209.205 | (유지) |
| Server B (Go API) | 103.97.209.194 | (유지) — MSSQL은 분리 |
| Server C (MSSQL) | — (없음) | **103.97.209.131** (신규) |

**완성된 DATABASE_URL**:
```
sqlserver://103.97.209.131:7335;database=SEEDREAM_GIFT_DB;user=dnflrhdwnghkdlxldsql;password=dnflrhdwnghkdlxld2024!@;encrypt=true;trustServerCertificate=true
```

---

## 3. File Groups

### G1. 루트 설정·메타 (5 files)

| 파일 | 변경 |
|------|------|
| `site.config.json` | 전체 필드 신규값 |
| `wowsite.config.json` → `seedreamsite.config.json` | **파일 개명** + 전체 필드 |
| `package.json` | `name` (`wow-gift` → `seedream-gift`), `description`, scripts 내 필터 대상 |
| `pnpm-workspace.yaml` | 워크스페이스 이름 참조 확인 |
| `CLAUDE.md` | 프로젝트 제목, 도메인, 배포 경로, 서버 토폴로지(DB 분리 반영) |

### G2. 프론트엔드 (client / admin / partner) — 약 15 files

**client**: `client/index.html`, `client/src/constants/site.ts`, `constants/legal.ts`, `constants/messages.ts`, `styles/presets/default.css`, `public/robots.txt`, `package.json`

**admin**: `admin/src/pages/AdminLoginPage.tsx`, `admin/src/constants/legal.ts`, `admin/package.json`, `admin/vite.config.ts`(`base`)

**partner**: `partner/src/pages/PartnerLoginPage.tsx`, `partner/src/pages/Partner/PartnerPage.tsx`, `partner/src/App.tsx`, `partner/index.html`, `partner/package.json`

⚠️ `client/src/api/generated/`, `partner/src/api/generated/`는 **직접 편집 금지** — Go 서버 리브랜딩 후 `pnpm api:generate` 재생성

### G3. Go 서버 (go-server/) — 약 40 files

| 영역 | 대표 파일 |
|------|----------|
| 빌드 메타 | `go.mod`, `wails.json` |
| 진입점 | `main.go` |
| 설정 | `internal/config/config.go`, `.env`, `.env.production` |
| 보안 | `internal/api/middleware/security_middleware.go` |
| 라우팅 | `internal/routes/*.go` (admin prefix) |
| 서비스 | `internal/app/services/*.go` (약 30 files) |
| 핸들러 | `internal/api/handlers/*.go` |
| 패키지 | `pkg/email/email.go`, `pkg/notification/notification.go`, `pkg/banner/banner.go` |
| 바이너리 | `w-gift-server.exe` **삭제 후 재빌드** → `seedream-gift-server.exe` |

### G4. 배포 스크립트 (scripts/) — 약 10 files

- `deploy-all.ps1`, `deploy-client.ps1`, `deploy-admin.ps1`, `deploy-go-server.ps1`: 경로·NSSM 서비스명
- `setup-nginx-https.ps1`: 도메인, 방화벽 규칙
- `validate-site-config.js`: 파일명 참조(`wowsite.config.json` → `seedreamsite.config.json`)
- `seed_site_configs.go`: 기본값
- `schema-phase2.go`, `schema-optimize.sql`, `run_domain_upgrade.go`: 주석·샘플

### G5. nginx 설정 (config/nginx/) — 3 files

- `nginx.conf`, `nginx-api-server.conf`, `nginx-security.conf`: `server_name`, SSL 경로, CSP, HSTS

### G6. 데이터베이스 / 시드 / API spec

- `server/src/seed.ts`: 브랜드 기본값
- `server/src/shared/seo/sitemap.controller.ts`: sitemap host
- `blacklist/blacklist-openapi.yaml`: API spec의 brand/contact
- Prisma schema: **변경 없음** (테이블명은 도메인 무관)

### G7. 문서

- 루트: `README.md`, `CHANGELOG.md` (3.0.0 항목 추가), `WCAG_ACCESSIBILITY_AUDIT.md`, `ACCESSIBILITY_QUICK_START.md`
- `docs/PRD.md`, `DEPLOYMENT.md`, `API_SPEC.md`, `CUSTOMIZATION_GUIDE.md`, `KYC_INTEGRATION.md`, `SMTP_SETUP.md`, `WINDOWS_NATIVE_ROADMAP.md`, `CLOUDFLARE_SETUP.md`
- `docs/superpowers/specs/2026-03-27-auth-restructure-design.md`, `2026-03-26-voucher-issuance-api-design.md` (참조 부분만)
- `docs/legacy/*`: **변경 없음** — 파일 상단 주석 "레거시 참조용"만 추가

### G8. 제외 대상 (편집하지 않음)

- `admin/dist/**`, `client/dist/**`, `partner/dist/**`
- `go-server/frontend/dist/**`, `go-server/build/**`
- `**/node_modules/**`
- `api.log`, `go-server/logs/*.log`, `scripts/db-migration/wails-build.log`
- `.playwright-mcp/console-*.log`, `client/test-results-production/**`
- `go-server/*.exe`

→ 모두 **재빌드 시 자동 갱신** 또는 이력 파일

---

## 4. Execution Order & Verification Gates

### Phase 1 — 데이터·설정 레이어

1. G1 루트 설정·메타

**Gate ①**:
- `node scripts/validate-site-config.js` 통과
- `licenseNo`(459-88-02135) ↔ `urls.bizCheck` 파라미터(`wrkr_no=4598802135`) 일치

### Phase 2 — 애플리케이션 코드

2. G2 프론트엔드

**Gate ②**:
- `pnpm --filter client build` / `admin build` / `partner build` 성공
- `grep -r "wow\|W기프트" */dist/` 결과 없음

3. G3 Go 서버 (config → middleware → routes → services → pkg → 바이너리)

**Gate ③**:
- `cd go-server && go build ./...` 성공
- `go test ./...` 기존 테스트 전부 통과
- `wails build -platform windows/amd64 -ldflags "-s -w"` 성공, `seedream-gift-server.exe` 생성
- `HEADLESS=true go run .` → `/api/v1/health` 200 응답 (DB 연결 필요 없는 헬스체크)

### Phase 3 — 배포 인프라

4. G4 배포 스크립트
5. G5 nginx 설정

**Gate ④**:
- 스크립트 문자열 일관성(수동 리뷰): 신·구 경로/서비스명 혼재 없음
- nginx 문법(`nginx -t`) 통과
- **실제 서버 배포는 이 단계에서 수행하지 않음** (DNS/SSL 준비 필요)

### Phase 4 — 보조 자산

6. G6 시드·sitemap·API spec
7. G7 문서 (CHANGELOG 3.0.0 항목 포함)

**Gate ⑤**:
- 전역 grep: `wowgift|wow-gift|wow_gift|WowGift|WOW_GIFT|W기프트|W GIFT|와우기프트`
- 잔여가 G8(dist, logs, legacy 문서)에만 있으면 통과

### Phase 5 — 최종 재빌드

8. dist / node_modules / .vite 삭제 후 `pnpm install` + `pnpm build` + `wails build`

**Gate ⑥ (최종)**:
- 재빌드 산출물에 구 브랜드 없음
- CHANGELOG `[3.0.0] - 2026-04-21` 커밋

### 롤백 기준

- Gate 실패 시 해당 Phase 재작업, 이후 Phase 진행 금지
- 각 Phase는 독립 커밋으로 분리 (git 초기화 후)

---

## 5. Risks & Mitigations

| # | Risk | Mitigation |
|---|------|-----------|
| R1 | 기존 WOWGIFT_DB 데이터 이관 필요 시 본 스펙 범위 초과 | 빈 DB 기준으로만 진행. 데이터 이관은 후속 스펙(`2026-XX-db-migration-design.md`) |
| R2 | 기존 운영 환경과의 병행/롤백 | 본 작업은 독립 소스(D:\dev\SeedreamGift)에서만. 기존 wowgift는 별도 유지 |
| R3 | 부분 일치 오치환 (예: `wow` 단독, `WowEffect`) | 매핑 테이블의 **정확한 토큰**만 치환. 단독 `wow`는 수동 검토. Edit 도구는 충분한 맥락 문자열 포함 |
| R4 | ENCRYPTION_KEY 전환 시점 | 빈 DB 기준이므로 신규 키 생성 권장. 데이터 이관 시 R1과 연동 |
| R5 | OpenAPI 생성 클라이언트 수동 편집 금지 | G2에서 `generated/` 제외. G3 완료 후 `pnpm api:generate` 재실행 |
| R6 | SMTP 도메인 전환 (MX/SPF/DKIM) | Out of Scope. 코드 레벨에서는 발신 주소만 `admin@seedream.com` 반영 |

---

## 6. Open Items & Defaults

| # | Item | Default (결정) |
|---|------|---------------|
| U1 | 개인정보처리담당자 | **대표자 권종달 겸임** |
| U2 | `docs/legacy/*` 처리 | **변경 없음 + 상단 "레거시 참조용" 주석** |
| U3 | 신규 DB 초기화 스크립트 | Pre-work 체크리스트에 절차 명시 (실행은 운영 단계) |
| U4 | git 저장소 초기화 | **Pre-work 권장** — 실제 실행은 사용자 판단 |

---

## 7. Pre-work Checklist (본 구현 착수 전)

- [ ] `git init && git add . && git commit -m "chore: snapshot before seedream rebrand"` (권장)
- [ ] Server C (103.97.209.131)에서 MSSQL 인스턴스 접근 가능 확인
- [ ] SEEDREAM_GIFT_DB 생성 + 사용자 `dnflrhdwnghkdlxldsql` 권한 부여
- [ ] Server B → Server C:7335 방화벽 허용
- [ ] 새 도메인 `seedreamgift.com` DNS 소유권 확보(후속)
- [ ] SSL 인증서 발급(후속, Cloudflare 또는 Let's Encrypt)

---

## 8. Post-rebrand Verification

### 최종 grep 패턴 (모든 매치가 사라져야 함)

```bash
# 코드 식별자
grep -rE "wow[-_]?gift|WowGift|WOW_GIFT|w-gift-server|wgift-api|WowGiftAPI|wow_admin_portal" \
  --exclude-dir={node_modules,dist,logs,test-results-production,.playwright-mcp} \
  --exclude="*.log" --exclude="*.exe"

# 도메인
grep -rE "wowgift\.co\.kr" --exclude-dir={node_modules,dist,...}

# 브랜드
grep -rE "W기프트|와우기프트|W GIFT" --exclude-dir={...}

# 이메일
grep -rE "wow_gift@|@wowgift\.co\.kr" --exclude-dir={...}

# DB
grep -rE "WOWGIFT_DB|103\.97\.209\.194:7335" --exclude-dir={...}
```

### 허용 잔여 패턴

- `docs/legacy/*.md` 본문 (historical)
- `CHANGELOG.md`의 2.x.x 이전 항목 (historical)
- 재빌드되지 않은 dist/logs (G8)

### 기능 smoke test

- 프론트 3종 빌드 후 `index.html` `<title>` 확인
- Go 서버 기동 → `/api/v1/health` 200
- Go 서버 → MSSQL 연결 확인(`DATABASE_URL`로 연결 시도, 쿼리 1건)

---

## 9. Out of Scope

다음은 본 스펙의 범위가 **아니며** 별도 작업으로 처리:

1. **데이터 이관**: WOWGIFT_DB 실데이터 → SEEDREAM_GIFT_DB
2. **SSL/DNS 전환**: seedreamgift.com 도메인 등록, DNS 레코드 작성, 인증서 발급
3. **SMTP 전환**: seedream.com 도메인의 MX/SPF/DKIM 설정 및 기존 메일 이력 이전
4. **운영 배포**: 신규 서버 구성 후의 실제 릴리즈 작업(NSSM install, nginx 활성화, 헬스체크)
5. **모니터링·로깅 재구성**: 기존 대시보드·알림 채널의 신 브랜드 반영
6. **기존 사이트 종료 계획**: wowgift.co.kr의 sunset 공지·리다이렉트 전략
7. **법률·세무 등록**: 사업자 정보 변경에 따른 법인·세무·전자상거래법 신고
