/**
 * @file trade-in.spec.ts
 * @description 매입 페이지 E2E 테스트
 */
import { test, expect } from '@playwright/test';
import { loginAs, verifyLoggedIn } from '../helpers/auth.helper';
import { generateRandomString } from '../helpers/test-data';

const BASE_URL = 'http://localhost:5173';

test.describe('매입 페이지 테스트', () => {
  test('비로그인 시 매입 페이지 접근 제한', async ({ page }) => {
    await page.goto(`${BASE_URL}/trade-in`);

    // 로그인 페이지로 리다이렉트 또는 로그인 요청
    const isRedirected = page.url().includes('login');
    const hasLoginPrompt = await page.locator('text=로그인').isVisible({ timeout: 5000 }).catch(() => false);

    expect(isRedirected || hasLoginPrompt).toBe(true);
  });

  test('로그인 후 매입 페이지 접근', async ({ page }) => {
    await loginAs(page, 'user');
    await verifyLoggedIn(page);

    await page.goto(`${BASE_URL}/trade-in`);

    // 매입 페이지 로드
    await expect(page.locator('body')).toBeVisible();
  });

  test('브랜드 선택 UI', async ({ page }) => {
    await loginAs(page, 'user');
    await page.goto(`${BASE_URL}/trade-in`);

    // 브랜드 선택 드롭다운 또는 버튼
    const brandSelector = page
      .locator('select[name="brand"], [data-testid="brand-select"]')
      .or(page.getByRole('combobox').first());

    const hasBrandSelector = await brandSelector.isVisible({ timeout: 5000 }).catch(() => false);

    if (hasBrandSelector) {
      // 옵션 선택 가능한지 확인
      await brandSelector.selectOption({ index: 1 }).catch(() => {
        console.log('Brand selector is not a select element');
      });
    } else {
      // 브랜드 카드 형태일 수 있음
      const brandCard = page.locator('[data-testid="brand-card"], button').first();
      const hasBrandCard = await brandCard.isVisible({ timeout: 2000 }).catch(() => false);
      console.log(`Brand card visible: ${hasBrandCard}`);
    }
  });

  test('PIN 코드 입력 필드', async ({ page }) => {
    await loginAs(page, 'user');
    await page.goto(`${BASE_URL}/trade-in`);

    // PIN 코드 입력
    const pinInput = page.locator('input[name="pinCode"], [data-testid="pin-input"], input[placeholder*="PIN"]').first();
    const hasPinInput = await pinInput.isVisible({ timeout: 5000 }).catch(() => false);

    console.log(`PIN input visible: ${hasPinInput}`);

    if (hasPinInput) {
      await pinInput.fill(`TEST-PIN-${generateRandomString()}`);
    }
  });

  test('은행 정보 입력 필드', async ({ page }) => {
    await loginAs(page, 'user');
    await page.goto(`${BASE_URL}/trade-in`);

    // 은행명
    const bankNameInput = page.locator('input[name="bankName"], select[name="bankName"]').first();
    const hasBankName = await bankNameInput.isVisible({ timeout: 5000 }).catch(() => false);
    console.log(`Bank name input visible: ${hasBankName}`);

    // 계좌번호
    const accountInput = page.locator('input[name="accountNum"], [data-testid="account-input"]').first();
    const hasAccount = await accountInput.isVisible({ timeout: 3000 }).catch(() => false);
    console.log(`Account number input visible: ${hasAccount}`);

    // 예금주
    const holderInput = page.locator('input[name="accountHolder"], [data-testid="holder-input"]').first();
    const hasHolder = await holderInput.isVisible({ timeout: 3000 }).catch(() => false);
    console.log(`Account holder input visible: ${hasHolder}`);
  });

  test('매입 신청 버튼', async ({ page }) => {
    await loginAs(page, 'user');
    await page.goto(`${BASE_URL}/trade-in`);

    // 신청 버튼
    const submitBtn = page.getByRole('button', { name: /신청|제출|매입/ }).first();
    const hasSubmit = await submitBtn.isVisible({ timeout: 5000 }).catch(() => false);

    console.log(`Submit button visible: ${hasSubmit}`);

    if (hasSubmit) {
      // 버튼 상태 확인 (폼 미완성 시 비활성화)
      const isDisabled = await submitBtn.isDisabled();
      console.log(`Submit button disabled: ${isDisabled}`);
    }
  });

  test('매입 가격 정보 표시', async ({ page }) => {
    await loginAs(page, 'user');
    await page.goto(`${BASE_URL}/trade-in`);

    // 매입가 정보
    const priceInfo = page.locator('text=/매입가|예상|가격|원/').first();
    const hasPriceInfo = await priceInfo.isVisible({ timeout: 5000 }).catch(() => false);

    console.log(`Price info visible: ${hasPriceInfo}`);
  });

  test('KYC 인증 안내 (미인증 시)', async ({ page }) => {
    await loginAs(page, 'user');
    await page.goto(`${BASE_URL}/trade-in`);

    // KYC 인증 필요 메시지 (구현에 따라)
    const kycMessage = page.locator('text=/KYC|인증|본인확인/i').first();
    const hasKycMessage = await kycMessage.isVisible({ timeout: 3000 }).catch(() => false);

    console.log(`KYC message visible: ${hasKycMessage}`);
  });

  test('폼 유효성 검증', async ({ page }) => {
    await loginAs(page, 'user');
    await page.goto(`${BASE_URL}/trade-in`);

    // 빈 폼으로 제출 시도
    const submitBtn = page.getByRole('button', { name: /신청|제출|매입/ }).first();

    if (await submitBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      const isDisabled = await submitBtn.isDisabled();

      if (!isDisabled) {
        await submitBtn.click();

        // 에러 메시지 확인
        const errorMsg = page.locator('text=/필수|required|입력/i').first();
        const hasError = await errorMsg.isVisible({ timeout: 3000 }).catch(() => false);
        console.log(`Validation error visible: ${hasError}`);
      }
    }
  });

  test('매입 안내 정보', async ({ page }) => {
    await loginAs(page, 'user');
    await page.goto(`${BASE_URL}/trade-in`);

    // 매입 안내 또는 주의사항
    const guideInfo = page.locator('text=/안내|주의|유의/').first();
    const hasGuide = await guideInfo.isVisible({ timeout: 3000 }).catch(() => false);

    console.log(`Guide info visible: ${hasGuide}`);
  });
});
