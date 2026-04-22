# 신규 사이트 세팅 체크리스트

> 외주 납품 시 아래 항목을 순서대로 진행합니다.

## 필수 변경

### 브랜드 아이덴티티
- [ ] `client/src/styles/tokens.css`: `--color-primary`, `--color-primary-hover`, `--color-primary-active`, `--color-primary-light` 변경
- [ ] `client/src/styles/tokens.css`: `--shadow-primary` rgba 값 동기화
- [ ] `client/src/index.css`: daisyUI `@plugin "daisyui/theme"` 내 `--color-primary` oklch 값 동기화
- [ ] `client/public/logo.svg`: 로고 교체
- [ ] `client/public/favicon.ico`: 파비콘 교체
- [ ] `client/public/og-image.png`: SNS 공유 이미지 교체

### 사업자 정보
- [ ] `client/src/constants/site.ts`: `COMPANY_INFO` (상호, 대표, 사업자번호, 주소)
- [ ] `client/src/constants/site.ts`: `SUPPORT_CONTACT` (전화, 카카오, 이메일)
- [ ] `client/src/components/layout/Footer.tsx`: 푸터 사업자 정보 확인

### 서버 설정
- [ ] `go-server/.env.production`: `DATABASE_URL`, `JWT_SECRET`, `ENCRYPTION_KEY`
- [ ] `go-server/.env.production`: `FRONTEND_URL`, `COOKIE_DOMAIN`
- [ ] `config/nginx/nginx.conf`: `server_name`, SSL 인증서, upstream IP

### 빌드/배포
- [ ] `client/.env.production`: `VITE_API_TARGET` 변경
- [ ] `wails build -platform windows/amd64` (Go API 빌드)
- [ ] `pnpm build` (프론트엔드 빌드)
- [ ] Server A: client dist 배포
- [ ] Server B: Go API 배포 + NSSM 서비스 재시작

---

## 선택 변경

### 디자인 커스텀
- [ ] `client/src/styles/tokens.css`: `--color-point` (골드 액센트 변경)
- [ ] `client/src/styles/tokens.css`: `--radius-*` (둥글기 조정)
- [ ] `client/src/styles/tokens.css`: `--shadow-*` (그림자 강도)
- [ ] `client/src/styles/typography.css`: 폰트 교체
- [ ] `client/src/styles/tokens.css`: `--font-family-base` 변경

### 콘텐츠 커스텀
- [ ] `client/src/constants/brandTheme.ts`: 취급 브랜드 목록
- [ ] `client/src/styles/tokens.css`: `[data-brand="..."]` 브랜드 테마
- [ ] `client/src/components/home/HeroSection.tsx`: 히어로 문구/이미지
- [ ] `client/src/components/home/HowToGuide.tsx`: 이용 가이드 문구
- [ ] SEO 메타 태그: 각 페이지 `<SEO>` 컴포넌트 title/description

### Admin 설정
- [ ] `admin/src/constants/`: 관리자 페이지 설정
- [ ] DB SiteConfig 테이블: 입금 계좌, 운영 설정

---

## 검증

- [ ] 로컬 개발 서버 실행 (`pnpm dev`) — 색상/로고 확인
- [ ] 로그인/회원가입 플로우 테스트
- [ ] 상품권 구매 → 결제 → PIN 발급 플로우
- [ ] 상품권 매입 신청 플로우
- [ ] 마이페이지 주문/판매 내역 확인
- [ ] 모바일 반응형 확인
- [ ] SSL/HTTPS 접속 확인
- [ ] 프로덕션 빌드 → 배포 → 스모크 테스트
