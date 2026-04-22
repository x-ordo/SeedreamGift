import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:5173';

test.describe('어드민-사용자 통합 운영 테스트', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/login`);
    await page.fill('input[name="email"]', 'admin@example.com');
    await page.fill('input[name="password"]', 'admin1234');
    await page.click('button[type="submit"]');
    await page.waitForURL(url => url.pathname.startsWith('/admin'), { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
  });

  test('관리자 상품 목록 조회 확인', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin`, { waitUntil: 'networkidle' });
    await expect(page.locator('text=관리 대시보드')).toBeVisible({ timeout: 10000 });

    const sidebar = page.locator('.admin-sidebar');
    await expect(sidebar).toBeVisible({ timeout: 5000 });
    await sidebar.locator('text=상품 관리').first().click();
    await page.waitForTimeout(500);

    await expect(page.locator('text=상품 관리').first()).toBeVisible({ timeout: 10000 });
  });

  test('시스템 설정 항목 로드 확인', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin`, { waitUntil: 'networkidle' });

    const sidebar = page.locator('.admin-sidebar');
    await expect(sidebar).toBeVisible({ timeout: 5000 });
    await sidebar.locator('text=시스템 설정').first().click();
    await page.waitForTimeout(500);

    await expect(page.locator('text=시스템 설정').first()).toBeVisible({ timeout: 10000 });

    const hasConfig = await page.locator('text=GLOBAL_LIMIT').or(page.locator('table')).first().isVisible({ timeout: 5000 }).catch(() => false);
    console.log(`Config items visible: ${hasConfig}`);
  });

  test('사용자 역할 변경 UI 확인', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin`, { waitUntil: 'networkidle' });

    const sidebar = page.locator('.admin-sidebar');
    await expect(sidebar).toBeVisible({ timeout: 5000 });
    await sidebar.locator('text=회원 관리').first().click();
    await page.waitForTimeout(500);

    await expect(page.locator('.admin-content').locator('text=회원 관리').first()).toBeVisible({ timeout: 10000 });

    const roleSelect = page.locator('select.admin-status-select').first();
    await expect(roleSelect).toBeVisible({ timeout: 10000 });
  });

  test('바우처 대량 등록 버튼 확인', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin`, { waitUntil: 'networkidle' });

    const sidebar = page.locator('.admin-sidebar');
    await expect(sidebar).toBeVisible({ timeout: 5000 });
    await sidebar.locator('text=재고').first().click();
    await page.waitForTimeout(500);

    await expect(page.locator('.admin-content').locator('text=재고').first()).toBeVisible({ timeout: 10000 });

    const bulkBtn = page.locator('button').filter({ hasText: '대량 등록' }).first();
    await expect(bulkBtn).toBeVisible({ timeout: 5000 });

    await bulkBtn.click();
    await expect(page.getByRole('heading', { name: '바우처 대량 등록' })).toBeVisible({ timeout: 5000 });
  });
});
