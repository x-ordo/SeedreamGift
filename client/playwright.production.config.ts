import { defineConfig, devices } from '@playwright/test';

/**
 * 프로덕션 E2E 테스트 설정
 *
 * 구조:
 *   1. setup       — 로그인 1회 수행 → .auth/*.json에 쿠키 저장
 *   2. user-tests  — user storageState로 시나리오 2~5, 7 실행
 *   3. admin-tests — admin storageState로 시나리오 6, 8 실행
 *   4. public-tests — 인증 불필요 시나리오 (01-public-pages)
 *   5. mobile       — 모바일 반응형 테스트
 *
 * 실행: npx playwright test --config=playwright.production.config.ts
 */
export default defineConfig({
  testDir: './test/e2e/production',
  fullyParallel: false,
  forbidOnly: true,
  retries: 1,
  workers: 1,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report/production' }],
  ],
  outputDir: 'test-results-production',
  use: {
    baseURL: 'https://www.wowgift.co.kr',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    actionTimeout: 15000,
    navigationTimeout: 30000,
    ignoreHTTPSErrors: true,
  },
  projects: [
    // 0. Auth setup — 로그인 세션 생성 (user + admin)
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
    },

    // 1. 비로그인 공개 페이지 (storageState 불필요)
    {
      name: 'public-tests',
      use: { ...devices['Desktop Chrome'] },
      testMatch: /01-public/,
    },

    // 2. 인증 플로우 테스트 (로그인/로그아웃 자체를 테스트하므로 storageState 불필요)
    {
      name: 'auth-tests',
      use: { ...devices['Desktop Chrome'] },
      testMatch: /02-auth/,
    },

    // 3. 사용자 로그인 필요 테스트 (장바구니, 구매, 매입)
    {
      name: 'user-tests',
      use: {
        ...devices['Desktop Chrome'],
        storageState: '.auth/user.json',
      },
      dependencies: ['setup'],
      testMatch: /0[345]-/,
    },

    // 4. 관리자 로그인 필요 테스트 (관리자 페이지, 상품/재고 관리)
    {
      name: 'admin-tests',
      use: {
        ...devices['Desktop Chrome'],
        storageState: '.auth/admin.json',
      },
      dependencies: ['setup'],
      testMatch: /0[68]-/,
    },

    // 5. 반응형 + 보안 테스트 (로그인 필요 테스트 포함)
    {
      name: 'responsive-security',
      use: {
        ...devices['Desktop Chrome'],
        storageState: '.auth/user.json',
      },
      dependencies: ['setup'],
      testMatch: /07-responsive/,
    },

    // 6. 모바일 반응형 테스트
    {
      name: 'mobile-chrome',
      use: {
        ...devices['Pixel 5'],
        storageState: '.auth/user.json',
      },
      dependencies: ['setup'],
      testMatch: /07-responsive/,
    },
  ],
  timeout: 60000,
});
