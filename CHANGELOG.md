# Changelog

All notable changes to this project will be documented in this file.

## [3.0.0] - 2026-04-21

### Changed (리브랜딩)
- **프로젝트명**: W Gift(wowgift.co.kr) → **Seedream Gift(seedreamgift.com)**
- **법인**: 주식회사 더블유에이아이씨 → 주식회사 디앤더블유그룹
- **대표자**: 권학재 → 권종달
- **사업자등록번호**: 731-87-02461 → 459-88-02135
- **브랜드명**: W기프트 / W GIFT → 씨드림기프트 / SEEDREAM GIFT
- **이메일**: cs@wowgift.co.kr / compliance@wowgift.co.kr → admin@seedream.com
- **전화**: 02-569-7334 → 1551-9440
- **주소**: 서울 강남 테헤란로 → 경기 화성시 장안면 장안로 607

### Infra (신규 / 분리)
- **DB 서버 분리**: 기존 Server B 공존 → **Server C (103.97.209.131)** 전용 MSSQL
- **DB 이름**: WOWGIFT_DB → SEEDREAM_GIFT_DB
- **NSSM 서비스**: WowGiftAPI → SeedreamGiftAPI
- **Go 모듈**: w-gift-server → seedream-gift-server
- **배포 경로**: C:\deploy-server\wow-gift / \wgift-api → \seedream-gift / \seedream-api
- **Admin URL**: /wow_admin_portal/ → /seedream_admin_portal/
- **Partner URL**: /wow_partner_portal/ → /seedream_partner_portal/

### Removed
- 카카오 채널 플로팅 버튼 컴포넌트 (신규 채널 미확정)
- 파일 `wowsite.config.json` 개명 → `seedreamsite.config.json`

---

## [2.1.0] - 2026-02-16

### Added
- **Support Hub**: 1:1 문의 시스템 (Inquiry) 추가
- **Transaction Stats**: 상품별 거래 통계 및 인기 상품 로직 추가
- **Payment Abstraction**: Payment Provider 인터페이스 도입 및 Mock 구현
- **Deployment**: Nginx HTTPS 설정 자동화 스크립트 및 개선된 빌드 프로세스
- **Admin**: 상품 관리, 재고 관리, 매입 관리 기능 고도화
- **UX**: 실시간 대시보드(LiveDashboard), 상품권 구매/매입 UI 개선

### Changed
- **UI/UX**: 전체적인 Swift Trust 디자인 시스템 고도화 및 접근성 개선
- **Security**: Throttler(Rate Limit) 적용 및 감사 로그(Audit) 강화
- **KYC**: 본인인증 로직 고도화 및 상태 관리 개선
- **Server**: BaseCrudService 개선 및 모듈 간 의존성 정리

## [2.0.0] - 2026-01-30

### Added
- `docs/00_YK24_CRAWL_ANALYSIS.md` - yk24.shop 크롤링 데이터 분석 문서
  - 15개 HTML 페이지 기능 분석
  - 기술 스택 분석 (Bootstrap 5, Swiper, AOS, Classic ASP)
  - API 엔드포인트 문서화
  - WowGift React 구현 매핑

### Removed
- **크롤링 데이터** (public/)
  - HTTrack 미러 HTML 파일
  - yk24.shop 정적 리소스 (CSS, JS, 이미지)

- **레거시 파일**
  - `server.js` - Express 서버
  - `database.js` - SQLite 설정
  - `seed.js` - 레거시 시더

- **크롤링 스크립트**
  - `crawl_yk24.js`
  - `crawl_deep_yk24.js`
  - `login_yk24.js`

- **디버그 파일**
  - `103.97.209.205.har`
  - `test_debug.txt`
  - `test_debug_2.txt`
  - `package-lock.json` (pnpm 사용 중)

### Changed
- README.md 전면 개편
- 프로젝트 문서 구조 정리

---

## [1.x.x] - 이전 버전

### Features
- NestJS + TypeScript 백엔드
- React 18 + Vite 프론트엔드
- Prisma ORM + MSSQL 데이터베이스
- JWT 인증 + AES-256 암호화
- Swift Trust 디자인 시스템
- WCAG 2.1 AA 접근성 준수
- PM2 Windows Service 배포

### Modules
- **admin**: 관리자 대시보드, KYC 처리
- **orders**: 주문 생성, 일일 한도
- **product**: 상품 CRUD, 매입가 계산
- **trade-in**: 매입 신청, PIN 암호화
- **users**: 사용자 관리
- **voucher**: PIN 재고 관리
- **site-config**: 동적 설정

### Pages
- HomePage - 상품 목록
- ProductListPage - 상품 필터링
- ProductDetailPage - 상품 상세
- CheckoutPage - 장바구니/결제
- TradeInPage - 매입 신청
- MyPage - 주문/매입 내역
- AdminPage - 관리자 대시보드
- LoginPage / RegisterPage - 인증
