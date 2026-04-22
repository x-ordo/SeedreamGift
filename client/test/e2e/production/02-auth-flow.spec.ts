/**
 * @file 02-auth-flow.spec.ts
 * @description Scenario 2: 인증 플로우 테스트
 */
import { test, expect } from '@playwright/test';
import {
  PROD_URL,
  login,
  loginAs,
  logout,
  expectLoggedIn,
  expectLoggedOut,
  attachConsoleErrorCollector,
} from './helpers';

test.describe('Scenario 2: 인증 플로우', () => {
  let consoleErrors: string[];

  test.beforeEach(async ({ page }) => {
    consoleErrors = attachConsoleErrorCollector(page);
  });

  test('2-1: 로그인 페이지 렌더링', async ({ page }) => {
    await page.goto(`${PROD_URL}/login`);

    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('2-2: 잘못된 비밀번호 → 에러 메시지', async ({ page }) => {
    await page.goto(`${PROD_URL}/login`);
    await page.fill('input[name="email"]', 'user@example.com');
    await page.fill('input[name="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');

    // 로그인 실패 에러: "로그인에 실패했습니다" 또는 서버 메시지
    const errorMsg = page.locator('text=/실패|올바르지|Unauthorized/');
    await expect(errorMsg.first()).toBeVisible({ timeout: 10000 });

    // 여전히 로그인 페이지에 머물러야 함
    expect(page.url()).toContain('/login');
  });

  test('2-3: 정상 로그인 → 헤더 사용자 메뉴', async ({ page }) => {
    await loginAs(page, 'user');
    await expectLoggedIn(page);

    const userBtn = page.locator('#user-menu-button');
    await expect(userBtn).toBeVisible();
  });

  test('2-4: 회원가입 페이지 확인', async ({ page }) => {
    await page.goto(`${PROD_URL}/register`);

    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
    await expect(page.locator('input[name="name"]')).toBeVisible();
  });

  test('2-5: 로그아웃', async ({ page }) => {
    await loginAs(page, 'user');
    await expectLoggedIn(page);

    await logout(page);
    await expectLoggedOut(page);
  });

  test('2-6: 파트너 계정 로그인', async ({ page }) => {
    await loginAs(page, 'partner');
    await expectLoggedIn(page);
  });
});
