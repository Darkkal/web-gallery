import { expect, test } from "@playwright/test";

test.describe("mobile bottom navigation", () => {
  // Use a mobile viewport — these tests run under the "Mobile Chrome" project
  test.use({ viewport: { width: 375, height: 812 } });

  test("shows 4 group tabs in bottom bar", async ({ page }) => {
    await page.goto("/timeline");
    await expect(page.getByTestId("loading-skeleton")).toBeHidden();

    // The bottom bar shows 4 group tabs: Display, Download, Filter, Config
    await expect(page.getByRole("button", { name: "Display" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Download" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Filter" })).toBeVisible();
    // Config is a single-item group so it renders as a link, not a button
    await expect(page.getByRole("link", { name: "Config" })).toBeVisible();
  });

  test("tapping a multi-item group opens the sub-sheet", async ({ page }) => {
    await page.goto("/timeline");
    await expect(page.getByTestId("loading-skeleton")).toBeHidden();

    // Tap the Display group button
    await page.getByRole("button", { name: "Display" }).click();

    // Sub-sheet should appear with Timeline and Gallery links
    await expect(page.getByRole("link", { name: "Timeline" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Gallery" })).toBeVisible();
  });

  test("sub-sheet navigation works", async ({ page }) => {
    await page.goto("/timeline");
    await expect(page.getByTestId("loading-skeleton")).toBeHidden();

    // Open Display group and navigate to Gallery
    await page.getByRole("button", { name: "Display" }).click();
    await page.getByRole("link", { name: "Gallery" }).click();
    await expect(page).toHaveURL(/.*\/gallery/);

    // Sheet should close after navigation
    await expect(page.locator('[data-open="true"]')).toHaveCount(0);
  });

  test("single-item group navigates directly", async ({ page }) => {
    await page.goto("/timeline");
    await expect(page.getByTestId("loading-skeleton")).toBeHidden();

    // Remove any Next.js dev overlay that might intercept pointer events
    await page.evaluate(() => {
      for (const el of document.querySelectorAll("nextjs-portal")) {
        el.remove();
      }
    });

    // Config is a single-item group — tapping goes straight to Library
    const configLink = page.getByRole("link", { name: "Config" });
    await configLink.click();
    await expect(page).toHaveURL(/.*\/library/);
  });

  test("tapping group again closes the sub-sheet", async ({ page }) => {
    await page.goto("/timeline");
    await expect(page.getByTestId("loading-skeleton")).toBeHidden();

    const displayBtn = page.getByRole("button", { name: "Display" });

    // Open
    await displayBtn.click();
    await expect(page.getByRole("link", { name: "Gallery" })).toBeVisible();

    // Close by tapping again
    await displayBtn.click();
    await expect(page.locator('[data-open="true"]')).toHaveCount(0);
  });
});
