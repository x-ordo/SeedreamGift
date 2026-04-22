# Seedream Gift - 상품권 거래 플랫폼

**NestJS + React + MSSQL 기반 모바일 상품권 판매/매입 플랫폼**

> 참조 사이트: yk24.shop (Classic ASP) → 현대화된 TypeScript 스택으로 재구현

---

## 핵심 기능

- **상품권 판매**: 신세계, 현대, 롯데, 다이소, 올리브영
- **상품권 매입**: PIN 코드 입력 → 계좌 입금
- **권한 체계**: ADMIN (전체), PARTNER (대량 할인), USER (KYC 필요)
- **결제**: Mock 게이트웨이 (실제 연동 준비됨)

---

## 기술 스택

| 분류 | 기술 |
|------|------|
| **Backend** | NestJS, TypeScript, Prisma ORM |
| **Frontend** | React 18, Vite, Zustand |
| **Database** | Microsoft SQL Server |
| **Process** | PM2 (Windows Service) |
| **Package** | pnpm workspace monorepo |

---

## 문서

| 카테고리 | 문서 | 설명 |
|----------|------|------|
| 분석 | [00_YK24_CRAWL_ANALYSIS.md](docs/00_YK24_CRAWL_ANALYSIS.md) | 원본 사이트 크롤링 데이터 분석 |
| 요구사항 | [01_PRD.md](docs/01_PRD.md) | 프로젝트 목표, 사용자 역할 |
| 아키텍처 | [02_ARCHITECTURE.md](docs/02_ARCHITECTURE.md) | 시스템 설계, 디렉토리 구조 |
| 데이터베이스 | [03_ERD.md](docs/03_ERD.md) | ERD, 스키마 사전 |
| 배포 | [04_DEPLOYMENT.md](docs/04_DEPLOYMENT.md) | 빌드, PM2, Windows 호스팅 |
| API | [05_API_SPEC.md](docs/05_API_SPEC.md) | REST API 명세 |
| 페이지 | [06_PAGE_SPEC.md](docs/06_PAGE_SPEC.md) | UI/UX 명세 |
| 디자인 | [07_DESIGN_SYSTEM.md](docs/07_DESIGN_SYSTEM.md) | Swift Trust 디자인 시스템 |
| 테스트 | [08_TEST_SPEC.md](docs/08_TEST_SPEC.md) | 테스트 명세 |
| 컴포넌트 | [08_UI_COMPONENTS.md](docs/08_UI_COMPONENTS.md) | UI 컴포넌트 인덱스 |
| 유스케이스 | [09_USE_CASES.md](docs/09_USE_CASES.md) | 사용자 시나리오 |
| 접근성 | [10_ACCESSIBILITY_AUDIT.md](docs/10_ACCESSIBILITY_AUDIT.md) | WCAG 2.1 AA 감사 |
| API 체크리스트 | [11_API_DESIGN_CHECKLIST.md](docs/11_API_DESIGN_CHECKLIST.md) | API 설계 규칙 |
| DDD 로드맵 | [11_DDD_IMPLEMENTATION_ROADMAP.md](docs/11_DDD_IMPLEMENTATION_ROADMAP.md) | DDD 적용 6주 로드맵 |

---

## 빠른 시작

### 1. 설치

```powershell
pnpm install
pnpm prisma:push    # DB 스키마 적용
```

### 2. 개발 서버

```powershell
pnpm dev
```

| 서비스 | URL |
|--------|-----|
| Frontend | http://localhost:5173 |
| Backend | http://localhost:5140 |
| Swagger | http://localhost:5140/api/docs |

### 3. 빌드

```powershell
pnpm build
```

### 4. 배포 패키지 생성

```powershell
.\scripts\build-package.ps1
# → deploy\deploy-package-{timestamp}.zip
```

---

## 프로젝트 구조

```
seedream-gift/
├── client/                 # React 프론트엔드
│   ├── src/
│   │   ├── api/generated/  # OpenAPI 자동 생성
│   │   ├── components/     # UI 컴포넌트
│   │   ├── constants/      # 중앙화된 상수
│   │   ├── contexts/       # Auth, Toast, Modal
│   │   ├── design-system/  # Atomic 컴포넌트
│   │   ├── pages/          # 라우트 페이지
│   │   ├── store/          # Zustand
│   │   └── utils/          # 유틸리티
│   └── public/             # 정적 파일
├── server/                 # NestJS 백엔드
│   ├── src/
│   │   ├── modules/        # 비즈니스 모듈 (11개)
│   │   └── shared/         # 공통 서비스 (auth, crypto, payment, prisma)
│   └── prisma/             # DB 스키마 + seed
├── scripts/                # 배포/운영 스크립트 (PowerShell)
├── docs/                   # 프로젝트 문서 (15개)
└── deploy/                 # 배포 패키지
```

---

## 운영 환경

| 항목 | 값 |
|------|-----|
| 서비스 URL | https://seedreamgift.com |
| API 문서 | https://seedreamgift.com/api/docs |
| 운영 경로 | `C:\deploy-server\seedream-gift` |

---

## 변경 이력

### v2.0.0 (2026-01-30)

**프로젝트 정리**
- yk24.shop 크롤링 데이터 분석 문서 추가 (`docs/00_YK24_CRAWL_ANALYSIS.md`)
- 레거시 파일 삭제 (Express/SQLite, 크롤링 스크립트)
- 디버그 파일 정리

**이전 변경사항**
- NestJS + React 스택으로 전체 재구현
- Swift Trust 디자인 시스템 적용
- WCAG 2.1 AA 접근성 준수
- JWT 인증 + AES-256 암호화

---

## 라이선스

Private - JTBAMC Co., Ltd.
