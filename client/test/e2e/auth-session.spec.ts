import { test, expect } from '@playwright/test';

test.describe('Session Management & RBAC', () => {

  test('Desktop: User Login, Persistence, and Logout', async ({ page }) => {
    // 1. Navigate to Login
    await page.goto('/login');
    await expect(page).toHaveURL(/\/login/);

    // 2. Login
    await page.fill('input[name="email"]', 'buyer@test.com');
    await page.fill('input[name="password"]', 'Password123!');
    await page.click('button[type="submit"]');

    // 3. Verify Login Success (Redirect to Home or Previous Page)
    await expect(page).toHaveURL('/'); // Assuming redirect to home by default
    
    // Check UI for logged-in state (e.g., "로그아웃" button or "마이페이지" link)
    // Adjust selector based on actual UI. Assuming '마이페이지' exists in header.
    await expect(page.getByText('마이페이지')).toBeVisible();

    // 4. Access Protected Route
    await page.goto('/mypage');
    await expect(page).toHaveURL(/\/mypage/);
    await expect(page.getByText('내 정보')).toBeVisible(); // Assuming MyPage content

    // 5. Test Persistence (Reload)
    await page.reload();
    await expect(page).toHaveURL(/\/mypage/);
    await expect(page.getByText('내 정보')).toBeVisible();

    // 6. Logout
    await page.click('text=로그아웃'); // Adjust selector
    await expect(page).toHaveURL(/\/login/); // or Home, depending on logic. Usually login or home.
    
    // Verify Cookie Deletion (Refresh Token) - This might be hard to test directly if HttpOnly, 
    // but we can verify we can't access protected route anymore.
    await page.goto('/mypage');
    await expect(page).toHaveURL(/\/login/); // Should redirect to login
  });

  test('Mobile: User Login and Responsiveness', async ({ page }) => {
    // 1. Set Mobile Viewport (iPhone 12 Pro approx)
    await page.setViewportSize({ width: 390, height: 844 });

    // 2. Navigate to Login
    await page.goto('/login');

    // 3. Login
    await page.fill('input[name="email"]', 'seller@test.com');
    await page.fill('input[name="password"]', 'Password123!');
    await page.click('button[type="submit"]');

    // 4. Verify Mobile UI (Hamburger Menu)
    // Assuming a hamburger menu button exists for mobile
    const menuButton = page.locator('button[aria-label="메뉴"]'); // or similar selector
    if (await menuButton.isVisible()) {
        await menuButton.click();
        await expect(page.getByText('마이페이지')).toBeVisible();
    } else {
        // If no hamburger, maybe direct links are still visible or bottom nav?
        // Fallback check
        console.log('Hamburger menu not found, checking for alternative mobile nav');
    }

    // 5. Verify Persistence on Mobile
    await page.reload();
    // Check if still logged in
    await page.goto('/mypage');
    await expect(page).toHaveURL(/\/mypage/);
  });

  test('Security: Admin Isolation and Role Protection', async ({ page }) => {
    // 1. Admin Login
    await page.goto('/admin/login');
    await page.fill('input[name="email"]', 'admin@example.com');
    await page.fill('input[name="password"]', 'admin1234');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/\/admin/);
    
    // 2. Admin Logout
    // Admin dashboard might have a different logout button
    await page.click('text=로그아웃'); 
    await expect(page).toHaveURL(/\/admin\/login/); 

    // 3. User Login
    await page.goto('/login');
    await page.fill('input[name="email"]', 'buyer@test.com');
    await page.fill('input[name="password"]', 'Password123!');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/');

    // 4. User tries to access Admin Page -> Should be blocked
    await page.goto('/admin');
    // Expect redirect to home (as per AdminRoute.tsx logic: user.role !== ADMIN -> redirect to /)
    await expect(page).toHaveURL('/'); 
    
    // 5. User tries to access Admin Login Page and login -> Should fail or handle gracefully
    // The requirement says: "If normal user tries to login at admin page, logout and error"
    // Let's test accessing the page first.
    await page.goto('/admin/login');
    // Since /admin/login is not protected by AdminRoute (it's the login page), user can see it.
    // But if they try to login with USER credentials:
    await page.fill('input[name="email"]', 'buyer@test.com');
    await page.fill('input[name="password"]', 'Password123!');
    await page.click('button[type="submit"]');

    // Expect error message and stay on page
    await expect(page.getByText('접근 권한이 없습니다')).toBeVisible();
    await expect(page).toHaveURL(/\/admin\/login/);
  });

});
