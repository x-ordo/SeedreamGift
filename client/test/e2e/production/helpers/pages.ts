/**
 * @file pages.ts
 * @description 프로덕션 E2E 테스트 - 페이지 네비게이션 & UI 헬퍼
 */
import { Page, expect } from '@playwright/test';
import { PROD_URL } from './auth';

/** 프로덕션 시드 데이터 기준 브랜드 (올리브영은 시드 없음) */
export const BRANDS = {
  SHINSEGAE: '신세계',
  HYUNDAI: '현대',
  LOTTE: '롯데',
  DAISO: '다이소',
} as const;

/** 브랜드 필터 칩 클릭 (BrandFilterChips 컴포넌트) */
export async function filterByBrand(page: Page, brandName: string) {
  const brandChip = page.locator(`button:has-text("${brandName}"), [data-brand]:has-text("${brandName}")`).first();
  await expect(brandChip).toBeVisible({ timeout: 15000 });
  await brandChip.click();
  await page.waitForLoadState('networkidle');
}

/**
 * 상품 수량 선택 후 구매하기
 * NumericSpinner는 <input>이 아니라 버튼(+/-)과 <span>으로 구성됨
 * .col-product 클릭 시 상세 페이지로 이동하므로, + 버튼으로 수량만 증가
 */
export async function selectProductAndBuy(page: Page) {
  // 첫 번째 상품 행의 수량 늘리기 버튼 클릭 (NumericSpinner의 + 버튼)
  const row = page.locator('.product-table-row').first();
  await expect(row).toBeVisible({ timeout: 15000 });

  const plusBtn = row.locator('button[aria-label="수량 늘리기"]');
  await expect(plusBtn).toBeVisible({ timeout: 5000 });
  await plusBtn.click();
  await page.waitForTimeout(500);

  // 수량이 1 이상 → "구매하기" 버튼 활성화
  const buyBtn = page.getByRole('button', { name: /구매하기/ }).first();
  await expect(buyBtn).toBeVisible({ timeout: 10000 });
  await expect(buyBtn).toBeEnabled({ timeout: 5000 });
  await buyBtn.click();
  await page.waitForLoadState('networkidle');
}

/** 토스트/알림 확인 */
export async function expectToast(page: Page, text: string | RegExp) {
  const toast = page.locator('[role="alert"], .toast, .Toastify__toast');
  await expect(toast.first()).toContainText(text, { timeout: 10000 });
}

/** 콘솔 에러 수집기 (auth/refresh 401 + CSP/font 에러 무시) */
export function attachConsoleErrorCollector(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      if (
        text.includes('cdn.jsdelivr.net') ||
        text.includes('Content-Security-Policy') ||
        text.includes('401') ||
        text.includes('auth/refresh')
      ) return;
      errors.push(text);
    }
  });
  return errors;
}

/** 실패한 API 요청 수집기 (auth/refresh 제외) */
export function attachNetworkErrorCollector(page: Page): string[] {
  const failures: string[] = [];
  page.on('response', (response) => {
    const url = response.url();
    const status = response.status();
    if (url.includes('/api/v1/') && status >= 400) {
      if (url.includes('/auth/refresh') && status === 401) return;
      failures.push(`${status} ${response.request().method()} ${url}`);
    }
  });
  return failures;
}

/** 관리자 사이드바 메뉴 클릭 */
export async function clickAdminTab(page: Page, tabName: string) {
  const menuItem = page.locator(`.admin-sidebar`).locator(`text="${tabName}"`).first();
  const fallback = page.locator(`text="${tabName}"`).first();

  if (await menuItem.isVisible({ timeout: 5000 }).catch(() => false)) {
    await menuItem.click();
  } else {
    await expect(fallback).toBeVisible({ timeout: 10000 });
    await fallback.click();
  }
  await page.waitForLoadState('networkidle');
}
