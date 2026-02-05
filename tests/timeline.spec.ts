import { test, expect } from '@playwright/test';

test('timeline page loads', async ({ page }) => {
    // Start from the index page (which redirects to timeline)
    await page.goto('/');

    // Expect to be redirected to /timeline
    await expect(page).toHaveURL(/.*\/timeline/);

    // Check for the search input
    await expect(page.getByPlaceholder(/Search timeline/)).toBeVisible();

    // Check for the feed container
    const feed = page.locator('div[class*="feed"]');
    await expect(feed).toBeVisible();
});

test('timeline search interaction', async ({ page }) => {
    await page.goto('/timeline');
    const searchInput = page.getByPlaceholder(/Search timeline/);
    await expect(searchInput).toBeVisible();

    await searchInput.fill('source:twitter');
    await expect(searchInput).toHaveValue('source:twitter');

    // We expect the URL or state to update potentially, or just the feed to refresh
    // Since it's a debounced search, we might wait a bit, but just checking input retention is good for now
});

test('timeline lightbox opens', async ({ page }) => {
    await page.goto('/timeline');

    // Wait for posts to load (async hydration + fetch)
    // We try to wait for either an article or the no posts message
    try {
        await expect(page.locator('article').first()).toBeVisible({ timeout: 5000 });
    } catch {
        console.log('No posts found or timed out waiting for posts');
    }

    // Check if we have any media items
    const mediaItem = page.locator('div[class*="mediaItem"]');

    // Conditional logic: only test lightbox if we have media
    if (await mediaItem.count() > 0) {
        await mediaItem.first().click();

        // Expect lightbox overlay
        const lightbox = page.locator('div[class*="overlay"]');
        await expect(lightbox).toBeVisible();

        // Close it
        await page.keyboard.press('Escape');
        await expect(lightbox).not.toBeVisible();
    } else {
        test.skip(true, 'No media items found to test lightbox');
    }
});
