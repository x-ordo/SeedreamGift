import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:5173';

test.describe('와우기프트 핵심 시나리오 테스트', () => {
  test.beforeEach(async ({ page }) => {
    page.on('console', msg => {
      if (msg.type() === 'error' || msg.text().includes('[AuthStore]')) {
        console.log(`BROWSER ${msg.type().toUpperCase()}: ${msg.text()}`);
      }
    });
  });

  test('로그인 및 마이페이지 접근 테스트', async ({ page }) => {
    await page.goto(BASE_URL);
    await expect(page).toHaveTitle(/W Gift/);

    await page.click('a[href="/login"]');
    await expect(page).toHaveURL(/.*login/);

    await page.fill('input[name="email"]', 'user@example.com');
    await page.fill('input[name="password"]', 'test1234');
    await page.click('button[type="submit"]');

    await page.waitForURL(url => (url.pathname === '/' || url.pathname === ''), { waitUntil: 'networkidle', timeout: 15000 });

    const userBtn = page.locator('#user-menu-button');
    try {
      await expect(userBtn).toBeVisible({ timeout: 10000 });
    } catch (e) {
      await page.screenshot({ path: 'test-results/login-failure.png' });
      throw e;
    }
    await userBtn.click();

    await page.click('a[href="/mypage"]');
    await page.waitForURL(/.*mypage/);
    const hasUserName = await page.locator('text=홍길동').or(page.locator('text=님')).first().isVisible({ timeout: 5000 }).catch(() => false);
    expect(hasUserName).toBe(true);
  });

  test('어드민 페이지 보안 및 접근 테스트', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/login`);
    await page.fill('input[name="email"]', 'admin@example.com');
    await page.fill('input[name="password"]', 'admin1234');
    await page.click('button[type="submit"]');

    await page.waitForURL(url => url.pathname.startsWith('/admin'), { waitUntil: 'networkidle', timeout: 15000 });

    await expect(page.locator('text=관리 대시보드')).toBeVisible({ timeout: 10000 });

    const sidebar = page.locator('.admin-sidebar');
    await sidebar.locator('text=회원 관리').click();
    await expect(page.locator('h3')).toContainText('회원 관리');
  });

  test('상품 목록 필터링 테스트', async ({ page }) => {
    await page.goto(`${BASE_URL}/products`);

    const shinsegaeCard = page.locator('.brand-card-vertical, .brand-card, [data-brand]').filter({ hasText: '신세계' }).first();
    await expect(shinsegaeCard).toBeVisible({ timeout: 15000 });
    await shinsegaeCard.click();

    await expect(page.locator('h1, .page-title')).toContainText('신세계');

    const addBtn = page.locator('button, [role="button"]').filter({ hasText: /담기/ }).first();
    await expect(addBtn).toBeVisible({ timeout: 10000 });
  });

  test('로그아웃 기능 테스트', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[name="email"]', 'user@example.com');
    await page.fill('input[name="password"]', 'test1234');
    await page.click('button[type="submit"]');
    await page.waitForURL(url => (url.pathname === '/' || url.pathname === ''), { waitUntil: 'networkidle', timeout: 15000 });

    const userBtn = page.locator('#user-menu-button');
    await userBtn.click();
    await page.click('text=로그아웃');

    await expect(page.locator('text=로그인')).toBeVisible();
    await expect(userBtn).not.toBeVisible();
  });
});
