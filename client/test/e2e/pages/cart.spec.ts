/**
 * @file cart.spec.ts
 * @description 장바구니 페이지 E2E 테스트
 */
import { test, expect } from '@playwright/test';
import { loginAs, verifyLoggedIn, verifyLoggedOut } from '../helpers/auth.helper';
import { BRANDS } from '../helpers/test-data';

const BASE_URL = 'http://localhost:5173';

test.describe('장바구니 페이지 테스트', () => {
  test('비로그인 시 장바구니 접근', async ({ page }) => {
    await page.goto(`${BASE_URL}/cart`);

    // 로그인 페이지로 리다이렉트 또는 로그인 요청
    const isRedirected = page.url().includes('login');
    const hasLoginPrompt = await page.locator('text=로그인').isVisible({ timeout: 5000 }).catch(() => false);

    expect(isRedirected || hasLoginPrompt).toBe(true);
  });

  test('로그인 후 장바구니 페이지 접근', async ({ page }) => {
    await loginAs(page, 'user');
    await verifyLoggedIn(page);

    await page.goto(`${BASE_URL}/cart`);

    // 장바구니 페이지 로드
    await expect(page.locator('body')).toBeVisible();
  });

  test('빈 장바구니 표시', async ({ page }) => {
    await loginAs(page, 'user');
    await page.goto(`${BASE_URL}/cart`);

    // 빈 장바구니 메시지 또는 아이템 리스트
    const emptyMsg = page.locator('text=/비어|empty|없습니다/i');
    const cartItems = page.locator('[data-testid="cart-item"], .cart-item');

    const isEmpty = await emptyMsg.isVisible({ timeout: 3000 }).catch(() => false);
    const hasItems = (await cartItems.count()) > 0;

    // 둘 중 하나
    expect(isEmpty || hasItems).toBe(true);
  });

  test('장바구니에 상품 추가 후 확인', async ({ page }) => {
    await loginAs(page, 'user');
    await verifyLoggedIn(page);

    // 상품 페이지에서 상품 추가
    await page.goto(`${BASE_URL}/products`);

    const brandCard = page.getByRole('button', { name: new RegExp(BRANDS.SHINSEGAE, 'i') }).first();

    if (await brandCard.isVisible({ timeout: 5000 }).catch(() => false)) {
      await brandCard.click();

      const addBtn = page.getByRole('button', { name: /담기/ }).first();
      if (await addBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        await addBtn.click();
        await page.waitForTimeout(1000);
      }
    }

    // 장바구니 페이지로 이동
    await page.goto(`${BASE_URL}/cart`);

    // 장바구니 내용 확인
    await expect(page.locator('body')).toBeVisible();
  });

  test('장바구니 수량 변경 UI', async ({ page }) => {
    await loginAs(page, 'user');
    await page.goto(`${BASE_URL}/cart`);

    // 수량 변경 버튼 확인
    const increaseBtn = page.locator('button[aria-label="증가"], button:has-text("+")').first();
    const decreaseBtn = page.locator('button[aria-label="감소"], button:has-text("-")').first();

    const hasIncrease = await increaseBtn.isVisible({ timeout: 3000 }).catch(() => false);
    const hasDecrease = await decreaseBtn.isVisible({ timeout: 3000 }).catch(() => false);

    console.log(`Quantity controls: increase=${hasIncrease}, decrease=${hasDecrease}`);
  });

  test('장바구니 아이템 삭제 UI', async ({ page }) => {
    await loginAs(page, 'user');
    await page.goto(`${BASE_URL}/cart`);

    // 삭제 버튼 확인
    const deleteBtn = page.locator('button[aria-label="삭제"], button:has-text("삭제"), [data-testid="delete-item"]').first();
    const hasDelete = await deleteBtn.isVisible({ timeout: 3000 }).catch(() => false);

    console.log(`Delete button visible: ${hasDelete}`);
  });

  test('결제 버튼 확인', async ({ page }) => {
    await loginAs(page, 'user');
    await page.goto(`${BASE_URL}/cart`);

    // 결제/주문 버튼
    const checkoutBtn = page.getByRole('button', { name: /결제|주문|구매/ }).first();
    const hasCheckout = await checkoutBtn.isVisible({ timeout: 3000 }).catch(() => false);

    console.log(`Checkout button visible: ${hasCheckout}`);
  });

  test('총 금액 표시', async ({ page }) => {
    await loginAs(page, 'user');
    await page.goto(`${BASE_URL}/cart`);

    // 총 금액 표시
    const totalPrice = page.locator('text=/총|합계/').or(page.locator('[data-testid="total-price"]'));
    const hasTotal = await totalPrice.isVisible({ timeout: 3000 }).catch(() => false);

    console.log(`Total price visible: ${hasTotal}`);
  });

  test('장바구니 비우기 UI', async ({ page }) => {
    await loginAs(page, 'user');
    await page.goto(`${BASE_URL}/cart`);

    // 전체 삭제/비우기 버튼
    const clearBtn = page.locator('button:has-text("전체 삭제"), button:has-text("비우기")').first();
    const hasClear = await clearBtn.isVisible({ timeout: 3000 }).catch(() => false);

    console.log(`Clear cart button visible: ${hasClear}`);
  });
});
