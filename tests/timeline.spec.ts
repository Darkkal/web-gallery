import { test, expect } from '@playwright/test';

test('timeline page loads', async ({ page }) => {
    // Start from the index page (which redirects to timeline)
    await page.goto('/');

    // Expect to be redirected to /timeline
    await expect(page).toHaveURL(/.*\/timeline/);

    // Check for the search input
    await expect(page.getByPlaceholder('Search timeline')).toBeVisible();

    // Check for the feed container
    const feed = page.locator('div[class*="feed"]');
    await expect(feed).toBeVisible();
});
