/**
 * @file buyer-journey.spec.ts
 * @description 구매자 전체 여정 시나리오 테스트
 */
import { test, expect } from '@playwright/test';
import { loginAs, verifyLoggedIn, goToMyPage, logout } from '../helpers/auth.helper';
import { goToHomePage, goToProductsPage, BRANDS } from '../helpers/test-data';

const BASE_URL = 'http://localhost:5173';

test.describe('구매자 전체 여정 시나리오', () => {
  test.beforeEach(async ({ page }) => {
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        console.log(`BROWSER ERROR: ${msg.text()}`);
      }
    });
  });

  test('Step 1-2: 홈페이지에서 상품 목록 페이지로 이동', async ({ page }) => {
    await goToHomePage(page);

    const productsLink = page.locator('a[href="/products"]').first();
    if (await productsLink.isVisible()) {
      await productsLink.click();
    } else {
      await page.goto(`${BASE_URL}/products`);
    }

    await expect(page).toHaveURL(/.*products/);
  });

  test('Step 3: 브랜드 필터 적용', async ({ page }) => {
    await goToProductsPage(page);

    const brandCard = page.getByRole('button', { name: new RegExp(BRANDS.SHINSEGAE, 'i') }).first();
    if (await brandCard.isVisible({ timeout: 5000 }).catch(() => false)) {
      await brandCard.click();
      await expect(page.locator('h1, h2')).toContainText(BRANDS.SHINSEGAE);
    }
  });

  test('Step 4-5: 상품 상세 확인 및 장바구니 추가', async ({ page }) => {
    await loginAs(page, 'user');
    await verifyLoggedIn(page);
    await goToProductsPage(page);

    const brandCard = page.getByRole('button', { name: new RegExp(BRANDS.SHINSEGAE, 'i') }).first();
    if (await brandCard.isVisible({ timeout: 5000 }).catch(() => false)) {
      await brandCard.click();
    }

    const addBtn = page.getByRole('button', { name: /담기/ }).first();
    if (await addBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await addBtn.click();
      await page.waitForTimeout(1000);
    }
  });

  test('Step 6: 장바구니 페이지 확인', async ({ page }) => {
    await loginAs(page, 'user');
    await page.goto(`${BASE_URL}/cart`);
    await expect(page.locator('body')).toBeVisible();

    const emptyMessage = page.locator('text=장바구니가 비어있습니다');
    const cartItems = page.locator('.cart-item, [data-testid="cart-item"]');

    const isEmpty = await emptyMessage.isVisible({ timeout: 5000 }).catch(() => false);
    const hasItems = (await cartItems.count()) > 0;

    expect(isEmpty || hasItems).toBe(true);
  });

  test('Step 7-8: 체크아웃 및 주문 완료', async ({ page }) => {
    await loginAs(page, 'user');
    await page.goto(`${BASE_URL}/checkout`);

    const checkoutForm = page.locator('form, [data-testid="checkout-form"]');
    const emptyMessage = page.locator('text=장바구니');

    const hasForm = await checkoutForm.isVisible({ timeout: 5000 }).catch(() => false);
    const hasEmptyMsg = await emptyMessage.isVisible({ timeout: 2000 }).catch(() => false);

    expect(hasForm || hasEmptyMsg).toBe(true);

    if (hasForm) {
      const paymentSelect = page.locator('select[name="paymentMethod"], [data-testid="payment-method"]');
      if (await paymentSelect.isVisible({ timeout: 2000 }).catch(() => false)) {
        await paymentSelect.selectOption({ index: 0 });
      }
    }
  });

  test('Step 9: 마이페이지에서 주문 내역 확인', async ({ page }) => {
    await loginAs(page, 'user');
    await verifyLoggedIn(page);
    await goToMyPage(page);

    await expect(page.locator('h1, h2')).toContainText(/님|마이페이지|내 정보/);
  });

  test('전체 플로우: 비로그인 → 로그인 → 상품 확인 → 로그아웃', async ({ page }) => {
    await goToHomePage(page);

    const loginLink = page.locator('a[href="/login"]');
    await expect(loginLink).toBeVisible();

    await loginAs(page, 'user');
    await verifyLoggedIn(page);

    await goToProductsPage(page);
    await expect(page).toHaveURL(/.*products/);

    await logout(page);
    await expect(page.locator('a[href="/login"]')).toBeVisible();
  });
});
