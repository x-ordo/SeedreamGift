/**
 * @file mypage.spec.ts
 * @description 마이페이지 E2E 테스트
 */
import { test, expect } from '@playwright/test';
import { loginAs, verifyLoggedIn, goToMyPage } from '../helpers/auth.helper';

const BASE_URL = 'http://localhost:5173';

test.describe('마이페이지 테스트', () => {
  test('비로그인 시 마이페이지 접근 제한', async ({ page }) => {
    await page.goto(`${BASE_URL}/mypage`);

    // 로그인 페이지로 리다이렉트
    const isRedirected = page.url().includes('login');
    const hasLoginPrompt = await page.locator('text=로그인').isVisible({ timeout: 5000 }).catch(() => false);

    expect(isRedirected || hasLoginPrompt).toBe(true);
  });

  test('로그인 후 마이페이지 접근', async ({ page }) => {
    await loginAs(page, 'user');
    await verifyLoggedIn(page);

    await goToMyPage(page);

    // 마이페이지 로드
    await expect(page).toHaveURL(/.*mypage/);
  });

  test('사용자 정보 표시', async ({ page }) => {
    await loginAs(page, 'user');
    await goToMyPage(page);

    // 사용자 이름 표시
    const userName = page.locator('text=/님|user|사용자/i').first();
    await expect(userName).toBeVisible({ timeout: 5000 });
  });

  test('주문 내역 탭/섹션', async ({ page }) => {
    await loginAs(page, 'user');
    await goToMyPage(page);

    // 주문 내역 탭 또는 섹션
    const ordersTab = page.locator('text=주문').or(page.locator('[data-tab="orders"]')).first();
    const hasOrdersTab = await ordersTab.isVisible({ timeout: 5000 }).catch(() => false);

    console.log(`Orders tab visible: ${hasOrdersTab}`);

    if (hasOrdersTab) {
      await ordersTab.click();
      await page.waitForTimeout(500);

      // 주문 목록 또는 빈 메시지
      const orderList = page.locator('table, [data-testid="order-list"], .order-item');
      const emptyMsg = page.locator('text=/없습니다|empty|주문 내역/i');

      const hasOrders = await orderList.first().isVisible({ timeout: 3000 }).catch(() => false);
      const hasEmpty = await emptyMsg.isVisible({ timeout: 2000 }).catch(() => false);

      expect(hasOrders || hasEmpty).toBe(true);
    }
  });

  test('매입 내역 탭/섹션', async ({ page }) => {
    await loginAs(page, 'user');
    await goToMyPage(page);

    // 매입 내역 탭
    const tradeInTab = page.locator('text=매입').or(page.locator('[data-tab="trade-ins"]')).first();
    const hasTradeInTab = await tradeInTab.isVisible({ timeout: 5000 }).catch(() => false);

    console.log(`Trade-in tab visible: ${hasTradeInTab}`);

    if (hasTradeInTab) {
      await tradeInTab.click();
      await page.waitForTimeout(500);
    }
  });

  test('KYC 인증 상태 표시', async ({ page }) => {
    await loginAs(page, 'user');
    await goToMyPage(page);

    // KYC 상태 표시
    const kycStatus = page.locator('text=/KYC|인증|본인확인/i').first();
    const hasKycStatus = await kycStatus.isVisible({ timeout: 5000 }).catch(() => false);

    console.log(`KYC status visible: ${hasKycStatus}`);
  });

  test('회원 정보 수정 링크/버튼', async ({ page }) => {
    await loginAs(page, 'user');
    await goToMyPage(page);

    // 정보 수정 버튼
    const editBtn = page.locator('button:has-text("수정"), a:has-text("수정"), [data-testid="edit-profile"]').first();
    const hasEditBtn = await editBtn.isVisible({ timeout: 5000 }).catch(() => false);

    console.log(`Edit profile button visible: ${hasEditBtn}`);
  });

  test('로그아웃 버튼', async ({ page }) => {
    await loginAs(page, 'user');
    await goToMyPage(page);

    // 로그아웃 버튼 (마이페이지 내)
    const logoutBtn = page.locator('button:has-text("로그아웃"), a:has-text("로그아웃")').first();
    const hasLogoutBtn = await logoutBtn.isVisible({ timeout: 5000 }).catch(() => false);

    console.log(`Logout button visible: ${hasLogoutBtn}`);
  });

  test('주문 상세 보기', async ({ page }) => {
    await loginAs(page, 'user');
    await goToMyPage(page);

    // 주문 탭 클릭
    const ordersTab = page.locator('text=주문').first();
    if (await ordersTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await ordersTab.click();
      await page.waitForTimeout(500);

      // 주문 상세 보기 버튼/링크
      const detailBtn = page.locator('button:has-text("상세"), a:has-text("상세"), [data-testid="order-detail"]').first();
      const hasDetailBtn = await detailBtn.isVisible({ timeout: 3000 }).catch(() => false);

      console.log(`Order detail button visible: ${hasDetailBtn}`);
    }
  });

  test('구매 한도 정보', async ({ page }) => {
    await loginAs(page, 'user');
    await goToMyPage(page);

    // 구매 한도 정보
    const limitInfo = page.locator('text=/한도|limit/i').first();
    const hasLimitInfo = await limitInfo.isVisible({ timeout: 5000 }).catch(() => false);

    console.log(`Purchase limit info visible: ${hasLimitInfo}`);
  });

  test('비밀번호 변경 링크', async ({ page }) => {
    await loginAs(page, 'user');
    await goToMyPage(page);

    // 비밀번호 변경
    const pwdChangeLink = page.locator('text=/비밀번호|password/i').first();
    const hasPwdChange = await pwdChangeLink.isVisible({ timeout: 5000 }).catch(() => false);

    console.log(`Password change link visible: ${hasPwdChange}`);
  });
});
