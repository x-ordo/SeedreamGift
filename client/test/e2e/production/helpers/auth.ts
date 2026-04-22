/**
 * @file auth.ts
 * @description 프로덕션 E2E 테스트 - 인증 헬퍼
 *
 * storageState 기반:
 *   auth.setup.ts가 미리 로그인 → 쿠키 저장 (.auth/user.json, .auth/admin.json)
 *   각 테스트는 storageState를 통해 쿠키를 물려받아 자동 인증됨
 *   login/adminLogin은 storageState가 있으면 페이지 이동만 수행
 */
import { Page, expect } from '@playwright/test';

export const PROD_URL = 'https://www.wowgift.co.kr';

export const TEST_USERS = {
  user: { email: 'user@example.com', password: 'test1234' },
  admin: { email: 'admin@example.com', password: 'admin1234' },
  partner: { email: 'partner@example.com', password: 'test1234' },
} as const;

export type UserType = keyof typeof TEST_USERS;

/**
 * 일반 사용자 로그인
 * - storageState가 제공된 경우: 홈으로 이동 → refresh token 자동 사용
 * - storageState가 없는 경우: 로그인 폼 작성
 * - Rate Limiting 방지: storageState 실패 시 리로드 재시도
 */
export async function login(page: Page, email: string, password: string) {
  // storageState 쿠키로 이미 인증된 상태인지 확인
  await page.goto(`${PROD_URL}/`);
  await page.waitForLoadState('networkidle');
  let alreadyLoggedIn = await page
    .locator('#user-menu-button')
    .isVisible({ timeout: 10000 })
    .catch(() => false);

  if (alreadyLoggedIn) return;

  // storageState가 즉시 작동하지 않을 수 있음 → 리로드 1회 재시도
  await page.reload({ waitUntil: 'networkidle' });
  alreadyLoggedIn = await page
    .locator('#user-menu-button')
    .isVisible({ timeout: 10000 })
    .catch(() => false);

  if (alreadyLoggedIn) return;

  // 미인증 → 직접 로그인 (Rate Limiting 주의)
  await page.goto(`${PROD_URL}/login`);
  await page.waitForLoadState('networkidle');
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(
    (url) => !url.pathname.includes('/login'),
    { timeout: 30000 },
  );
}

/** 역할별 로그인 */
export async function loginAs(page: Page, role: UserType) {
  const creds = TEST_USERS[role];
  await login(page, creds.email, creds.password);
}

/**
 * 관리자 로그인
 * - storageState가 제공된 경우: /admin으로 이동 → refresh token 자동 사용
 * - storageState가 없는 경우: /admin/login 폼 작성
 * - Rate Limiting 방지: storageState 실패 시 페이지 리로드 재시도 후 최후 수단으로 로그인
 */
export async function adminLogin(page: Page) {
  // storageState 쿠키로 이미 인증된 상태인지 확인
  await page.goto(`${PROD_URL}/admin`);
  await page.waitForLoadState('networkidle');
  let alreadyAdmin = await page
    .locator('.admin-sidebar')
    .isVisible({ timeout: 15000 })
    .catch(() => false);

  if (alreadyAdmin) return;

  // storageState가 즉시 작동하지 않을 수 있음 → 리로드 1회 재시도
  await page.reload({ waitUntil: 'networkidle' });
  alreadyAdmin = await page
    .locator('.admin-sidebar')
    .isVisible({ timeout: 15000 })
    .catch(() => false);

  if (alreadyAdmin) return;

  // 미인증 → 직접 관리자 로그인 (Rate Limiting 주의)
  const { email, password } = TEST_USERS.admin;
  await page.goto(`${PROD_URL}/admin/login`);
  await page.waitForLoadState('networkidle');
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(
    (url) => url.pathname.startsWith('/admin') && !url.pathname.includes('login'),
    { timeout: 15000 },
  );
}

/** 로그인 상태 검증 */
export async function expectLoggedIn(page: Page) {
  await expect(page.locator('#user-menu-button')).toBeVisible({ timeout: 10000 });
}

/** 비로그인 상태 검증 */
export async function expectLoggedOut(page: Page) {
  await expect(page.locator('#user-menu-button')).not.toBeVisible();
  await expect(page.locator('a[href="/login"]')).toBeVisible();
}

/** 로그아웃 */
export async function logout(page: Page) {
  await page.locator('#user-menu-button').click();
  await page.click('text=로그아웃');
  await expect(page.locator('a[href="/login"]')).toBeVisible({ timeout: 10000 });
}

/** 마이페이지 이동 */
export async function goToMyPage(page: Page) {
  await page.locator('#user-menu-button').click();
  await page.click('a[href="/mypage"]');
  await page.waitForURL(/.*mypage/);
}
