import { test, expect } from '@playwright/test';

test('navigation sidebar works', async ({ page }) => {
    await page.goto('/timeline');

    // Check main nav items exist using href to be robust against text hiding/icons
    await expect(page.locator('a[href="/gallery"]')).toBeVisible();
    await expect(page.locator('a[href="/timeline"]')).toBeVisible();
    await expect(page.locator('a[href="/sources"]')).toBeVisible();
    await expect(page.locator('a[href="/library"]')).toBeVisible();
    await expect(page.locator('a[href="/tags"]')).toBeVisible();

    // Test navigation
    await page.locator('a[href="/gallery"]').click();
    await expect(page).toHaveURL(/.*\/gallery/);
});

test('theme toggle works', async ({ page }) => {
    await page.goto('/timeline');

    // Find theme toggle button
    const themeButton = page.getByLabel('Toggle theme', { exact: false });
    await expect(themeButton).toBeVisible();

    // Click it
    await themeButton.click();

    // Ideally check for class change on html or body, or local storage persistence
    // For now, just ensure no error on click
});
