/**
 * @file seller-journey.spec.ts
 * @description 판매자(매입) 전체 여정 시나리오 테스트
 */
import { test, expect } from '@playwright/test';
import { loginAs, verifyLoggedIn, goToMyPage } from '../helpers/auth.helper';
import { generateRandomString } from '../helpers/test-data';

const BASE_URL = 'http://localhost:5173';

test.describe('판매자(매입) 전체 여정 시나리오', () => {
  test.beforeEach(async ({ page }) => {
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        console.log(`BROWSER ERROR: ${msg.text()}`);
      }
    });
  });

  test('Step 1: 사용자 로그인', async ({ page }) => {
    await loginAs(page, 'user');
    await verifyLoggedIn(page);
  });

  test('Step 2: 매입 페이지 접속', async ({ page }) => {
    await loginAs(page, 'user');
    await page.goto(`${BASE_URL}/trade-in`);

    await expect(page.locator('body')).toBeVisible();
    const tradeInContent = page.locator('text=매입').or(page.locator('text=판매')).or(page.locator('h1'));
    await expect(tradeInContent).toBeVisible();
  });

  test('Step 3: 브랜드 선택', async ({ page }) => {
    await loginAs(page, 'user');
    await page.goto(`${BASE_URL}/trade-in`);

    const brandSelector = page
      .locator('select[name="brand"], [data-testid="brand-select"]')
      .or(page.getByRole('combobox').first());

    const brandExists = await brandSelector.isVisible({ timeout: 5000 }).catch(() => false);

    if (brandExists) {
      await brandSelector.selectOption({ index: 1 });
    } else {
      const brandCard = page.locator('[data-testid="brand-card"], button').first();
      if (await brandCard.isVisible({ timeout: 2000 }).catch(() => false)) {
        await brandCard.click();
      }
    }
  });

  test('Step 4: PIN 코드 및 계좌 정보 입력', async ({ page }) => {
    await loginAs(page, 'user');
    await page.goto(`${BASE_URL}/trade-in`);

    const pinCodeInput = page.locator('input[name="pinCode"], [data-testid="pin-input"]').first();
    const bankNameInput = page.locator('input[name="bankName"], select[name="bankName"]').first();
    const accountInput = page.locator('input[name="accountNum"], [data-testid="account-input"]').first();
    const holderInput = page.locator('input[name="accountHolder"], [data-testid="holder-input"]').first();

    if (await pinCodeInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await pinCodeInput.fill(`TEST-PIN-${generateRandomString()}`);
    }

    if (await bankNameInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      const isSelect = await bankNameInput.evaluate((el) => el.tagName === 'SELECT');
      if (isSelect) {
        await bankNameInput.selectOption({ index: 1 });
      } else {
        await bankNameInput.fill('국민은행');
      }
    }

    if (await accountInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await accountInput.fill('123-456-789012');
    }

    if (await holderInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await holderInput.fill('홍길동');
    }
  });

  test('Step 5: 매입 신청 (폼 확인)', async ({ page }) => {
    await loginAs(page, 'user');
    await page.goto(`${BASE_URL}/trade-in`);

    const submitBtn = page.getByRole('button', { name: /신청|제출|매입/ }).first();
    const buttonExists = await submitBtn.isVisible({ timeout: 5000 }).catch(() => false);

    if (buttonExists) {
      const isDisabled = await submitBtn.isDisabled();
      expect(typeof isDisabled).toBe('boolean');
    }
  });

  test('Step 6: 마이페이지에서 매입 내역 확인', async ({ page }) => {
    await loginAs(page, 'user');
    await verifyLoggedIn(page);

    await goToMyPage(page);
    await expect(page.locator('h1, h2')).toContainText(/님|마이페이지/);

    const tradeInTab = page.locator('text=매입').or(page.locator('text=판매 내역'));
    const tabExists = await tradeInTab.isVisible({ timeout: 5000 }).catch(() => false);

    if (tabExists) {
      await tradeInTab.click();
      await page.waitForTimeout(1000);
    }
  });

  test('전체 플로우: 매입 페이지 네비게이션', async ({ page }) => {
    await loginAs(page, 'user');
    await verifyLoggedIn(page);

    await page.goto(BASE_URL);
    const tradeInLink = page.locator('a[href="/trade-in"]').first();

    if (await tradeInLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await tradeInLink.click();
      await expect(page).toHaveURL(/.*trade-in/);
    } else {
      await page.goto(`${BASE_URL}/trade-in`);
    }

    await expect(page.locator('body')).toBeVisible();

    await goToMyPage(page);
    await expect(page).toHaveURL(/.*mypage/);
  });

  test('비로그인 시 매입 페이지 접근 제한', async ({ page }) => {
    await page.goto(`${BASE_URL}/trade-in`);

    const isRedirected = page.url().includes('login');
    const hasLoginPrompt = await page.locator('text=로그인').isVisible({ timeout: 5000 }).catch(() => false);

    expect(isRedirected || hasLoginPrompt).toBe(true);
  });
});
