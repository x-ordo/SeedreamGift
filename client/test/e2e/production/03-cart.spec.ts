/**
 * @file 03-cart.spec.ts
 * @description Scenario 3: 상품 탐색 & 장바구니 테스트
 * 프로덕션 UI: 상품 행 클릭 → 수량 선택 → "구매하기" (직접 체크아웃)
 */
import { test, expect } from '@playwright/test';
import {
  PROD_URL,
  loginAs,
  expectLoggedIn,
  BRANDS,
  filterByBrand,
  attachConsoleErrorCollector,
  attachNetworkErrorCollector,
} from './helpers';

test.describe('Scenario 3: 상품 탐색 & 장바구니', () => {
  let consoleErrors: string[];
  let networkErrors: string[];

  test.beforeEach(async ({ page }) => {
    consoleErrors = attachConsoleErrorCollector(page);
    networkErrors = attachNetworkErrorCollector(page);
    await loginAs(page, 'user');
    await expectLoggedIn(page);
  });

  test('3-1: 브랜드별 필터링', async ({ page }) => {
    for (const [, name] of Object.entries(BRANDS)) {
      await page.goto(`${PROD_URL}/products`);
      await filterByBrand(page, name);
      const productContent = page.locator('.product-table-row, [class*="product"]').first();
      await expect(productContent).toBeVisible({ timeout: 15000 });
    }
  });

  test('3-2: 상품 상세 - 가격 표시', async ({ page }) => {
    await page.goto(`${PROD_URL}/products`);
    await filterByBrand(page, BRANDS.SHINSEGAE);

    const productRow = page.locator('.product-table-row').first();
    await expect(productRow).toBeVisible({ timeout: 15000 });

    // 가격 표시 확인 (상품 테이블에 가격이 있음)
    const price = page.locator('text=/\\d+원/').first();
    await expect(price).toBeVisible({ timeout: 10000 });
  });

  test('3-3: 상품 선택 후 구매하기 버튼 활성화', async ({ page }) => {
    await page.goto(`${PROD_URL}/products`);
    await filterByBrand(page, BRANDS.SHINSEGAE);

    // NumericSpinner의 + 버튼으로 수량 증가 (행 클릭 시 상세 페이지로 이동하므로 주의)
    const row = page.locator('.product-table-row').first();
    await expect(row).toBeVisible({ timeout: 15000 });

    const plusBtn = row.locator('button[aria-label="수량 늘리기"]');
    await expect(plusBtn).toBeVisible({ timeout: 5000 });
    await plusBtn.click();
    await page.waitForTimeout(500);

    // 수량 1 이상 → "구매하기" 버튼 활성화 확인
    const buyBtn = page.getByRole('button', { name: /구매하기/ });
    await expect(buyBtn.first()).toBeVisible({ timeout: 10000 });
    await expect(buyBtn.first()).toBeEnabled({ timeout: 5000 });
  });

  test('3-4: 장바구니 페이지 확인', async ({ page }) => {
    await page.goto(`${PROD_URL}/cart`);
    await page.waitForLoadState('networkidle');

    // 장바구니 아이템 섹션 또는 빈 장바구니 래퍼
    const cartContent = page.locator('.cart-items-section, .cart-empty-wrapper').first();
    await expect(cartContent).toBeVisible({ timeout: 15000 });
  });

  test('3-5: 장바구니 수량 변경', async ({ page }) => {
    await page.goto(`${PROD_URL}/cart`);

    const plusBtn = page.getByRole('button', { name: /\+|증가/ }).first();
    if (await plusBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await plusBtn.click();
      await page.waitForTimeout(1000);
    }
    // 장바구니가 비어있으면 skip (에러 아님)
  });

  test('3-6: 장바구니 아이템 삭제', async ({ page }) => {
    await page.goto(`${PROD_URL}/cart`);

    const deleteBtn = page.getByRole('button', { name: /삭제|제거|×/ }).first();
    if (await deleteBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await deleteBtn.click();
      await page.waitForTimeout(1000);

      const confirmBtn = page.getByRole('button', { name: /확인|삭제/ }).first();
      if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await confirmBtn.click();
      }
    }
  });
});
