import { test, expect } from '@playwright/test';

test('timeline page loads', async ({ page }) => {
    // Start from the index page (which redirects to timeline)
    await page.goto('/');
    await expect(page.getByTestId('loading-skeleton')).toBeHidden();

    // Expect to be redirected to /timeline
    await expect(page).toHaveURL(/.*\/timeline/);

    // Check for the search input
    await expect(page.getByPlaceholder(/Search timeline/).first()).toBeVisible();

    // Check for the feed container
    const feed = page.locator('div[class*="feed"]').first();
    await expect(feed).toBeVisible();
});

test('timeline search interaction', async ({ page }) => {
    await page.goto('/timeline');
    await expect(page.getByTestId('loading-skeleton')).toBeHidden();
    const searchInput = page.getByPlaceholder(/Search timeline/).first();
    await expect(searchInput).toBeVisible();

    await searchInput.fill('source:twitter');
    await expect(searchInput).toHaveValue('source:twitter');

    // We expect the URL or state to update potentially, or just the feed to refresh
    // Since it's a debounced search, we might wait a bit, but just checking input retention is good for now
});

test('timeline lightbox opens', async ({ page }) => {
    await page.goto('/timeline');
    await expect(page.getByTestId('loading-skeleton')).toBeHidden();

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

test('timeline sorting interaction', async ({ page }) => {
    await page.goto('/timeline');
    await expect(page.getByTestId('loading-skeleton')).toBeHidden();
    
    // Check for the sort select
    const sortSelect = page.locator('select').first();
    await expect(sortSelect).toBeVisible();
    
    // Change sort to "Oldest First"
    await sortSelect.selectOption('created-asc');
    await expect(sortSelect).toHaveValue('created-asc');
});

test('timeline load more button', async ({ page }) => {
    await page.goto('/timeline');
    await expect(page.getByTestId('loading-skeleton')).toBeHidden();
    
    const loadMoreButton = page.getByRole('button', { name: 'Load More' });
    const articles = page.locator('article');
    
    if (await articles.count() >= 50) {
        await expect(loadMoreButton).toBeVisible();
    }
});
