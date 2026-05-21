import { expect, test } from "@playwright/test";

test("navigation sidebar works", async ({ page }) => {
  await page.goto("/timeline");
  await expect(page.getByTestId("loading-skeleton")).toBeHidden();

  // Scope to the desktop sidebar nav to avoid matching mobile sub-sheet links
  const sidebar = page.locator("nav");

  // Check main nav items exist using href to be robust against text hiding/icons
  await expect(sidebar.locator('a[href="/gallery"]')).toBeVisible();
  await expect(sidebar.locator('a[href="/timeline"]')).toBeVisible();
  await expect(sidebar.locator('a[href="/sources"]')).toBeVisible();
  await expect(sidebar.locator('a[href="/library"]')).toBeVisible();
  await expect(sidebar.locator('a[href="/tags"]')).toBeVisible();

  // Test navigation
  await sidebar.locator('a[href="/gallery"]').click();
  await expect(page).toHaveURL(/.*\/gallery/);
});

test("theme toggle works", async ({ page }) => {
  await page.goto("/timeline");
  await expect(page.getByTestId("loading-skeleton")).toBeHidden();

  // Find theme toggle button
  const themeButton = page.getByLabel("Toggle theme", { exact: false });
  await expect(themeButton).toBeVisible();

  // Click it
  await themeButton.click();

  // Ideally check for class change on html or body, or local storage persistence
  // For now, just ensure no error on click
});
