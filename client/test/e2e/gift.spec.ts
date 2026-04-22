import { test, expect } from '@playwright/test';

test.describe('Gift Functionality', () => {
    // Generate unique emails for each test run
    const timestamp = Date.now();
    const receiverEmail = `receiver${timestamp}@test.com`;
    const senderEmail = `sender${timestamp}@test.com`;
    const password = 'password123';
    const receiverName = 'Receiver User';
    const senderName = 'Sender User';

    test('should allow a user to send a gift to another user', async ({ page }) => {
        // 1. Register Receiver
        await page.goto('/register');
        await page.fill('input[name="email"]', receiverEmail);
        await page.fill('input[name="password"]', password);
        await page.fill('input[name="confirmPassword"]', password);
        await page.fill('input[name="name"]', receiverName);
        await page.fill('input[name="phone"]', '010-0000-0000'); // Add phone if required

        // Check agreements
        await page.locator('input[type="checkbox"]').nth(0).click();
        await page.waitForSelector('button:has-text("동의합니다")', { state: 'visible' });
        await page.waitForTimeout(500);
        await page.click('button:has-text("동의합니다")');
        // Verify checked
        await expect(page.locator('input[type="checkbox"]').nth(0)).toBeChecked();

        await page.locator('input[type="checkbox"]').nth(1).click();
        await page.waitForSelector('button:has-text("동의합니다")', { state: 'visible' });
        await page.waitForTimeout(500);
        await page.click('button:has-text("동의합니다")');
        // Verify checked
        await expect(page.locator('input[type="checkbox"]').nth(1)).toBeChecked();

        await page.click('button[type="submit"]');

        // Wait for registration and then login
        await expect(page).toHaveURL('/login', { timeout: 15000 });

        // Login Receiver
        await page.fill('input[name="email"]', receiverEmail);
        await page.fill('input[name="password"]', password);
        await page.click('button[type="submit"]');
        await expect(page).toHaveURL('/login');

        // Login Sender
        await page.fill('input[name="email"]', senderEmail);
        await page.fill('input[name="password"]', password);
        await page.click('button[type="submit"]');
        await expect(page).toHaveURL('/');

        // Logout
        await page.goto('/mypage');
        await page.click('text=로그아웃');

        // 2. Register Sender
        await page.goto('/register');
        await page.fill('input[name="email"]', senderEmail);
        await page.fill('input[name="password"]', password);
        await page.fill('input[name="confirmPassword"]', password);
        await page.fill('input[name="name"]', senderName);
        await page.fill('input[name="phone"]', '010-0000-0000');

        // Check agreements
        await page.locator('input[type="checkbox"]').nth(0).click();
        await page.waitForSelector('button:has-text("동의합니다")', { state: 'visible' });
        await page.waitForTimeout(500);
        await page.click('button:has-text("동의합니다")');

        await page.locator('input[type="checkbox"]').nth(1).click();
        await page.waitForSelector('button:has-text("동의합니다")', { state: 'visible' });
        await page.waitForTimeout(500);
        await page.click('button:has-text("동의합니다")');
        await expect(page.locator('input[type="checkbox"]').nth(0)).toBeChecked();

        await page.locator('input[type="checkbox"]').nth(1).click();
        await page.waitForSelector('button:has-text("동의합니다")', { state: 'visible' });
        await page.waitForTimeout(500);
        await page.click('button:has-text("동의합니다")');
        await expect(page.locator('input[type="checkbox"]').nth(1)).toBeChecked();

        await page.click('button[type="submit"]');
        await expect(page).toHaveURL('/login', { timeout: 15000 });

        // Login Sender
        await page.fill('input[name="email"]', senderEmail);
        await page.fill('input[name="password"]', password);
        await page.click('button[type="submit"]');
        await expect(page).toHaveURL('/');

        // 3. Go to Product Page
        await page.locator('article.brand-card-vertical').first().click();

        // 4. Click Gift Button
        await page.click('button:has-text("선물하기")');

        // 4. Gift Flow (from Cart)
        // Add item to cart
        await page.goto('/');
        await page.waitForTimeout(2000);
        // Click first product
        await page.locator('.product-card').first().click();
        await page.click('text=장바구니 담기');
        await expect(page.locator('.toast')).toContainText('장바구니에 담겼습니다');

        // Go to Cart
        await page.goto('/cart');

        // Select item (already selected by default usually, but ensure)
        // Click "Gift" button (secondary button in footer)
        await page.click('button:has-text("선물하기")');
        await expect(page.locator('.modal-title')).toContainText('선물하기');

        // Search for receiver
        // Type partial email
        await page.fill('input[placeholder*="이메일 검색"]', receiverEmail.substring(0, 5));
        // Wait for debounce and results
        await page.waitForTimeout(1000);
        // Select the first result
        await page.click('.search-item');

        // Click "선물 담기"
        await page.click('button:has-text("선물 담기")');

        // Verify redirection to checkout
        await expect(page).toHaveURL('/checkout');
        await expect(page.locator('text=선물 받는 분')).toBeVisible();
        await expect(page.locator('text=' + receiverEmail)).toBeVisible(); // Should show selected email

        // Fill Payment Info (Virtual Account)
        await page.selectOption('select', 'VIRTUAL_ACCOUNT');

        // Agree and Pay
        await page.click('text=위 구매 조건을 확인하였으며, 결제 진행에 동의합니다.');
        await page.click('button:has-text("결제하기")');

        // Verify Success
        await expect(page.locator('text=주문이 완료되었습니다')).toBeVisible();

        // Check DB or MyPage for gift record (Optional, relying on UI success for now)

        // Logout
        await page.click('text=로그아웃');
        await page.click('text=로그아웃');

        // 8. Login Receiver
        await page.goto('/login');
        await page.fill('input[name="email"]', receiverEmail);
        await page.fill('input[name="phone"]', '010-0000-0000'); // Add phone if required
        await page.fill('input[name="name"]', senderName); // Ensure name is filled if not already

        // Check agreements
        await page.locator('input[type="checkbox"]').nth(0).click();
        await page.waitForSelector('button:has-text("동의합니다")', { state: 'visible' });
        await page.waitForTimeout(500);
        await page.click('button:has-text("동의합니다")');

        await page.locator('input[type="checkbox"]').nth(1).click();
        await page.waitForSelector('button:has-text("동의합니다")', { state: 'visible' });
        await page.waitForTimeout(500);
        await page.click('button:has-text("동의합니다")');

        await page.click('button[type="submit"]');
        await expect(page).toHaveURL('/login');

        // Login Sender
        await page.fill('input[name="email"]', senderEmail);
        await page.fill('input[name="password"]', password);
        await page.click('button[type="submit"]');
        await expect(page).toHaveURL('/');

        // 9. Check Received Gift
        await page.goto('/mypage');
        await page.click('text=받은선물');

        await expect(page.locator('text=From. ' + senderName)).toBeVisible();
        // Message check removed
        // await expect(page.locator('text=' + message)).toBeVisible();
    });
});
