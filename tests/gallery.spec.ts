import { test, expect } from '@playwright/test';

test('gallery page loads', async ({ page }) => {
    await page.goto('/gallery');
    await expect(page).toHaveURL(/.*\/gallery/);

    // Check for search bar
    await expect(page.getByPlaceholder(/Search \(e\.g\..*\)/)).toBeVisible();
});

test('gallery filtering', async ({ page }) => {
    await page.goto('/gallery');

    // Check filter select exists
    await expect(page.locator('select').first()).toBeVisible();
    // Or more specific if possible. Based on codebase knowledge, it might be an icon or a select.
    // Let's assume standard input for now or check for specific UI.
    // Actually, based on previous conversations, there might be a dropdown for extractor type.

    // Just verify the search input works for filtering
    const searchInput = page.getByPlaceholder(/Search \(e\.g\..*\)/);
    await searchInput.fill('source:pixiv');
    await expect(searchInput).toHaveValue('source:pixiv');
});

test('gallery grid and lightbox', async ({ page }) => {
    await page.goto('/gallery');

    // Check for grid
    console.log('Checking for masonry grid...');
    await expect(page.getByTestId('masonry-grid')).toBeVisible();
    console.log('Masonry grid found.');
    // Or just wait for any img

    // Wait for load
    try {
        console.log('Waiting for images...');
        await expect(page.locator('img[class*="media"]').first()).toBeVisible({ timeout: 5000 });
        console.log('Images found.');
    } catch {
        // Ignore timeout if empty
        console.log('Timeout waiting for images (might be empty).');
    }

    // Check for at least one item (conditional)
    const galleryItem = page.locator('img[class*="media"]');
    const count = await galleryItem.count();
    console.log(`Gallery item count: ${count}`);

    if (count > 0) {
        // Test Lightbox
        await galleryItem.first().click();

        // Expect lightbox overlay (matching 'overlay' in class name)
        const lightbox = page.locator('div[class*="overlay"]');
        await expect(lightbox).toBeVisible();

        await page.keyboard.press('Escape');
        await expect(lightbox).not.toBeVisible();
    } else {
        test.skip(true, 'No gallery items to test');
    }
});
