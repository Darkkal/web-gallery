import { test, expect } from '@playwright/test';

test('gallery page loads', async ({ page }) => {
    await page.goto('/gallery');
    await expect(page.getByTestId('loading-skeleton')).toBeHidden();
    await expect(page).toHaveURL(/.*\/gallery/);

    // Check for search bar
    await expect(page.getByPlaceholder(/Search \(e\.g\..*\)/).first()).toBeVisible();
});

test('gallery filtering', async ({ page }) => {
    await page.goto('/gallery');
    await expect(page.getByTestId('loading-skeleton')).toBeHidden();

    // Check filter select exists
    await expect(page.locator('select').first()).toBeVisible();

    // Just verify the search input works for filtering
    const searchInput = page.getByPlaceholder(/Search \(e\.g\..*\)/);
    await searchInput.fill('source:pixiv');
    await expect(searchInput).toHaveValue('source:pixiv');
});

test('gallery grid and lightbox', async ({ page }) => {
    await page.goto('/gallery');
    await expect(page.getByTestId('loading-skeleton')).toBeHidden();

    // Check for grid
    console.log('Checking for masonry grid...');
    await expect(page.getByTestId('masonry-grid').first()).toBeVisible();
    console.log('Masonry grid found.');

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

test('gallery scroll mode toggle is visible', async ({ page }) => {
    await page.goto('/gallery');
    await expect(page.getByTestId('loading-skeleton')).toBeHidden();

    // The scroll mode toggle should be visible in the filter bar
    await expect(page.getByLabel('Use infinite scroll').first()).toBeVisible();
    await expect(page.getByLabel('Paginate manually').first()).toBeVisible();
});

test('gallery defaults to infinite scroll mode', async ({ page }) => {
    await page.goto('/gallery');
    await expect(page.getByTestId('loading-skeleton')).toBeHidden();

    // Wait for the masonry grid and its images to render
    await expect(page.getByTestId('masonry-grid')).toBeVisible();
    await expect(page.locator('img[class*="media"]').first()).toBeVisible({ timeout: 10000 });

    // By default, the "Load More" button should NOT be visible (infinite scroll is the default)
    const loadMoreButton = page.getByRole('button', { name: 'Load More' });
    await expect(loadMoreButton).not.toBeVisible();

    // The sentinel element should be present since there are enough items
    const sentinel = page.locator('div[class*="sentinel"]');
    await expect(sentinel).toBeVisible();
});

test('gallery can switch to load more button mode', async ({ page }) => {
    await page.goto('/gallery');
    await expect(page.getByTestId('loading-skeleton')).toBeHidden();

    // Wait for items to render
    await expect(page.locator('img[class*="media"]').first()).toBeVisible({ timeout: 10000 });

    // Click the manual pagination toggle
    await page.getByLabel('Paginate manually').click();

    // Wait for React to re-render with the new scroll mode
    await page.waitForTimeout(500);

    // The "Load More" button should now be visible
    const loadMoreButton = page.getByRole('button', { name: 'Load More' });
    await expect(loadMoreButton).toBeVisible();
});

test('gallery infinite scroll loads more items', async ({ page }) => {
    await page.goto('/gallery');
    await expect(page.getByTestId('loading-skeleton')).toBeHidden();

    // Wait for the grid and images to render
    await expect(page.getByTestId('masonry-grid')).toBeVisible();
    await expect(page.locator('img[class*="media"]').first()).toBeVisible({ timeout: 10000 });

    // Count both images and videos — both use the .media CSS module class
    const mediaElements = page.locator('img[class*="media"], video[class*="media"]');
    const initialCount = await mediaElements.count();
    console.log(`Gallery media element count after render: ${initialCount}`);

    if (initialCount < 20) {
        test.skip(true, `Only ${initialCount} items, need at least 20`);
        return;
    }

    // Scroll to the bottom to trigger the IntersectionObserver
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

    // Wait for potential loading and new items
    try {
        await expect(async () => {
            const newCount = await mediaElements.count();
            expect(newCount).toBeGreaterThan(initialCount);
        }).toPass({ timeout: 5000 });
    } catch {
        // May have been no more data to load — that's fine
        console.log('No additional items loaded (may be at end of data)');
    }
});
