/**
 * @file 08-admin-product-inventory.spec.ts
 * @description Scenario 8: 어드민 상품관리 + 재고(PIN)관리 프로덕션 E2E 테스트
 *
 * 시나리오:
 * A. 상품 관리 (1~4) - serial (데이터 의존성)
 * B. 재고(PIN) 관리 (5~9)
 * C. 통합 (10)
 */
import { test, expect, Page } from '@playwright/test';
import {
  adminLogin,
  clickAdminTab,
  attachConsoleErrorCollector,
  attachNetworkErrorCollector,
} from './helpers';

/** 토스트 확인 — Toastify/toast 우선, role=alert 중 텍스트 매칭으로 폴백 */
async function expectAdminToast(page: Page, text: string | RegExp) {
  // Toastify 컨테이너 또는 .toast 클래스 확인
  const toastify = page.locator('.Toastify__toast, .toast-message');
  const alertMatch = page.locator('[role="alert"]').filter({ hasText: text });
  const combined = toastify.or(alertMatch);
  await expect(combined.first()).toContainText(text, { timeout: 10000 });
}

// ─── A. 상품 관리 (serial) ─────────────────
test.describe('Scenario 8A: 상품 관리', () => {
  test.describe.configure({ mode: 'serial' });

  const UNIQUE = `E2E-테스트-${Date.now()}`;
  const UPDATED_NAME = `${UNIQUE}-수정됨`;

  let consoleErrors: string[];
  let networkErrors: string[];

  test.beforeEach(async ({ page }) => {
    consoleErrors = attachConsoleErrorCollector(page);
    networkErrors = attachNetworkErrorCollector(page);
    await adminLogin(page);
  });

  test('8-1: 상품 목록 조회', async ({ page }) => {
    await clickAdminTab(page, '상품 관리');
    await expect(page.locator('text=상품 관리').first()).toBeVisible({ timeout: 10000 });
    const table = page.locator('table');
    await expect(table.first()).toBeVisible({ timeout: 10000 });
  });

  test('8-2: 상품 등록', async ({ page }) => {
    await clickAdminTab(page, '상품 관리');
    await page.waitForTimeout(500);

    await page.click('button:has-text("새 상품 등록")');
    await expect(page.locator('text=새 상품 등록').first()).toBeVisible({ timeout: 5000 });

    const form = page.locator('form.admin-form-body');
    await form.locator('select.form-control').first().selectOption('SHINSEGAE');
    await form.locator('input[placeholder="예: 신세계상품권 5만원"]').fill(UNIQUE);
    await form.locator('input[type="number"][min="1000"]').fill('50000');
    const formRows = form.locator('.admin-form-row');
    await formRows.first().locator('input[type="number"][max="100"]').fill('3');
    await formRows.nth(1).locator('input[type="number"]').first().fill('5');

    const responsePromise = page.waitForResponse(
      r => r.url().includes('/admin/products') && r.request().method() === 'POST',
    );
    await form.locator('button[type="submit"]').click();

    const res = await responsePromise;
    expect(res.status()).toBe(201);

    await expectAdminToast(page, '등록');
    await page.waitForTimeout(500);
    await expect(page.locator(`text=${UNIQUE}`).first()).toBeVisible({ timeout: 10000 });
  });

  test('8-3: 상품 수정', async ({ page }) => {
    await clickAdminTab(page, '상품 관리');
    await page.waitForTimeout(500);

    const row = page.locator(`table tbody tr:has-text("${UNIQUE}")`).first();
    await expect(row).toBeVisible({ timeout: 10000 });
    await row.locator('button:has-text("수정")').click();
    await expect(page.locator('text=상품 수정').first()).toBeVisible({ timeout: 5000 });

    const form = page.locator('form.admin-form-body');
    const nameInput = form.locator('input[placeholder="예: 신세계상품권 5만원"]');
    await nameInput.clear();
    await nameInput.fill(UPDATED_NAME);

    const responsePromise = page.waitForResponse(
      r => r.url().includes('/admin/products/') && r.request().method() === 'PATCH',
    );
    await form.locator('button[type="submit"]').click();
    const res = await responsePromise;
    expect(res.status()).toBe(200);

    await expectAdminToast(page, '수정');
    await page.waitForTimeout(500);
    await expect(page.locator(`text=${UPDATED_NAME}`).first()).toBeVisible({ timeout: 10000 });
  });

  test('8-4: 상품 삭제', async ({ page }) => {
    await clickAdminTab(page, '상품 관리');
    await page.waitForTimeout(500);

    const row = page.locator(`table tbody tr:has-text("${UPDATED_NAME}")`).first();
    await expect(row).toBeVisible({ timeout: 10000 });
    await row.locator('button:has-text("삭제")').click();

    await expect(page.locator('text=상품 삭제 확인')).toBeVisible({ timeout: 5000 });

    const responsePromise = page.waitForResponse(
      r => r.url().includes('/admin/products/') && r.request().method() === 'DELETE',
    );
    await page.locator('.admin-form-footer').locator('button:has-text("삭제")').click();
    const res = await responsePromise;
    expect(res.status()).toBe(200);

    await expectAdminToast(page, '삭제');
    await page.waitForTimeout(500);
    await expect(page.locator(`text=${UPDATED_NAME}`)).not.toBeVisible({ timeout: 5000 });
  });
});

// ─── B. 재고(PIN) 관리 ─────────────────────
test.describe('Scenario 8B: 재고(PIN) 관리', () => {
  let consoleErrors: string[];
  let networkErrors: string[];

  test.beforeEach(async ({ page }) => {
    consoleErrors = attachConsoleErrorCollector(page);
    networkErrors = attachNetworkErrorCollector(page);
    await adminLogin(page);
    await clickAdminTab(page, '재고(PIN) 관리');
    await page.waitForTimeout(500);
  });

  test('8-5: 재고 목록 조회', async ({ page }) => {
    await expect(page.locator('text=재고(PIN) 관리').first()).toBeVisible({ timeout: 10000 });
    const table = page.locator('table');
    await expect(table.first()).toBeVisible({ timeout: 10000 });
  });

  test('8-6: 바우처 대량 등록', async ({ page }) => {
    await page.click('button:has-text("대량 등록")');
    await expect(page.locator('text=바우처 대량 등록').first()).toBeVisible({ timeout: 5000 });

    const form = page.locator('form.admin-form-body');
    const productSelect = form.locator('select.form-control').first();

    await page.waitForTimeout(1000);
    const options = productSelect.locator('option');
    const optionCount = await options.count();
    expect(optionCount).toBeGreaterThan(1);
    const firstVal = await options.nth(1).getAttribute('value');
    if (firstVal) await productSelect.selectOption(firstVal);

    const pinRandom = Math.random().toString(36).substring(2, 6);
    const pins = [`E2E-PIN-${pinRandom}-1`, `E2E-PIN-${pinRandom}-2`, `E2E-PIN-${pinRandom}-3`].join('\n');
    await form.locator('textarea.form-control').fill(pins);
    await form.locator('button[type="submit"]').click();
    await expectAdminToast(page, /등록/);
  });

  test('8-7: 상태 필터', async ({ page }) => {
    const statusSelect = page.locator('select[aria-label="상태 필터"]');
    await expect(statusSelect).toBeVisible({ timeout: 5000 });

    await statusSelect.selectOption({ index: 1 });
    await page.waitForTimeout(500);
    await statusSelect.selectOption('');
    await page.waitForTimeout(300);
  });

  test('8-8: 상품 필터', async ({ page }) => {
    const productSelect = page.locator('select[aria-label="상품 필터"]');
    await expect(productSelect).toBeVisible({ timeout: 5000 });

    const options = productSelect.locator('option');
    const optionCount = await options.count();
    if (optionCount > 1) {
      await productSelect.selectOption({ index: 1 });
      await page.waitForTimeout(500);
      await productSelect.selectOption('');
    }
  });

  test('8-9: 바우처 상태 변경', async ({ page }) => {
    const statusSelects = page.locator('.admin-status-select');
    const count = await statusSelects.count();
    test.skip(count === 0, '바우처가 없어 상태 변경 불가');

    const firstSelect = statusSelects.first();
    const currentValue = await firstSelect.inputValue();
    const newStatus = currentValue === 'AVAILABLE' ? 'EXPIRED' : 'AVAILABLE';

    await firstSelect.selectOption(newStatus);
    await expectAdminToast(page, /변경/);

    // 원래 상태로 복원
    await page.waitForTimeout(500);
    await statusSelects.first().selectOption(currentValue);
    await expectAdminToast(page, /변경/);
  });
});

// ─── C. 통합 ────────────────────────────
test.describe('Scenario 8C: 통합', () => {
  let consoleErrors: string[];
  let networkErrors: string[];

  test('8-10: 상품등록 → PIN등록 → 재고 확인', async ({ page }) => {
    consoleErrors = attachConsoleErrorCollector(page);
    networkErrors = attachNetworkErrorCollector(page);
    await adminLogin(page);

    const integrationName = `E2E-통합-${Date.now()}`;

    // Step 1: 상품 등록
    await clickAdminTab(page, '상품 관리');
    await page.waitForTimeout(500);
    await page.click('button:has-text("새 상품 등록")');
    await expect(page.locator('text=새 상품 등록').first()).toBeVisible({ timeout: 5000 });

    const productForm = page.locator('form.admin-form-body');
    await productForm.locator('select.form-control').first().selectOption('SHINSEGAE');
    await productForm.locator('input[placeholder="예: 신세계상품권 5만원"]').fill(integrationName);
    await productForm.locator('input[type="number"][min="1000"]').fill('100000');
    const formRows = productForm.locator('.admin-form-row');
    await formRows.first().locator('input[type="number"][max="100"]').fill('5');
    await formRows.nth(1).locator('input[type="number"]').first().fill('7');

    const createResponse = page.waitForResponse(
      r => r.url().includes('/admin/products') && r.request().method() === 'POST',
    );
    await productForm.locator('button[type="submit"]').click();
    const createRes = await createResponse;
    expect(createRes.status()).toBe(201);
    await expectAdminToast(page, '등록');

    let newProductId: number | null = null;
    try {
      const body = await createRes.json();
      if (body?.id) newProductId = body.id;
    } catch { /* ignore */ }

    await page.waitForTimeout(500);

    // Step 2: 재고(PIN) 탭 → 대량 등록
    await clickAdminTab(page, '재고(PIN) 관리');
    await page.waitForTimeout(500);
    await page.click('button:has-text("대량 등록")');
    await expect(page.locator('text=바우처 대량 등록').first()).toBeVisible({ timeout: 5000 });

    const voucherForm = page.locator('form.admin-form-body');
    await page.waitForTimeout(1000);

    const voucherProductSelect = voucherForm.locator('select.form-control').first();
    if (newProductId) {
      await voucherProductSelect.selectOption(String(newProductId));
    } else {
      const allOptions = voucherProductSelect.locator('option');
      const count = await allOptions.count();
      for (let i = 0; i < count; i++) {
        const text = await allOptions.nth(i).textContent();
        if (text?.includes(integrationName)) {
          const val = await allOptions.nth(i).getAttribute('value');
          if (val) await voucherProductSelect.selectOption(val);
          break;
        }
      }
    }

    const pinRandom = Math.random().toString(36).substring(2, 6);
    const integrationPins = [`E2E-INTG-${pinRandom}-1`, `E2E-INTG-${pinRandom}-2`].join('\n');
    await voucherForm.locator('textarea.form-control').fill(integrationPins);
    await voucherForm.locator('button[type="submit"]').click();
    await expectAdminToast(page, /등록/);

    // Step 3: 상품 필터로 확인
    await page.waitForTimeout(1000);
    const productFilterSelect = page.locator('select[aria-label="상품 필터"]');
    if (await productFilterSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
      if (newProductId) {
        await productFilterSelect.selectOption(String(newProductId));
        await page.waitForTimeout(500);
      }
    }

    // Step 4: 테스트 상품 정리
    await clickAdminTab(page, '상품 관리');
    await page.waitForTimeout(500);
    const productRow = page.locator(`table tbody tr:has-text("${integrationName}")`).first();
    if (await productRow.isVisible({ timeout: 5000 }).catch(() => false)) {
      await productRow.locator('button:has-text("삭제")').click();
      await expect(page.locator('text=상품 삭제 확인')).toBeVisible({ timeout: 5000 });
      await page.locator('.admin-form-footer').locator('button:has-text("삭제")').click();
      await page.waitForTimeout(500);
    }
  });
});
