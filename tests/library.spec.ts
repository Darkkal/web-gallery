import { test, expect } from '@playwright/test';

test('library page loads', async ({ page }) => {
    await page.goto('/library');
    await expect(page).toHaveURL(/.*\/library/);

    // Check main headers
    await expect(page.getByRole('heading', { name: 'Library Management' })).toBeVisible();
});

test('scan library interaction', async ({ page }) => {
    await page.goto('/library');

    // Check for "Scan Library" button
    const scanButton = page.getByRole('button', { name: 'Scan Library' });
    await expect(scanButton).toBeVisible();

    // Not clicking to avoid starting actual scan in test environment
});


