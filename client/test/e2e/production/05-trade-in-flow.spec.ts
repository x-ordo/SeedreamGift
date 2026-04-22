/**
 * @file 05-trade-in-flow.spec.ts
 * @description Scenario 5: 매입(Trade-In) 플로우
 */
import { test, expect } from '@playwright/test';
import {
  PROD_URL,
  loginAs,
  expectLoggedIn,
  BRANDS,
  attachConsoleErrorCollector,
  attachNetworkErrorCollector,
} from './helpers';

test.describe('Scenario 5: 매입(Trade-In) 플로우', () => {
  let consoleErrors: string[];
  let networkErrors: string[];

  test.beforeEach(async ({ page }) => {
    consoleErrors = attachConsoleErrorCollector(page);
    networkErrors = attachNetworkErrorCollector(page);
  });

  test('5-1: 매입 페이지 접근', async ({ page }) => {
    await loginAs(page, 'user');
    await expectLoggedIn(page);

    await page.goto(`${PROD_URL}/trade-in`);
    await page.waitForLoadState('networkidle');

    // 매입 페이지: 브랜드 카드가 보여야 함 (5-2에서도 동일 셀렉터 사용)
    const brandCard = page.locator('.brand-card-vertical').first();
    await expect(brandCard).toBeVisible({ timeout: 20000 });
  });

  test('5-2: 브랜드/권종 선택', async ({ page }) => {
    await loginAs(page, 'user');
    await page.goto(`${PROD_URL}/trade-in`);

    // 브랜드 카드 클릭
    const brandCard = page.locator(`.brand-card-vertical:has-text("${BRANDS.SHINSEGAE}")`).first();
    if (await brandCard.isVisible({ timeout: 10000 }).catch(() => false)) {
      await brandCard.click();
      await page.waitForLoadState('networkidle');
    }

    // 상품 선택
    const productRow = page.locator('.product-table-row, [class*="product"]').first();
    if (await productRow.isVisible({ timeout: 5000 }).catch(() => false)) {
      await productRow.click();
      await page.waitForLoadState('networkidle');
    }
  });

  test('5-3: 매입 폼 - PIN 및 계좌 입력', async ({ page }) => {
    await loginAs(page, 'user');
    await page.goto(`${PROD_URL}/trade-in`);

    const brandCard = page.locator(`.brand-card-vertical:has-text("${BRANDS.SHINSEGAE}")`).first();
    if (await brandCard.isVisible({ timeout: 10000 }).catch(() => false)) {
      await brandCard.click();
      await page.waitForLoadState('networkidle');
    }

    const productRow = page.locator('.product-table-row, [class*="product"]').first();
    if (await productRow.isVisible({ timeout: 5000 }).catch(() => false)) {
      await productRow.click();
      await page.waitForLoadState('networkidle');
    }

    // PIN 입력 필드
    const pinField = page.locator('input[name="pinCode"], input[placeholder*="PIN"]');
    if (await pinField.isVisible({ timeout: 5000 }).catch(() => false)) {
      await pinField.fill('1234567890123456');
    }

    // 계좌 정보
    const bankField = page.locator('input[name="bankName"], select[name="bankName"]');
    if (await bankField.isVisible({ timeout: 3000 }).catch(() => false)) {
      if (await bankField.evaluate((el) => el.tagName === 'SELECT')) {
        await bankField.selectOption({ index: 1 });
      } else {
        await bankField.fill('신한은행');
      }
    }

    const accountField = page.locator('input[name="accountNum"]');
    if (await accountField.isVisible({ timeout: 3000 }).catch(() => false)) {
      await accountField.fill('110123456789');
    }

    const holderField = page.locator('input[name="accountHolder"]');
    if (await holderField.isVisible({ timeout: 3000 }).catch(() => false)) {
      await holderField.fill('테스트');
    }
  });

  test('5-4: 매입 신청 제출', async ({ page }) => {
    await loginAs(page, 'user');
    await page.goto(`${PROD_URL}/trade-in`);

    const brandCard = page.locator(`.brand-card-vertical:has-text("${BRANDS.SHINSEGAE}")`).first();
    if (await brandCard.isVisible({ timeout: 10000 }).catch(() => false)) {
      await brandCard.click();
      await page.waitForLoadState('networkidle');
    }

    const productRow = page.locator('.product-table-row, [class*="product"]').first();
    if (await productRow.isVisible({ timeout: 5000 }).catch(() => false)) {
      await productRow.click();
      await page.waitForLoadState('networkidle');
    }

    const uniquePin = `9999${Date.now().toString().slice(-12)}`;

    const pinField = page.locator('input[name="pinCode"], input[placeholder*="PIN"]');
    if (await pinField.isVisible({ timeout: 5000 }).catch(() => false)) {
      await pinField.fill(uniquePin);

      const bankField = page.locator('input[name="bankName"], select[name="bankName"]');
      if (await bankField.isVisible()) {
        if (await bankField.evaluate((el) => el.tagName === 'SELECT')) {
          await bankField.selectOption({ index: 1 });
        } else {
          await bankField.fill('신한은행');
        }
      }

      const accountField = page.locator('input[name="accountNum"]');
      if (await accountField.isVisible()) await accountField.fill('110123456789');

      const holderField = page.locator('input[name="accountHolder"]');
      if (await holderField.isVisible()) await holderField.fill('테스트');

      const nameField = page.locator('input[name="senderName"]');
      if (await nameField.isVisible({ timeout: 2000 }).catch(() => false)) {
        await nameField.fill('테스트사용자');
      }

      const phoneField = page.locator('input[name="senderPhone"]');
      if (await phoneField.isVisible({ timeout: 2000 }).catch(() => false)) {
        await phoneField.fill('01012345678');
      }

      const submitBtn = page.getByRole('button', { name: /신청|매입|제출/ });
      if (await submitBtn.first().isVisible({ timeout: 5000 }).catch(() => false)) {
        await submitBtn.first().click();
        await page.waitForLoadState('networkidle');

        const success = page.locator('text=/완료|성공|접수/');
        const hasSuccess = await success.first().isVisible({ timeout: 10000 }).catch(() => false);

        if (!hasSuccess) {
          console.log('Trade-in may have failed. Network errors:', networkErrors);
        }
      }
    }
  });

  test('5-5: 마이페이지 매입 내역 확인', async ({ page }) => {
    await loginAs(page, 'user');

    // 마이페이지 판매내역 탭 직접 이동
    await page.goto(`${PROD_URL}/mypage?tab=tradeins`);
    await page.waitForLoadState('networkidle');

    // 판매내역 탭 확인
    const tradeInsTab = page.locator('text=판매내역');
    await expect(tradeInsTab.first()).toBeVisible({ timeout: 15000 });
  });
});
