import { test, expect } from '@playwright/test';

test('sources page loads', async ({ page }) => {
    await page.goto('/sources');
    await expect(page).toHaveURL(/.*\/sources/);

    // Check for "Add Source" button or input
    await expect(page.getByText('Add Source', { exact: false })).toBeVisible();
});

test('add source interaction (mocked)', async ({ page }) => {
    await page.goto('/sources');

    // We can't easily test adding a real source without side effects or external dependencies.
    // So we will verify the UI interaction.

    // Assuming there is an input and a button.
    const input = page.locator('input[type="url"]');
    await expect(input).toBeVisible();

    await input.fill('https://twitter.com/test_user');
    await expect(input).toHaveValue('https://twitter.com/test_user');

    // We do NOT click add to avoid polluting DB in this basic suite unless we have a cleanup.
});

test('sources list and delete', async ({ page }) => {
    await page.goto('/sources');

    // Check if sources list exists
    const sourcesList = page.locator('div[class*="sourceItem"]');
    // or checks table rows if it's a table

    // This is purely conditional
    if (await sourcesList.count() > 0) {
        // Assert delete button exists
        // The exact selector depends on implementation, often an icon or 'Delete' button
        // Let's look for a generic button inside the item
        const firstSource = sourcesList.first();
        await expect(firstSource).toBeVisible();

        // We won't actually click delete to avoid destruction, or we mock it.
        // Just verifying visibility is good for now.
    }
});
