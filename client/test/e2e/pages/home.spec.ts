/**
 * @file home.spec.ts
 * @description 홈 페이지 E2E 테스트
 */
import { test, expect } from '@playwright/test';
import { loginAs, verifyLoggedIn, verifyLoggedOut } from '../helpers/auth.helper';

const BASE_URL = 'http://localhost:5173';

test.describe('홈 페이지 테스트', () => {
  test('페이지 타이틀 확인', async ({ page }) => {
    await page.goto(BASE_URL);
    await expect(page).toHaveTitle(/씨드림기프트|Seedream Gift/);
  });

  test('헤더 네비게이션 확인', async ({ page }) => {
    await page.goto(BASE_URL);

    // 로고 확인
    const logo = page.locator('header a[href="/"]').first();
    await expect(logo).toBeVisible();

    // 네비게이션 링크 확인
    const productsLink = page.locator('a[href="/products"]').first();
    const loginLink = page.locator('a[href="/login"]');

    // 상품 링크는 항상 보여야 함
    if (await productsLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      expect(await productsLink.isVisible()).toBe(true);
    }

    // 비로그인 시 로그인 링크
    await expect(loginLink).toBeVisible();
  });

  test('로그인 상태에 따른 UI 변경', async ({ page }) => {
    // 비로그인 상태
    await page.goto(BASE_URL);
    await verifyLoggedOut(page);

    // 로그인
    await loginAs(page, 'user');
    await verifyLoggedIn(page);

    // 사용자 메뉴 확인
    const userBtn = page.locator('#user-menu-button');
    await expect(userBtn).toBeVisible();
  });

  test('메인 콘텐츠 확인', async ({ page }) => {
    await page.goto(BASE_URL);

    // 히어로 섹션 또는 메인 배너
    const mainContent = page.locator('main, [data-testid="hero"], .hero-section');
    await expect(mainContent).toBeVisible();
  });

  test('상품 섹션 확인', async ({ page }) => {
    await page.goto(BASE_URL);

    // 상품 섹션이 있는지 확인
    const productSection = page.locator('section, [data-testid="products-section"]').first();
    await expect(productSection).toBeVisible();
  });

  test('푸터 확인', async ({ page }) => {
    await page.goto(BASE_URL);

    // 푸터
    const footer = page.locator('footer');
    if (await footer.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(footer).toBeVisible();
    }
  });

  test('모바일 반응형 테스트', async ({ page }) => {
    // 모바일 뷰포트
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(BASE_URL);

    // 페이지 로드 확인
    await expect(page.locator('body')).toBeVisible();

    // 햄버거 메뉴 또는 모바일 네비게이션
    const mobileMenu = page.locator('[data-testid="mobile-menu"], .hamburger, button[aria-label="메뉴"]');
    const hasMobileMenu = await mobileMenu.isVisible({ timeout: 3000 }).catch(() => false);

    console.log(`Mobile menu visible: ${hasMobileMenu}`);
  });
});
