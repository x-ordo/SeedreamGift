/**
 * @file 06-admin.spec.ts
 * @description Scenario 6: 관리자 페이지 테스트
 * 관리자 탭 정확한 레이블: 대시보드 홈, 회원 관리, 세션 관리, 상품 관리, 브랜드 관리,
 * 재고(PIN) 관리, 주문 관리, 매입(판매) 신청, 선물 관리, 장바구니 관리,
 * 공지사항 관리, 이벤트 관리, FAQ 관리, 시스템 설정, 감사 로그
 */
import { test, expect } from '@playwright/test';
import {
  PROD_URL,
  adminLogin,
  clickAdminTab,
  attachConsoleErrorCollector,
  attachNetworkErrorCollector,
} from './helpers';

test.describe('Scenario 6: 관리자 페이지', () => {
  let consoleErrors: string[];
  let networkErrors: string[];

  test.beforeEach(async ({ page }) => {
    consoleErrors = attachConsoleErrorCollector(page);
    networkErrors = attachNetworkErrorCollector(page);
    await adminLogin(page);
  });

  test('6-1: 관리자 로그인 → 대시보드', async ({ page }) => {
    const dashboard = page.locator('text=대시보드 홈');
    await expect(dashboard.first()).toBeVisible({ timeout: 10000 });
  });

  test('6-2: 대시보드 KPI 통계', async ({ page }) => {
    const kpiLabels = ['회원', '상품', '주문'];
    for (const label of kpiLabels) {
      const kpi = page.locator(`text=/${label}/`);
      await expect(kpi.first()).toBeVisible({ timeout: 10000 });
    }
  });

  test('6-3: 회원 관리', async ({ page }) => {
    await clickAdminTab(page, '회원 관리');

    const table = page.locator('table');
    await expect(table.first()).toBeVisible({ timeout: 10000 });
  });

  test('6-4: 상품 관리', async ({ page }) => {
    await clickAdminTab(page, '상품 관리');

    const table = page.locator('table');
    await expect(table.first()).toBeVisible({ timeout: 10000 });

    const rows = page.locator('table tbody tr');
    expect(await rows.count()).toBeGreaterThan(0);
  });

  test('6-5: PIN 재고 관리', async ({ page }) => {
    await clickAdminTab(page, '재고(PIN) 관리');

    const table = page.locator('table');
    await expect(table.first()).toBeVisible({ timeout: 10000 });
  });

  test('6-6: 주문 관리', async ({ page }) => {
    await clickAdminTab(page, '주문 관리');

    const table = page.locator('table');
    await expect(table.first()).toBeVisible({ timeout: 10000 });
  });

  test('6-7: 매입 관리', async ({ page }) => {
    await clickAdminTab(page, '매입(판매) 신청');

    const table = page.locator('table');
    await expect(table.first()).toBeVisible({ timeout: 10000 });
  });

  test('6-8: 공지사항 관리', async ({ page }) => {
    await clickAdminTab(page, '공지사항 관리');

    const content = page.locator('table, [class*="notice"], [class*="list"]');
    await expect(content.first()).toBeVisible({ timeout: 10000 });
  });

  test('6-9: 이벤트 관리', async ({ page }) => {
    await clickAdminTab(page, '이벤트 관리');

    const content = page.locator('table, [class*="event"], [class*="list"]');
    await expect(content.first()).toBeVisible({ timeout: 10000 });
  });

  test('6-10: FAQ 관리', async ({ page }) => {
    await clickAdminTab(page, 'FAQ 관리');

    const content = page.locator('table, [class*="faq"], [class*="list"]');
    await expect(content.first()).toBeVisible({ timeout: 10000 });
  });

  test('6-11: 감사 로그', async ({ page }) => {
    await clickAdminTab(page, '감사 로그');

    const table = page.locator('table');
    await expect(table.first()).toBeVisible({ timeout: 10000 });

    const rows = page.locator('table tbody tr');
    expect(await rows.count()).toBeGreaterThan(0);
  });
});
