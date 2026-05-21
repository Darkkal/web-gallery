import { expect, test } from "@playwright/test";

test.describe("desktop sidebar navigation", () => {
  // These tests assume a desktop viewport where the sidebar is visible
  test.use({ viewport: { width: 1280, height: 720 } });

  test("navigation sidebar works", async ({ page }) => {
    await page.goto("/timeline");
    await expect(page.getByTestId("loading-skeleton")).toBeHidden();

    // Use getByRole which respects visibility (mobile links are display:none on desktop;
    // closed sub-sheet links are aria-hidden + inert)
    await expect(page.getByRole("link", { name: "Gallery" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Timeline" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Sources" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Library" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Tags" })).toBeVisible();

    // Test navigation
    await page.getByRole("link", { name: "Gallery" }).click();
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
});
