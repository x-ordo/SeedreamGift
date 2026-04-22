/**
 * @file 10-register-manual.spec.ts
 * @description 회원가입 수동 테스트 — 화면을 띄워서 사용자가 직접 KYC/은행 인증 수행
 *
 * 실행: npx playwright test test/e2e/production/10-register-manual.spec.ts --headed
 */
import { test, expect } from '@playwright/test';

const PROD_URL = 'https://www.wowgift.co.kr';

test('회원가입 — 수동 테스트 (KYC/은행 인증은 직접 수행)', async ({ page }) => {
  test.setTimeout(600_000); // 10분 타임아웃

  await page.goto(`${PROD_URL}/register`);
  await page.waitForLoadState('networkidle');

  // 회원가입 페이지가 열렸음을 확인
  console.log('========================================');
  console.log('회원가입 페이지가 열렸습니다.');
  console.log('Step 1: 기본 정보 입력');
  console.log('Step 2: 본인 인증 (KYC)');
  console.log('Step 3: 은행 1원 인증');
  console.log('');
  console.log('직접 수행해 주세요. 완료되면 자동으로 종료됩니다.');
  console.log('========================================');

  // 회원가입 완료 후 /login으로 리다이렉트 되거나,
  // 사용자가 브라우저를 닫을 때까지 대기
  try {
    await page.waitForURL(/\/(login|$)/, { timeout: 600_000 });
    console.log('회원가입 완료! 로그인 페이지로 이동됨.');
  } catch {
    console.log('타임아웃 또는 사용자가 종료함.');
  }

  // 최종 URL과 스크린샷 기록
  console.log(`최종 URL: ${page.url()}`);
  await page.screenshot({
    path: 'test-results-production/register-manual-final.png',
    fullPage: true,
  });
});
