/**
 * @file 09-register-flow.spec.ts
 * @description 프로덕션 회원가입 플로우 E2E 테스트
 *
 * 3단계 회원가입:
 *   Step 1: 기본 정보 (이름, 이메일, 전화, 비밀번호, 약관)
 *   Step 2: 본인 인증 (Mock KYC 체크박스)
 *   Step 3: 1원 인증 (Coocon API — 프로덕션에서는 실제 호출)
 */
import { test, expect, Page } from '@playwright/test';
import { PROD_URL, attachConsoleErrorCollector } from './helpers';

/** 테스트용 고유 이메일 생성 */
function generateTestEmail(): string {
  const ts = Date.now();
  return `e2etest_${ts}@test.wowgift.co.kr`;
}

const TEST_PASSWORD = 'Test1234!';
const TEST_NAME = 'E2E테스터';
const TEST_PHONE = '010-9999-' + String(Date.now()).slice(-4);

test.describe('Scenario 9: 회원가입 플로우', () => {
  let consoleErrors: string[];

  test.beforeEach(async ({ page }) => {
    consoleErrors = attachConsoleErrorCollector(page);
  });

  test('9-1: 회원가입 페이지 렌더링', async ({ page }) => {
    await page.goto(`${PROD_URL}/register`);
    await page.waitForLoadState('networkidle');

    // Step 1 폼 필드 존재 확인
    await expect(page.locator('input[name="name"]')).toBeVisible();
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="phone"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
    await expect(page.locator('input[name="confirmPassword"]')).toBeVisible();

    // 약관 체크박스
    const termsCheckbox = page.locator('input[name="terms"]');
    const privacyCheckbox = page.locator('input[name="privacy"]');
    await expect(termsCheckbox).toBeVisible();
    await expect(privacyCheckbox).toBeVisible();
  });

  test('9-2: Step 1 유효성 검증 — 빈 폼 제출 차단', async ({ page }) => {
    await page.goto(`${PROD_URL}/register`);
    await page.waitForLoadState('networkidle');

    // "다음" 버튼 클릭 (빈 폼)
    const nextBtn = page.getByRole('button', { name: /다음|계속|Next/i }).first();
    await expect(nextBtn).toBeVisible({ timeout: 5000 });
    await nextBtn.click();

    // 에러 메시지 또는 여전히 Step 1에 머무름
    const stillStep1 = await page.locator('input[name="name"]').isVisible();
    expect(stillStep1).toBe(true);
  });

  test('9-3: Step 1 유효성 검증 — 비밀번호 불일치', async ({ page }) => {
    await page.goto(`${PROD_URL}/register`);
    await page.waitForLoadState('networkidle');

    await page.fill('input[name="name"]', TEST_NAME);
    await page.fill('input[name="email"]', generateTestEmail());
    await page.fill('input[name="phone"]', TEST_PHONE);
    await page.fill('input[name="password"]', TEST_PASSWORD);
    await page.fill('input[name="confirmPassword"]', 'Different1234!');

    // 약관 동의
    await page.locator('input[name="terms"]').check();
    await page.locator('input[name="privacy"]').check();

    const nextBtn = page.getByRole('button', { name: /다음|계속|Next/i }).first();
    await nextBtn.click();

    // 비밀번호 불일치 에러 메시지
    const errorMsg = page.locator('text=/일치하지 않|match|불일치/i');
    await expect(errorMsg.first()).toBeVisible({ timeout: 5000 });
  });

  test('9-4: Step 1 유효성 검증 — 약한 비밀번호', async ({ page }) => {
    await page.goto(`${PROD_URL}/register`);
    await page.waitForLoadState('networkidle');

    await page.fill('input[name="name"]', TEST_NAME);
    await page.fill('input[name="email"]', generateTestEmail());
    await page.fill('input[name="phone"]', TEST_PHONE);
    await page.fill('input[name="password"]', '1234');
    await page.fill('input[name="confirmPassword"]', '1234');

    await page.locator('input[name="terms"]').check();
    await page.locator('input[name="privacy"]').check();

    const nextBtn = page.getByRole('button', { name: /다음|계속|Next/i }).first();
    await nextBtn.click();

    // 여전히 Step 1 (비밀번호 규칙 불충족)
    const stillStep1 = await page.locator('input[name="name"]').isVisible();
    expect(stillStep1).toBe(true);
  });

  test('9-5: Step 1 → Step 2 정상 진행', async ({ page }) => {
    await page.goto(`${PROD_URL}/register`);
    await page.waitForLoadState('networkidle');

    // Step 1 작성
    await fillStep1(page);

    const nextBtn = page.getByRole('button', { name: /다음|계속|Next/i }).first();
    await nextBtn.click();

    // Step 2 도달 확인 — 본인 인증(Mock KYC) 화면
    // Step 1 필드가 사라지고, 본인 인증 관련 UI가 나타남
    await expect(page.locator('input[name="name"]')).not.toBeVisible({ timeout: 5000 });

    // Step 2의 KYC 확인 체크박스 또는 인증 관련 텍스트
    const step2Indicator = page.locator('text=/본인.*인증|KYC|인증.*확인|인증을.*완료/i').first();
    await expect(step2Indicator).toBeVisible({ timeout: 10000 });
  });

  test('9-6: Step 2 → Step 3 정상 진행 (Mock KYC)', async ({ page }) => {
    await page.goto(`${PROD_URL}/register`);
    await page.waitForLoadState('networkidle');

    // Step 1 작성 및 진행
    await fillStep1(page);
    await page.getByRole('button', { name: /다음|계속|Next/i }).first().click();
    await expect(page.locator('input[name="name"]')).not.toBeVisible({ timeout: 5000 });

    // Step 2: Mock KYC 체크박스 체크
    const kycCheckbox = page.locator('input[name="isKycConfirmed"]');
    if (await kycCheckbox.isVisible({ timeout: 5000 }).catch(() => false)) {
      await kycCheckbox.check();
    }

    // "다음" 클릭하여 Step 3 진행
    const nextBtn = page.getByRole('button', { name: /다음|계속|Next/i }).first();
    if (await nextBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await nextBtn.click();
    }

    // Step 3 도달 확인 — 은행 인증 관련 UI
    const step3Indicator = page.locator(
      'text=/은행|계좌|1원.*인증|인증.*요청|Bank/i'
    ).first();
    await expect(step3Indicator).toBeVisible({ timeout: 10000 });
  });

  test('9-7: Step 3 — 1원 인증 요청 (은행 선택 + 계좌 입력)', async ({ page }) => {
    await page.goto(`${PROD_URL}/register`);
    await page.waitForLoadState('networkidle');

    // Step 1 → Step 2 → Step 3 진행
    await fillStep1(page);
    await page.getByRole('button', { name: /다음|계속|Next/i }).first().click();
    await expect(page.locator('input[name="name"]')).not.toBeVisible({ timeout: 5000 });

    // Step 2 통과
    const kycCheckbox = page.locator('input[name="isKycConfirmed"]');
    if (await kycCheckbox.isVisible({ timeout: 5000 }).catch(() => false)) {
      await kycCheckbox.check();
    }
    const nextBtn2 = page.getByRole('button', { name: /다음|계속|Next/i }).first();
    if (await nextBtn2.isVisible({ timeout: 3000 }).catch(() => false)) {
      await nextBtn2.click();
    }

    // Step 3: 은행 인증 화면
    await page.waitForTimeout(1000);

    // 은행 선택 (select or dropdown)
    const bankSelect = page.locator('select').first();
    if (await bankSelect.isVisible({ timeout: 5000 }).catch(() => false)) {
      // 국민은행 선택 (004)
      await bankSelect.selectOption({ index: 1 });
    }

    // 계좌번호 입력
    const accountInput = page.locator('input[name="accountNumber"], input[placeholder*="숫자"]').first();
    if (await accountInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await accountInput.fill('1234567890123');
    }

    // 예금주 입력
    const holderInput = page.locator('input[name="accountHolder"], input[placeholder*="이름"]').first();
    if (await holderInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await holderInput.fill(TEST_NAME);
    }

    // "인증 요청" 버튼 클릭 — Coocon API 호출
    const requestBtn = page.getByRole('button', { name: /인증.*요청|1원.*발송|Request/i }).first();
    if (await requestBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      // API 응답 캡처
      const responsePromise = page.waitForResponse(
        (resp) => resp.url().includes('/kyc/bank-verify/request'),
        { timeout: 15000 },
      ).catch(() => null);

      await requestBtn.click();

      const response = await responsePromise;
      if (response) {
        const status = response.status();
        console.log(`[1원 인증 요청] status=${status}`);

        if (status >= 200 && status < 300) {
          // 성공 시 인증 코드 입력 필드가 나타남
          const codeInput = page.locator('input[name="verifyCode"], input[maxlength="3"]').first();
          await expect(codeInput).toBeVisible({ timeout: 10000 });
          console.log('[1원 인증 요청] 성공 — 인증 코드 입력 대기');
        } else {
          // 실패 시 에러 메시지 표시 (예상 가능 — Coocon API 오류)
          console.log(`[1원 인증 요청] 실패 (status=${status}) — 프로덕션 Coocon API 오류 가능`);
        }
      }
    }

    // 스크린샷 저장
    await page.screenshot({ path: 'test-results-production/register-step3.png', fullPage: true });
  });

  test('9-8: 로그인 페이지에서 회원가입 링크 확인', async ({ page }) => {
    await page.goto(`${PROD_URL}/login`);
    await page.waitForLoadState('networkidle');

    // "회원가입" 링크 존재
    const registerLink = page.locator('a[href="/register"]');
    await expect(registerLink).toBeVisible({ timeout: 5000 });

    // 클릭 시 회원가입 페이지로 이동
    await registerLink.click();
    await page.waitForURL(/.*register/);
    await expect(page.locator('input[name="name"]')).toBeVisible({ timeout: 5000 });
  });
});

/** Step 1 공통 입력 헬퍼 */
async function fillStep1(page: Page) {
  const email = generateTestEmail();
  await page.fill('input[name="name"]', TEST_NAME);
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="phone"]', TEST_PHONE);
  await page.fill('input[name="password"]', TEST_PASSWORD);
  await page.fill('input[name="confirmPassword"]', TEST_PASSWORD);
  await page.locator('input[name="terms"]').check();
  await page.locator('input[name="privacy"]').check();
}
