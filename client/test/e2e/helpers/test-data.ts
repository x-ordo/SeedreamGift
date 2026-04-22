/**
 * @file test-data.ts
 * @description Playwright 테스트용 데이터 헬퍼
 */
import { Page, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:5173';

/**
 * 브랜드 상수
 */
export const BRANDS = {
  SHINSEGAE: '신세계',
  HYUNDAI: '현대',
  LOTTE: '롯데',
  DAISO: '다이소',
  OLIVEYOUNG: '올리브영',
} as const;

export type Brand = keyof typeof BRANDS;

/**
 * 상품 페이지로 이동
 */
export async function goToProductsPage(page: Page): Promise<void> {
  await page.goto(`${BASE_URL}/products`);
}

/**
 * 특정 브랜드 상품 필터
 */
export async function filterByBrand(page: Page, brand: Brand): Promise<void> {
  await goToProductsPage(page);

  // 브랜드 카드 또는 버튼 클릭
  const brandName = BRANDS[brand];
  const brandCard = page.getByRole('button', { name: new RegExp(brandName, 'i') }).first();

  await expect(brandCard).toBeVisible({ timeout: 15000 });
  await brandCard.click();

  // 필터링된 목록 확인
  await expect(page.locator('h1')).toContainText(brandName);
}

/**
 * 상품 장바구니에 추가
 */
export async function addProductToCart(page: Page): Promise<void> {
  const addBtn = page.getByRole('button', { name: /담기/ }).first();
  await expect(addBtn).toBeVisible();
  await addBtn.click();
}

/**
 * 장바구니 페이지로 이동
 */
export async function goToCartPage(page: Page): Promise<void> {
  await page.goto(`${BASE_URL}/cart`);
}

/**
 * 장바구니 아이템 개수 확인
 */
export async function getCartItemCount(page: Page): Promise<number> {
  await goToCartPage(page);
  const items = await page.locator('.cart-item').count();
  return items;
}

/**
 * 체크아웃 페이지로 이동
 */
export async function goToCheckoutPage(page: Page): Promise<void> {
  await page.goto(`${BASE_URL}/checkout`);
}

/**
 * 매입 페이지로 이동
 */
export async function goToTradeInPage(page: Page): Promise<void> {
  await page.goto(`${BASE_URL}/trade-in`);
}

/**
 * 홈 페이지로 이동
 */
export async function goToHomePage(page: Page): Promise<void> {
  await page.goto(BASE_URL);
  await expect(page).toHaveTitle(/씨드림기프트|Seedream Gift/);
}

/**
 * 요소가 로드될 때까지 대기
 */
export async function waitForElement(
  page: Page,
  selector: string,
  timeout: number = 10000,
): Promise<void> {
  await expect(page.locator(selector)).toBeVisible({ timeout });
}

/**
 * 네트워크 요청 대기
 */
export async function waitForApiResponse(
  page: Page,
  urlPattern: string | RegExp,
): Promise<void> {
  await page.waitForResponse(urlPattern);
}

/**
 * 토스트 메시지 확인
 */
export async function verifyToastMessage(
  page: Page,
  messagePattern: string | RegExp,
): Promise<void> {
  const toast = page.locator('[role="alert"], .toast, .notification');
  await expect(toast).toContainText(messagePattern);
}

/**
 * 모달 닫기
 */
export async function closeModal(page: Page): Promise<void> {
  const closeBtn = page.locator('[aria-label="닫기"], button:has-text("닫기")').first();
  if (await closeBtn.isVisible()) {
    await closeBtn.click();
  }
}

/**
 * 폼 필드 채우기
 */
export async function fillForm(
  page: Page,
  fields: Record<string, string>,
): Promise<void> {
  for (const [selector, value] of Object.entries(fields)) {
    await page.fill(selector, value);
  }
}

/**
 * 테이블 행 개수 가져오기
 */
export async function getTableRowCount(
  page: Page,
  tableSelector: string = 'table tbody tr',
): Promise<number> {
  return await page.locator(tableSelector).count();
}

/**
 * 특정 텍스트가 포함된 행 찾기
 */
export async function findTableRowWithText(
  page: Page,
  text: string,
  tableSelector: string = 'table tbody tr',
): Promise<boolean> {
  const rows = page.locator(tableSelector);
  const count = await rows.count();

  for (let i = 0; i < count; i++) {
    const rowText = await rows.nth(i).textContent();
    if (rowText?.includes(text)) {
      return true;
    }
  }

  return false;
}

/**
 * 페이지 로딩 완료 대기
 */
export async function waitForPageLoad(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle');
}

/**
 * 스크롤 다운
 */
export async function scrollDown(page: Page, pixels: number = 500): Promise<void> {
  await page.evaluate((px) => window.scrollBy(0, px), pixels);
}

/**
 * 랜덤 문자열 생성
 */
export function generateRandomString(length: number = 8): string {
  return Math.random().toString(36).substring(2, 2 + length);
}

/**
 * 랜덤 전화번호 생성
 */
export function generateRandomPhone(): string {
  const suffix = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `010-${generateRandomString(4).replace(/\D/g, '').padStart(4, '0')}-${suffix}`;
}

/**
 * 랜덤 이메일 생성
 */
export function generateRandomEmail(): string {
  return `test-${generateRandomString()}@test.com`;
}
