import { test, expect } from '@playwright/test';

test('tags page loads', async ({ page }) => {
    await page.goto('/tags');
    await expect(page).toHaveURL(/.*\/tags/);

    // Check main header
    await expect(page.getByRole('heading', { name: /Tags/i })).toBeVisible();
});

test('tags list visibility', async ({ page }) => {
    await page.goto('/tags');

    // Check if tags container (grid) exists OR "No tags found" logic
    try {
        await expect(page.locator('div[class*="grid"]')).toBeVisible({ timeout: 2000 });
    } catch {
        // If grid not found, check for empty state message
        await expect(page.getByText('No tags found')).toBeVisible();
    }

    // Check for individual tags (conditional)
    const tag = page.locator('a[class*="tagCard"]');
    if (await tag.count() > 0) {
        // Verify link href
        const href = await tag.first().getAttribute('href');
        expect(href).toMatch(/\/gallery\?search=/);
    }
});
