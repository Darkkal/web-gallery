import { test, expect } from '@playwright/test';

test('sources page loads', async ({ page }) => {
    await page.goto('/sources');
    await expect(page).toHaveURL(/.*\/sources/);

    // Check for "Add Source" form
    await expect(page.getByRole('heading', { name: 'Add Source' })).toBeVisible();
    await expect(page.locator('input[type="url"]')).toBeVisible();
    await expect(page.getByPlaceholder('Name (Optional)')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add' })).toBeVisible();
});

test('view toggle switches layout', async ({ page }) => {
    await page.goto('/sources');

    // Default should be Card View (Grid)
    // We can check for a container or the buttons state
    const cardViewBtn = page.getByTitle('Grid View');
    const tableViewBtn = page.getByTitle('List View');

    // Initially Grid is active (class check difficult without class names, checking logic)
    // Let's assume default is grid, so table is not visible
    await expect(page.locator('table')).not.toBeVisible();

    // Switch to Table
    await tableViewBtn.click();
    await expect(page.locator('table')).toBeVisible();

    // Verify Edit buttons are present (if there are items, which we can't guarantee lightly without seeding)
    // But we added an item in the previous test (if state persisted? No, isolated contexts usually)
    // Let's just assume empty state check or check if we can see the column headers at least?
    // The table header has an extra column now.
    await expect(page.locator('thead th')).toHaveCount(6); // Checkbox, Preview, Name/URL, Type, Created, Actions

    // Switch to Grid
    await cardViewBtn.click();
    await expect(page.locator('table')).not.toBeVisible();
});

test('controls presence', async ({ page }) => {
    await page.goto('/sources');

    // Search input
    await expect(page.getByPlaceholder('Search sources...')).toBeVisible();

    // Sort dropdown
    await expect(page.getByRole('combobox')).toBeVisible(); // Select element
});

test('add source interaction (mocked)', async ({ page }) => {
    await page.goto('/sources');

    const input = page.locator('input[type="url"]');
    await expect(input).toBeVisible();

    await input.fill('https://twitter.com/test_user');
    await expect(input).toHaveValue('https://twitter.com/test_user');

    await page.getByPlaceholder('Name (Optional)').fill('Test Source');

    // Button state check
    const addBtn = page.getByRole('button', { name: 'Add' });
    await expect(addBtn).toBeEnabled();
});
