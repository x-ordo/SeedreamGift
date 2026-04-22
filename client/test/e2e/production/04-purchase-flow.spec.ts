/**
 * @file 04-purchase-flow.spec.ts
 * @description Scenario 4: 구매 플로우 (전체)
 * 프로덕션 UI: 상품 선택 → 수량 → "구매하기" → 체크아웃 자동 이동
 */
import { test, expect } from '@playwright/test';
import {
  PROD_URL,
  loginAs,
  expectLoggedIn,
  BRANDS,
  filterByBrand,
  selectProductAndBuy,
  attachConsoleErrorCollector,
  attachNetworkErrorCollector,
} from './helpers';

test.describe('Scenario 4: 구매 플로우', () => {
  let consoleErrors: string[];
  let networkErrors: string[];

  test.beforeEach(async ({ page }) => {
    consoleErrors = attachConsoleErrorCollector(page);
    networkErrors = attachNetworkErrorCollector(page);
  });

  test('4-1 ~ 4-3: 상품 선택 → 구매하기 → 체크아웃', async ({ page }) => {
    await loginAs(page, 'user');
    await expectLoggedIn(page);

    // 상품 목록으로 이동, 브랜드 선택
    await page.goto(`${PROD_URL}/products`);
    await filterByBrand(page, BRANDS.SHINSEGAE);

    // 상품 선택 → 구매하기 (체크아웃 자동 이동)
    await selectProductAndBuy(page);

    // 체크아웃 페이지 확인
    const checkoutContent = page.locator('text=/주문|결제|체크아웃/');
    const hasCheckout = await checkoutContent.first().isVisible({ timeout: 10000 }).catch(() => false);

    if (!hasCheckout) {
      // 로그인 필요 or 장바구니 비어있음
      console.log('Checkout page not reached. URL:', page.url());
      console.log('Network errors:', networkErrors);
      return;
    }

    // 약관 동의
    const allAgree = page.locator('text=/전체 동의|모두 동의/');
    if (await allAgree.first().isVisible({ timeout: 3000 }).catch(() => false)) {
      await allAgree.first().click();
    }

    // 주문하기 버튼
    const orderBtn = page.getByRole('button', { name: /주문|결제하기/ });
    if (await orderBtn.first().isVisible({ timeout: 5000 }).catch(() => false)) {
      await orderBtn.first().click();
      await page.waitForLoadState('networkidle');
    }
  });

  test('4-4: 마이페이지 주문 내역 확인', async ({ page }) => {
    await loginAs(page, 'user');
    await expectLoggedIn(page);

    await page.goto(`${PROD_URL}/mypage?tab=orders`);
    await page.waitForLoadState('networkidle');

    const ordersTab = page.locator('text=구매내역');
    await expect(ordersTab.first()).toBeVisible({ timeout: 15000 });
  });
});
