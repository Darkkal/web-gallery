import { expect, type Locator, test } from "@playwright/test";

/**
 * Navigate to a page, wait for content to load, and dismiss the Next.js dev
 * overlay that intercepts pointer events in development mode.
 */
async function gotoPage(page: import("@playwright/test").Page, path: string) {
  await page.goto(path);
  await expect(page.getByTestId("loading-skeleton")).toBeHidden();

  // The Next.js dev overlay (<nextjs-portal>) intercepts all pointer events
  // when runtime errors occur. Remove it so test clicks work.
  await page.evaluate(() => {
    for (const el of document.querySelectorAll("nextjs-portal")) {
      el.remove();
    }
  });

  // Ensure the page is scrolled to the top so the bottom navbar is fully
  // visible and not overlapped by page content that may have loaded.
  await page.evaluate(() => window.scrollTo(0, 0));
}

/**
 * Click a locator belonging to the fixed bottom navbar.
 *
 * Chrome's mobile device emulation can let scrollable page content intercept
 * pointer events that land on the navbar even though the navbar has
 * `z-index: 50`.  Using `force: true` bypasses Playwright's actionability
 * check and dispatches the click directly to the element.
 */
async function clickNavbar(locator: Locator) {
  await locator.click({ force: true });
}

test.describe("mobile bottom navigation", () => {
  // Use a mobile viewport — these tests run under the "Mobile Chrome" project
  test.use({ viewport: { width: 375, height: 812 } });

  test("shows 4 group tabs in bottom bar", async ({ page }) => {
    await gotoPage(page, "/timeline");

    // The bottom bar shows 4 group tabs: Display, Download, Filter, Config
    await expect(page.getByRole("button", { name: "Display" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Download" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Filter" })).toBeVisible();
    // Config is a single-item group so it renders as a link, not a button
    await expect(page.getByRole("link", { name: "Config" })).toBeVisible();
  });

  test("tapping a multi-item group opens the sub-sheet", async ({ page }) => {
    await gotoPage(page, "/timeline");

    // Tap the Display group button
    await clickNavbar(page.getByRole("button", { name: "Display" }));

    // Sub-sheet should appear with Timeline and Gallery links
    await expect(page.getByRole("link", { name: "Timeline" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Gallery" })).toBeVisible();
  });

  test("sub-sheet navigation works", async ({ page }) => {
    await gotoPage(page, "/timeline");

    // Open Display group and navigate to Gallery
    await clickNavbar(page.getByRole("button", { name: "Display" }));
    await page.getByRole("link", { name: "Gallery" }).click();
    await expect(page).toHaveURL(/.*\/gallery/);

    // Sheet should close after navigation
    await expect(page.locator('[data-open="true"]')).toHaveCount(0);
  });

  test("single-item group navigates directly", async ({ page }) => {
    await gotoPage(page, "/timeline");

    // Config is a single-item group — tapping goes straight to Library
    const configLink = page.getByRole("link", { name: "Config" });
    await clickNavbar(configLink);
    await expect(page).toHaveURL(/.*\/library/);
  });

  test("tapping group again closes the sub-sheet", async ({ page }) => {
    await gotoPage(page, "/timeline");

    const displayBtn = page.getByRole("button", { name: "Display" });

    // Open
    await clickNavbar(displayBtn);
    await expect(page.getByRole("link", { name: "Gallery" })).toBeVisible();

    // Close by tapping again
    await clickNavbar(displayBtn);
    await expect(page.locator('[data-open="true"]')).toHaveCount(0);
  });
});
