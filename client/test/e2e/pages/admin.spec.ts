/**
 * @file admin.spec.ts
 * @description 관리자 페이지 E2E 테스트
 */
import { test, expect } from '@playwright/test';
import { loginAs, loginAsAdmin, verifyLoggedIn } from '../helpers/auth.helper';

const BASE_URL = 'http://localhost:5173';

test.describe('관리자 페이지 테스트', () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  test('비관리자 접근 제한', async ({ page }) => {
    await loginAs(page, 'user');
    await verifyLoggedIn(page);

    await page.goto(`${BASE_URL}/admin`);
    await page.waitForTimeout(2000);

    const isOnAdminPage = page.url().includes('/admin') && !page.url().includes('/admin/login');
    const hasAdminContent = await page
      .locator('text=관리 대시보드')
      .isVisible({ timeout: 2000 })
      .catch(() => false);

    expect(isOnAdminPage && hasAdminContent).toBe(false);
  });

  test('관리자 로그인 후 접근', async ({ page }) => {
    await loginAsAdmin(page);
    await expect(page.locator('text=관리 대시보드')).toBeVisible();
  });

  test('대시보드 탭', async ({ page }) => {
    await loginAsAdmin(page);

    const dashboardTab = page.locator('text=대시보드').or(page.locator('[data-tab="dashboard"]')).first();
    await expect(dashboardTab).toBeVisible({ timeout: 5000 });
  });

  test('회원 관리 탭', async ({ page }) => {
    await loginAsAdmin(page);
    await expect(page.locator('text=관리 대시보드')).toBeVisible();

    const sidebar = page.locator('.admin-sidebar');
    const usersTab = sidebar.locator('text=회원 관리');
    if (await usersTab.isVisible({ timeout: 5000 }).catch(() => false)) {
      await usersTab.click();
      await page.waitForTimeout(500);
    }
  });

  test('주문 관리 탭', async ({ page }) => {
    await loginAsAdmin(page);

    const sidebar = page.locator('.admin-sidebar');
    const ordersTab = sidebar.locator('text=주문 관리');
    if (await ordersTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await ordersTab.click();
      await page.waitForTimeout(500);
    }
  });

  test('매입 관리 탭', async ({ page }) => {
    await loginAsAdmin(page);

    const sidebar = page.locator('.admin-sidebar');
    const tradeInTab = sidebar.locator('text=/매입/');
    if (await tradeInTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await tradeInTab.click();
      await page.waitForTimeout(500);
    }
  });

  test('상품 관리 탭', async ({ page }) => {
    await loginAsAdmin(page);

    const productsTab = page.locator('text=상품 관리').first();
    if (await productsTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await productsTab.click();
    }
  });

  test('재고 관리 탭', async ({ page }) => {
    await loginAsAdmin(page);

    const inventoryTab = page.locator('text=재고 관리').or(page.locator('text=PIN 관리')).first();
    if (await inventoryTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await inventoryTab.click();
    }
  });

  test('설정 탭', async ({ page }) => {
    await loginAsAdmin(page);

    const settingsTab = page.locator('text=설정').first();
    if (await settingsTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await settingsTab.click();
    }
  });

  test('사용자 테이블 표시', async ({ page }) => {
    await loginAsAdmin(page);

    const sidebar = page.locator('.admin-sidebar');
    await expect(sidebar).toBeVisible({ timeout: 10000 });

    const usersTab = sidebar.locator('text=회원 관리');
    await expect(usersTab).toBeVisible({ timeout: 5000 });
    await usersTab.click();
    await page.waitForTimeout(1000);

    const userTable = page.locator('table').first();
    await expect(userTable).toBeVisible({ timeout: 5000 });
  });

  test('통계 카드 표시', async ({ page }) => {
    await loginAsAdmin(page);

    const statCards = page.locator('[data-testid="stat-card"], .stat-card, .dashboard-stat');
    const hasStats = await statCards.first().isVisible({ timeout: 5000 }).catch(() => false);
    expect(hasStats).toBe(true);
  });
});
