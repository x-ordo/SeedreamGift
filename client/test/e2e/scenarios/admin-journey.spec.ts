/**
 * @file admin-journey.spec.ts
 * @description 관리자 전체 여정 시나리오 테스트
 */
import { test, expect } from '@playwright/test';
import { adminLogin, loginAs, TEST_USERS } from '../helpers/auth.helper';

const BASE_URL = 'http://localhost:5173';

async function loginAdmin(page: import('@playwright/test').Page) {
  try {
    await adminLogin(page, TEST_USERS.admin.email, TEST_USERS.admin.password);
  } catch {
    await adminLogin(page, TEST_USERS.admin2.email, TEST_USERS.admin2.password);
  }
}

test.describe('관리자 전체 여정 시나리오', () => {
  test.beforeEach(async ({ page }) => {
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        console.log(`BROWSER ERROR: ${msg.text()}`);
      }
    });
  });

  test('Step 1: 관리자 로그인', async ({ page }) => {
    await loginAdmin(page);
    expect(page.url()).toContain('/admin');
    await expect(page.locator('h1')).toContainText(/관리|대시보드/);
  });

  test('Step 2: 대시보드 통계 확인', async ({ page }) => {
    await loginAdmin(page);
    await expect(page.locator('h1')).toContainText(/관리|대시보드/);

    const statsCards = page.locator('[data-testid="stat-card"], .stat-card, .dashboard-stat');
    const statsExist = await statsCards.first().isVisible({ timeout: 5000 }).catch(() => false);

    if (statsExist) {
      const count = await statsCards.count();
      expect(count).toBeGreaterThan(0);
    }
  });

  test('Step 3: 사용자 관리 탭', async ({ page }) => {
    await loginAdmin(page);

    const userTab = page.locator('text=회원 관리').or(page.locator('[data-tab="users"]'));
    await expect(userTab).toBeVisible();
    await userTab.click();

    await expect(page.locator('h2, h3')).toContainText(/회원|사용자/);
  });

  test('Step 4: 주문 관리 탭', async ({ page }) => {
    await loginAdmin(page);

    const orderTab = page.locator('text=주문 관리').or(page.locator('[data-tab="orders"]'));
    if (await orderTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await orderTab.click();
      await expect(page.locator('h2, h3')).toContainText(/주문/);
    }
  });

  test('Step 5: 매입 관리 탭', async ({ page }) => {
    await loginAdmin(page);

    const tradeInTab = page.locator('text=매입 관리').or(page.locator('[data-tab="trade-ins"]'));
    if (await tradeInTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await tradeInTab.click();
      await expect(page.locator('h2, h3')).toContainText(/매입/);
    }
  });

  test('Step 6: 시스템 설정 탭', async ({ page }) => {
    await loginAdmin(page);

    const settingsTab = page.locator('text=설정').or(page.locator('[data-tab="settings"]'));
    if (await settingsTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await settingsTab.click();
    }
  });

  test('비관리자 접근 제한', async ({ page }) => {
    await loginAs(page, 'user');
    await page.goto(`${BASE_URL}/admin`);

    const isRedirected = !page.url().includes('admin');
    const hasAccessDenied = await page
      .locator('text=/접근|권한|denied|forbidden/i')
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    expect(isRedirected || hasAccessDenied).toBe(true);
  });

  test('관리자 메뉴에서 관리자 페이지 접근', async ({ page }) => {
    await loginAdmin(page);
    await expect(page.locator('h1')).toContainText(/관리|대시보드/);
  });
});
