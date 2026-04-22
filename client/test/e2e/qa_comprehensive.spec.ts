import { test, expect, Page } from '@playwright/test';

async function registerUser(page: Page, user: Record<string, string>) {
  await page.goto('/register');
  await page.fill('input[name="email"]', user.email);
  await page.fill('input[name="password"]', user.password);
  await page.fill('input[name="confirmPassword"]', user.password);
  await page.fill('input[name="name"]', user.name);

  const uniquePhone = `010-${Math.floor(Math.random() * 9000) + 1000}-${Math.floor(Math.random() * 9000) + 1000}`;
  await page.fill('input[name="phone"]', uniquePhone);

  await page.locator('input[type="checkbox"]').nth(0).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: '동의합니다' }).click();
  await expect(page.getByRole('dialog')).toBeHidden();

  await page.locator('input[type="checkbox"]').nth(1).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: '동의합니다' }).click();
  await expect(page.getByRole('dialog')).toBeHidden();

  await page.click('button[type="submit"]');

  try {
    await expect(page).toHaveURL('/login', { timeout: 15000 });
  } catch (e) {
    const errorMsg = await page.locator('.alert-danger').textContent().catch(() => 'No error message found');
    console.log(`Registration Failed. Error on page: "${errorMsg}"`);
    throw e;
  }
}

async function loginUser(page: Page, user: Record<string, string>) {
  await page.goto('/login');
  await page.fill('input[name="email"]', user.email);
  await page.fill('input[name="password"]', user.password);
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL('/', { timeout: 15000 });
}

test.describe('Comprehensive QA Flow', () => {
  test.describe.configure({ mode: 'serial' });

  const timestamp = Date.now();
  // adminUser removed due to unused variable lint error
  const buyerUser = {
    email: `buyer${timestamp}@test.com`,
    password: 'password123',
    name: 'Buyer User',
  };
  const receiverUser = {
    email: `receiver${timestamp}@test.com`,
    password: 'password123',
    name: 'Receiver User',
  };

  test('Scenario 1: Register Receiver', async ({ page }) => {
    await registerUser(page, receiverUser);
  });

  test('Scenario 2: Register Buyer', async ({ page }) => {
    await registerUser(page, buyerUser);
  });

  test('Scenario 4: Buyer Purchase (Self)', async ({ page }) => {
    await loginUser(page, buyerUser);

    await page.goto('/');
    if (await page.locator('.no-products-found').isVisible()) {
      throw new Error('Test Failed: No products found on HomePage despite seeding.');
    }

    await page.locator('.product-card').first().click();
    await page.click('text=장바구니 담기');

    await page.goto('/cart');
    await page.click('button:has-text("주문하기")');

    await expect(page).toHaveURL('/checkout');
    await page.selectOption('select', 'VIRTUAL_ACCOUNT');
    await page.click('text=위 구매 조건을 확인하였으며, 결제 진행에 동의합니다.');
    await page.click('button:has-text("결제하기")');

    await expect(page.locator('text=주문이 완료되었습니다')).toBeVisible();
  });

  test('Scenario 5: Buyer Gift to Receiver', async ({ page }) => {
    await loginUser(page, buyerUser);

    await page.goto('/');
    await page.locator('.product-card').first().click();
    await page.click('text=장바구니 담기');

    await page.goto('/cart');
    await page.click('button:has-text("선물하기")');

    await page.fill('input[placeholder*="이메일 검색"]', receiverUser.email.substring(0, 5));
    await page.waitForTimeout(1000);
    await page.click('.search-item');
    await page.click('button:has-text("선물 담기")');

    await expect(page).toHaveURL('/checkout');
    await expect(page.locator('text=' + receiverUser.email)).toBeVisible();

    await page.selectOption('select', 'VIRTUAL_ACCOUNT');
    await page.click('text=위 구매 조건을 확인하였으며, 결제 진행에 동의합니다.');
    await page.click('button:has-text("결제하기")');

    await expect(page.locator('text=주문이 완료되었습니다')).toBeVisible();
  });

  test('Scenario 6: Receiver Check Gift', async ({ page }) => {
    await loginUser(page, receiverUser);

    await page.goto('/mypage');
    await page.click('text=받은선물');
    await expect(page.locator('text=From. ' + buyerUser.name)).toBeVisible();
  });
});
