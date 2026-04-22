import { test, expect } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

test.describe('QA V2: Product Lifecycle', () => {
  test('Scenario A: Guest Browser', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/씨드림기프트|Seedream Gift/);

    const brandCard = page.locator('.brand-card-vertical').filter({ hasText: '신세계' }).first();
    await expect(brandCard).toBeVisible({ timeout: 10000 });
    await brandCard.click();

    await expect(page).toHaveURL(/\/voucher-types\//);
    await expect(page.locator('h1')).toContainText('신세계');

    const denomItem = page.locator('.vt-denomination-item').filter({ hasText: '10,000' }).first();
    await expect(denomItem).toBeVisible();

    const qtyInput = denomItem.locator('input[type="number"], input[role="spinbutton"]');
    if ((await qtyInput.count()) > 0) {
      await qtyInput.fill('1');
    } else {
      await denomItem.locator('button').last().click();
    }

    await page.click('text=바로 구매');
    await expect(page).toHaveURL(/\/login/);
  });

  test('Scenario B: Member Purchase (Self)', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="email"]', 'user@example.com');
    await page.fill('input[name="password"]', 'test1234');
    await page.click('button[type="submit"]');

    try {
      await expect(page).toHaveURL('/', { timeout: 10000 });
    } catch (e) {
      const errorParams = await page.locator('.alert').textContent().catch(() => 'No Alert Element');
      console.log('Login Failed. Alert Content:', errorParams);
      console.log('Current URL:', page.url());
      throw e;
    }

    await page.goto('/');
    await page.locator('.brand-card-vertical').filter({ hasText: '신세계' }).first().click();

    const denomItem = page.locator('.vt-denomination-item').filter({ hasText: '10,000' }).first();
    await expect(denomItem).toBeVisible();
    await denomItem.locator('button').last().click();

    await page.click('text=장바구니');
    await page.waitForTimeout(500);
    await page.goto('/cart');
    await expect(page.locator('text=신세계')).toBeVisible({ timeout: 10000 });

    await page.click('text=구매하기');
    await expect(page).toHaveURL(/checkout/);
    await page.click('text=결제하기');
    await expect(page).toHaveURL(/order\/success/);

    await page.goto('/mypage/orders');
    await expect(page.locator('.order-item').first()).toBeVisible();
  });

  test('Scenario C: Gifting Flow', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="email"]', 'user@example.com');
    await page.fill('input[name="password"]', 'test1234');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/', { timeout: 10000 });

    await page.goto('/');
    const brandCard = page.locator('.brand-card-vertical').filter({ hasText: '올리브영' }).first();
    await expect(brandCard).toBeVisible();
    await brandCard.click();

    const denomItem = page.locator('.vt-denomination-item').filter({ hasText: '10,000' }).first();
    await expect(denomItem).toBeVisible();
    await denomItem.locator('button').last().click();

    await page.click('text=선물하기');

    await page.fill('input[placeholder*="이메일"]', 'receiver@test.com');
    await page.click('button:has-text("검색")');

    const userRow = page.locator('div, li').filter({ hasText: 'Test Receiver' }).last();
    await expect(userRow).toBeVisible({ timeout: 5000 });
    await userRow.click();

    await page.click('text=보내기');
    await page.click('text=결제하기');
    await expect(page).toHaveURL(/order\/success/);

    await page.context().clearCookies();
    await page.goto('/login');
    await page.fill('input[name="email"]', 'receiver@test.com');
    await page.fill('input[name="password"]', 'test1234');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/', { timeout: 10000 });

    await page.goto('/mypage/gifts');
    await expect(page.locator('text=올리브영')).toBeVisible();
  });
});
