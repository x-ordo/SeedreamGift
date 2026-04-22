/**
 * @file auth.setup.ts
 * @description 프로덕션 E2E 인증 셋업 — storageState로 로그인 세션을 저장하여
 *              테스트마다 반복 로그인 방지 (Rate Limiting 회피)
 */
import { test as setup, expect } from '@playwright/test';

const PROD_URL = 'https://www.wowgift.co.kr';

const USERS = {
  user: { email: 'user@example.com', password: 'test1234' },
  admin: { email: 'admin@example.com', password: 'admin1234' },
  partner: { email: 'partner@example.com', password: 'test1234' },
};

setup('authenticate as user', async ({ page }) => {
  await page.goto(`${PROD_URL}/login`);
  await page.waitForLoadState('networkidle');
  await page.fill('input[name="email"]', USERS.user.email);
  await page.fill('input[name="password"]', USERS.user.password);
  await page.click('button[type="submit"]');
  await page.waitForURL(
    (url) => !url.pathname.includes('/login'),
    { timeout: 30000 },
  );
  await expect(page.locator('#user-menu-button')).toBeVisible({ timeout: 10000 });
  await page.context().storageState({ path: '.auth/user.json' });
});

setup('authenticate as admin', async ({ page }) => {
  await page.goto(`${PROD_URL}/admin/login`);
  await page.waitForLoadState('networkidle');
  await page.fill('input[name="email"]', USERS.admin.email);
  await page.fill('input[name="password"]', USERS.admin.password);
  await page.click('button[type="submit"]');
  await page.waitForURL(
    (url) => url.pathname.startsWith('/admin') && !url.pathname.includes('login'),
    { timeout: 15000 },
  );
  await expect(page.locator('.admin-sidebar')).toBeVisible({ timeout: 10000 });
  await page.context().storageState({ path: '.auth/admin.json' });
});
