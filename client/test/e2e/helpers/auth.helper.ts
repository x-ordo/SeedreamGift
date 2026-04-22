/**
 * @file auth.helper.ts
 * @description Playwright 테스트용 인증 헬퍼
 */
import { Page, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';

/**
 * 테스트 사용자 자격 증명
 */
/**
 * 테스트 사용자 자격 증명 (시드 데이터와 일치)
 * - 서버의 test/helpers/test-users.ts와 동일한 비밀번호 사용
 */
export const TEST_USERS = {
  user: {
    email: 'user@example.com',
    password: 'test1234',  // 서버 시드 데이터 기준
    name: 'Test User',
  },
  admin: {
    email: 'admin@example.com',
    password: 'admin1234',
    name: 'Test Admin',
  },
  admin2: {
    email: 'admin2@example.com',
    password: 'user1234',
    name: 'Admin2',
  },
  partner: {
    email: 'partner@example.com',
    password: 'test1234',  // 서버 시드 데이터 기준
    name: 'Test Partner',
  },
} as const;

export type UserType = keyof typeof TEST_USERS;

/**
 * 로그인 페이지로 이동
 */
export async function goToLoginPage(page: Page): Promise<void> {
  await page.goto(`${BASE_URL}/login`);
  await expect(page).toHaveURL(/.*login/);
}

/**
 * 로그인 수행
 */
export async function login(
  page: Page,
  email: string,
  password: string,
): Promise<void> {
  await page.goto(`${BASE_URL}/login`);

  // 로그인 폼 작성 (현재 UI: name 속성 사용)
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');

  // 로그인 후 홈으로 리다이렉트 대기
  await page.waitForURL(
    (url) => url.pathname === '/' || url.pathname === '',
    { waitUntil: 'networkidle', timeout: 15000 },
  );
}

/**
 * 테스트 사용자로 로그인
 */
export async function loginAs(page: Page, userType: UserType): Promise<void> {
  const user = TEST_USERS[userType];
  await login(page, user.email, user.password);
}

/**
 * 관리자 전용 로그인 (관리자 로그인 페이지 사용)
 * - 관리자는 /admin/login 페이지를 통해서만 로그인 가능
 * - 로그인 성공 시 /admin으로 리다이렉트
 */
export async function adminLogin(
  page: Page,
  email: string,
  password: string,
): Promise<void> {
  await page.goto(`${BASE_URL}/admin/login`);

  // 로그인 폼 작성
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');

  // 관리자 페이지로 리다이렉트 대기
  await page.waitForURL(
    (url) => url.pathname.startsWith('/admin'),
    { waitUntil: 'networkidle', timeout: 15000 },
  );
}

/**
 * 관리자로 로그인 (admin 또는 admin2 시도)
 */
export async function loginAsAdmin(page: Page): Promise<void> {
  try {
    await adminLogin(page, TEST_USERS.admin.email, TEST_USERS.admin.password);
  } catch {
    // admin 계정 실패 시 admin2 시도
    await adminLogin(page, TEST_USERS.admin2.email, TEST_USERS.admin2.password);
  }
}

/**
 * 로그인 상태 확인
 */
export async function verifyLoggedIn(page: Page): Promise<void> {
  // 사용자 메뉴 버튼이 보이면 로그인 상태
  const userBtn = page.locator('#user-menu-button');
  await expect(userBtn).toBeVisible({ timeout: 10000 });
}

/**
 * 로그아웃 수행
 */
export async function logout(page: Page): Promise<void> {
  const userBtn = page.locator('#user-menu-button');
  await expect(userBtn).toBeVisible();
  await userBtn.click();
  await page.click('text=로그아웃');

  // 로그아웃 후 로그인 버튼이 보여야 함
  await expect(page.locator('text=로그인')).toBeVisible();
}

/**
 * 로그인 상태가 아닌지 확인
 */
export async function verifyLoggedOut(page: Page): Promise<void> {
  const userBtn = page.locator('#user-menu-button');
  await expect(userBtn).not.toBeVisible();
  await expect(page.locator('a[href="/login"]')).toBeVisible();
}

/**
 * 사용자 메뉴 열기
 */
export async function openUserMenu(page: Page): Promise<void> {
  const userBtn = page.locator('#user-menu-button');
  await expect(userBtn).toBeVisible();
  await userBtn.click();
}

/**
 * 마이페이지로 이동
 */
export async function goToMyPage(page: Page): Promise<void> {
  await openUserMenu(page);
  await page.click('a[href="/mypage"]');
  await page.waitForURL(/.*mypage/);
}

/**
 * 관리자 페이지로 이동 (관리자 로그인 필요)
 * - 이미 /admin 페이지에 있으면 확인만 수행
 * - 아니면 사용자 메뉴를 통해 이동
 */
export async function goToAdminPage(page: Page): Promise<void> {
  // 이미 admin 페이지에 있으면 확인만
  if (page.url().includes('/admin')) {
    await expect(page.locator('text=관리 대시보드')).toBeVisible();
    return;
  }

  // 사용자 메뉴를 통해 이동
  await openUserMenu(page);
  await page.click('text=관리자');
  await expect(page.locator('text=관리 대시보드')).toBeVisible();
}

/**
 * 스크린샷 캡처 (디버깅용)
 */
export async function captureScreenshot(
  page: Page,
  name: string,
): Promise<void> {
  await page.screenshot({ path: `test-results/${name}.png` });
}

/**
 * 로그인 실패 시 스크린샷 캡처 후 에러 던지기
 */
export async function handleLoginFailure(
  page: Page,
  error: Error,
  screenshotName: string = 'login-failure',
): Promise<never> {
  await captureScreenshot(page, screenshotName);
  throw error;
}
