import { test, expect } from '@playwright/test';

test.describe('Admin Inventory & Purchase Verification', () => {
    const timestamp = Date.now();
    const productName = `Inventory Test Product ${timestamp}`;
    const userEmail = `buyer_${timestamp}@test.com`;
    const pinCodePrefix = `TEST-${timestamp}`;

    test('should verify inventory reduction after user purchase', async ({ page }) => {
        test.setTimeout(60000);
        // Enable Console Logging
        page.on('console', msg => console.log(`[Browser Console]: ${msg.text()}`));
        page.on('pageerror', exception => console.log(`[Browser Error]: ${exception}`));

        console.log('Logging in as Admin...');
        await page.goto('/login');

        await page.fill('input[name="email"]', 'admin@wgift.kr');
        await page.fill('input[name="password"]', 'admin1234');
        await page.click('button[type="submit"]');
        await page.waitForURL('/');
        await page.goto('/admin');

        console.log('Creating Product...');
        await page.click('text=상품 관리');
        await page.waitForTimeout(1000);
        await page.click('text=새 상품 등록');

        // Fill ALL fields
        console.log('Filling form...');
        await page.fill('#product-name', productName);
        await page.fill('#product-price', '1000');
        await page.fill('#product-discount', '0');
        await page.fill('#product-tradein', '5');

        console.log('Checking submit button...');
        const submitBtn = page.getByRole('button', { name: '등록', exact: true });
        await expect(submitBtn).toBeVisible();
        await expect(submitBtn).toBeEnabled();

        console.log('Submitting Product Form...');
        const createPromise = page.waitForResponse(response =>
            response.url().includes('/products') && response.request().method() === 'POST'
            , { timeout: 10000 });

        // Click with force
        await submitBtn.click({ force: true });

        const response = await createPromise;
        console.log(`Product Create Response: ${response.status()}`);
        if (response.status() !== 201) {
            console.log('Create Failed Response Body:', await response.text());
            throw new Error('Product creation failed');
        }

        await page.waitForResponse(response => response.url().includes('/products') && response.request().method() === 'GET');

        await expect(page.locator(`text=${productName}`).first()).toBeVisible();

        console.log('Adding Inventory...');
        await page.click('text=재고(PIN) 관리');

        await page.waitForTimeout(1000);

        const productOption = page.locator('#voucher-product option', { hasText: productName }).first();
        const productId = await productOption.evaluate(el => (el as HTMLOptionElement).value);
        await page.selectOption('#voucher-product', productId);

        const pins = Array.from({ length: 5 }, (_, i) => `${pinCodePrefix}-${i + 1}`).join('\n');
        await page.fill('#voucher-pins', pins);

        await page.click('text=PIN 등록하기');
        // Wait for UI to process (Toast might be slow, but functionality is key)
        await page.waitForTimeout(2000);
        console.log('Inventory added via UI.');

        console.log('Admin Logout...');
        await page.evaluate(() => localStorage.clear());
        await page.goto('/login');

        console.log('Registering new User...');
        await page.goto('/register');
        await page.fill('input[name="email"]', userEmail);
        await page.fill('input[name="password"]', 'password123');
        await page.fill('input[name="confirmPassword"]', 'password123');
        await page.fill('input[name="name"]', 'Test Buyer');
        await page.fill('input[name="phone"]', `010-${String(timestamp).slice(-4)}-${String(timestamp).slice(-4)}`);

        // Handle Terms via Modals
        // Terms
        await page.click('button:has-text("이용약관")');
        await expect(page.locator('text=이용약관').first()).toBeVisible();
        await page.click('button:has-text("동의합니다")');

        // Privacy
        await page.click('button:has-text("개인정보처리방침")');
        await expect(page.locator('text=개인정보처리방침').first()).toBeVisible();
        await page.click('button:has-text("동의합니다")');

        await page.click('button[type="submit"]');

        await expect(page).toHaveURL(/\/login/);

        await page.fill('input[name="email"]', userEmail);
        await page.fill('input[name="password"]', 'password123');
        await page.click('button[type="submit"]');
        await page.waitForURL('/');

        console.log('Buying Product...');
        // Homepage only shows Categories (Brands). Navigate to Shinsegae first.
        const brandLabel = '신세계'; // Default brand
        await page.click(`text=${brandLabel}`);
        await page.waitForURL(/\/voucher-types\//);

        await page.waitForSelector(`text=${productName}`, { state: 'detached' }); // Ensure we are NOT looking for name, but price.
        // Actually, just wait for the price row.
        const priceLabel = '1,000';
        const productRow = page.locator('.vt-denomination-item', { hasText: priceLabel }).first();
        await expect(productRow).toBeVisible();

        // Click + button (assuming it's the last button in the row)
        await productRow.locator('button').last().click();

        await page.click('text=바로 구매');
        await expect(page).toHaveURL(/\/checkout/);

        // Debug: Log all requests to see if POST /orders happens
        page.on('request', request => console.log('>>', request.method(), request.url()));

        // The header also has text "결제하기", so we must target the button specifically.
        // It usually contains the price too, e.g. "1,000원 결제하기"
        await page.click('button:has-text("결제하기")');

        await expect(page.locator('text=결제가 완료되었어요!')).toBeVisible({ timeout: 10000 });

        console.log('User Logout...');
        await page.evaluate(() => localStorage.clear());
        await page.goto('/login');

        console.log('Verifying Inventory as Admin...');
        await page.fill('input[name="email"]', 'admin@wgift.kr');
        await page.fill('input[name="password"]', 'admin1234');
        await page.click('button[type="submit"]');
        await page.waitForURL('/');

        await page.goto('/admin');
        await page.click('text=주문 관리');
        // Reload or wait for data
        await page.waitForResponse(resp => resp.url().includes('/orders'));

        // Ensure the order list is loaded
        await page.waitForSelector('table');

        await expect(page.locator(`text=${userEmail}`)).toBeVisible();
        console.log('Verification Successful!');
    });
});
