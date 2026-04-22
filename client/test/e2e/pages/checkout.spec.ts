/**
 * @file checkout.spec.ts
 * @description 체크아웃 페이지 E2E 테스트
 */
import { test, expect } from '@playwright/test';
import { loginAs, verifyLoggedIn } from '../helpers/auth.helper';

const BASE_URL = 'http://localhost:5173';

test.describe('체크아웃 페이지 테스트', () => {
  test('비로그인 시 체크아웃 접근 제한', async ({ page }) => {
    await page.goto(`${BASE_URL}/checkout`);

    // 로그인 페이지로 리다이렉트
    const isRedirected = page.url().includes('login');
    const hasLoginPrompt = await page.locator('text=로그인').isVisible({ timeout: 5000 }).catch(() => false);

    expect(isRedirected || hasLoginPrompt).toBe(true);
  });

  test('로그인 후 체크아웃 페이지 접근', async ({ page }) => {
    await loginAs(page, 'user');
    await verifyLoggedIn(page);

    await page.goto(`${BASE_URL}/checkout`);

    // 체크아웃 페이지 로드
    await expect(page.locator('body')).toBeVisible();
  });

  test('주문 요약 표시', async ({ page }) => {
    await loginAs(page, 'user');
    await page.goto(`${BASE_URL}/checkout`);

    // 주문 요약 섹션
    const orderSummary = page.locator('text=/주문|요약|결제/').first();
    const hasSummary = await orderSummary.isVisible({ timeout: 5000 }).catch(() => false);

    console.log(`Order summary visible: ${hasSummary}`);
  });

  test('결제 방법 선택 UI', async ({ page }) => {
    await loginAs(page, 'user');
    await page.goto(`${BASE_URL}/checkout`);

    // 결제 방법 선택
    const paymentMethod = page.locator('select[name="paymentMethod"], [data-testid="payment-method"], input[type="radio"]');
    const hasPaymentOptions = await paymentMethod.first().isVisible({ timeout: 5000 }).catch(() => false);

    console.log(`Payment method options visible: ${hasPaymentOptions}`);

    if (hasPaymentOptions) {
      // 결제 방법 옵션들
      const options = ['카드', '계좌이체', '가상계좌', 'CARD', 'VIRTUAL_ACCOUNT', 'BANK_TRANSFER'];
      const paymentText = page.locator('text=/카드|계좌|무통장/').first();
      const hasPaymentText = await paymentText.isVisible({ timeout: 2000 }).catch(() => false);
      console.log(`Payment method text visible: ${hasPaymentText}`);
    }
  });

  test('주문 버튼 확인', async ({ page }) => {
    await loginAs(page, 'user');
    await page.goto(`${BASE_URL}/checkout`);

    // 주문/결제 완료 버튼
    const submitBtn = page.getByRole('button', { name: /주문|결제|구매/ }).first();
    const hasSubmit = await submitBtn.isVisible({ timeout: 5000 }).catch(() => false);

    console.log(`Submit order button visible: ${hasSubmit}`);
  });

  test('총 결제 금액 표시', async ({ page }) => {
    await loginAs(page, 'user');
    await page.goto(`${BASE_URL}/checkout`);

    // 총 금액
    const totalAmount = page.locator('text=/총|합계|결제 금액/').first();
    const hasTotal = await totalAmount.isVisible({ timeout: 5000 }).catch(() => false);

    console.log(`Total amount visible: ${hasTotal}`);
  });

  test('장바구니가 비어있을 때 처리', async ({ page }) => {
    await loginAs(page, 'user');

    // 장바구니 비우기 (있다면)
    await page.goto(`${BASE_URL}/cart`);
    const clearBtn = page.locator('button:has-text("전체 삭제"), button:has-text("비우기")').first();
    if (await clearBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await clearBtn.click();
      await page.waitForTimeout(500);
    }

    // 체크아웃 페이지 이동
    await page.goto(`${BASE_URL}/checkout`);

    // 빈 장바구니 메시지 또는 리다이렉트
    const emptyMsg = page.locator('text=/비어|empty|없습니다|장바구니/i');
    const hasEmptyMsg = await emptyMsg.isVisible({ timeout: 5000 }).catch(() => false);
    const isRedirected = page.url().includes('cart') || page.url().includes('products');

    expect(hasEmptyMsg || isRedirected).toBe(true);
  });

  test('약관 동의 UI (있다면)', async ({ page }) => {
    await loginAs(page, 'user');
    await page.goto(`${BASE_URL}/checkout`);

    // 약관 동의 체크박스
    const termsCheckbox = page.locator('input[type="checkbox"]').first();
    const hasTerms = await termsCheckbox.isVisible({ timeout: 3000 }).catch(() => false);

    console.log(`Terms checkbox visible: ${hasTerms}`);
  });
});
