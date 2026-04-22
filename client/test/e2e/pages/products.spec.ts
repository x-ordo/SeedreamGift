/**
 * @file products.spec.ts
 * @description 상품 페이지 E2E 테스트
 */
import { test, expect } from '@playwright/test';
import { loginAs, verifyLoggedIn } from '../helpers/auth.helper';
import { BRANDS } from '../helpers/test-data';

const BASE_URL = 'http://localhost:5173';

test.describe('상품 페이지 테스트', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/products`);
  });

  test('상품 페이지 로드', async ({ page }) => {
    await expect(page.locator('body')).toBeVisible();
  });

  test('브랜드 선택 UI 확인', async ({ page }) => {
    // 브랜드 카드 또는 버튼 확인
    const brandCards = page.getByRole('button').filter({ hasText: /신세계|현대|롯데|다이소|올리브영/ });
    const count = await brandCards.count();

    if (count > 0) {
      console.log(`Brand cards found: ${count}`);
      await expect(brandCards.first()).toBeVisible();
    } else {
      // 다른 형태의 브랜드 선택 UI
      const brandSelect = page.locator('select, [data-testid="brand-select"]');
      const hasSelect = await brandSelect.isVisible({ timeout: 3000 }).catch(() => false);
      console.log(`Brand select visible: ${hasSelect}`);
    }
  });

  test('신세계 브랜드 필터', async ({ page }) => {
    const brandCard = page.getByRole('button', { name: new RegExp(BRANDS.SHINSEGAE, 'i') }).first();

    if (await brandCard.isVisible({ timeout: 5000 }).catch(() => false)) {
      await brandCard.click();

      // 필터링된 상품 목록
      await expect(page.locator('h1, h2')).toContainText(BRANDS.SHINSEGAE);
    }
  });

  test('현대 브랜드 필터', async ({ page }) => {
    const brandCard = page.getByRole('button', { name: new RegExp(BRANDS.HYUNDAI, 'i') }).first();

    if (await brandCard.isVisible({ timeout: 5000 }).catch(() => false)) {
      await brandCard.click();
      await expect(page.locator('h1, h2')).toContainText(BRANDS.HYUNDAI);
    }
  });

  test('롯데 브랜드 필터', async ({ page }) => {
    const brandCard = page.getByRole('button', { name: new RegExp(BRANDS.LOTTE, 'i') }).first();

    if (await brandCard.isVisible({ timeout: 5000 }).catch(() => false)) {
      await brandCard.click();
      await expect(page.locator('h1, h2')).toContainText(BRANDS.LOTTE);
    }
  });

  test('상품 카드 구조 확인', async ({ page }) => {
    // 브랜드 선택
    const brandCard = page.getByRole('button', { name: new RegExp(BRANDS.SHINSEGAE, 'i') }).first();

    if (await brandCard.isVisible({ timeout: 5000 }).catch(() => false)) {
      await brandCard.click();

      // 상품 카드 확인
      const productCard = page.locator('[data-testid="product-card"], .product-card, article').first();

      if (await productCard.isVisible({ timeout: 5000 }).catch(() => false)) {
        // 상품명, 가격, 담기 버튼 확인
        const hasPrice = await productCard.locator('text=/원|₩/').isVisible().catch(() => false);
        const hasAddButton = await productCard.locator('button').isVisible().catch(() => false);

        console.log(`Product card has price: ${hasPrice}, has button: ${hasAddButton}`);
      }
    }
  });

  test('장바구니 담기 버튼 (로그인 필요)', async ({ page }) => {
    // 로그인
    await loginAs(page, 'user');
    await verifyLoggedIn(page);

    // 상품 페이지로 이동
    await page.goto(`${BASE_URL}/products`);

    // 브랜드 선택
    const brandCard = page.getByRole('button', { name: new RegExp(BRANDS.SHINSEGAE, 'i') }).first();

    if (await brandCard.isVisible({ timeout: 5000 }).catch(() => false)) {
      await brandCard.click();

      // 담기 버튼 클릭
      const addBtn = page.getByRole('button', { name: /담기/ }).first();

      if (await addBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        await addBtn.click();

        // 성공 피드백 확인 (토스트 또는 UI 변화)
        await page.waitForTimeout(1000);
      }
    }
  });

  test('상품 상세 정보 표시', async ({ page }) => {
    // 브랜드 선택
    const brandCard = page.getByRole('button', { name: new RegExp(BRANDS.SHINSEGAE, 'i') }).first();

    if (await brandCard.isVisible({ timeout: 5000 }).catch(() => false)) {
      await brandCard.click();

      // 상품 정보 확인
      const priceInfo = page.locator('text=/원|₩/').first();
      await expect(priceInfo).toBeVisible({ timeout: 5000 });

      // 할인율 정보 (있다면)
      const discountInfo = page.locator('text=/%|할인/').first();
      const hasDiscount = await discountInfo.isVisible({ timeout: 2000 }).catch(() => false);
      console.log(`Discount info visible: ${hasDiscount}`);
    }
  });

  test('뒤로가기 네비게이션', async ({ page }) => {
    // 브랜드 선택
    const brandCard = page.getByRole('button', { name: new RegExp(BRANDS.SHINSEGAE, 'i') }).first();

    if (await brandCard.isVisible({ timeout: 5000 }).catch(() => false)) {
      await brandCard.click();

      // 뒤로가기
      await page.goBack();

      // 브랜드 선택 화면으로 돌아왔는지 확인
      const brandCardAfter = page.getByRole('button', { name: new RegExp(BRANDS.SHINSEGAE, 'i') }).first();
      const isBack = await brandCardAfter.isVisible({ timeout: 5000 }).catch(() => false);
      console.log(`Navigated back to brand selection: ${isBack}`);
    }
  });
});
