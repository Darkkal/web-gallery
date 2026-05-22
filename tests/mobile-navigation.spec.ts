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
 * Click a locator belonging to the fixed bottom navbar or its sub-sheet.
 *
 * Chrome's mobile device emulation has a z-index stacking bug where parent
 * fixed-position containers (the bottom bar at z-index 50, group sheets at
 * z-index 49, or scrollable page content) intercept pointer events that
 * should reach their children.  Using `force: true` bypasses Playwright's
 * actionability check and dispatches the click directly to the element.
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
    // Config now has Settings and Library, so it is a multi-item group rendering as a button
    await expect(page.getByRole("button", { name: "Config" })).toBeVisible();
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
    // Wait for the sheet slide-up animation to finish before clicking.
    // The link is visible in the DOM immediately but the CSS transition
    // (bottom: -300px → 60px, 300ms) hasn't completed yet.
    const galleryLink = page.getByRole("link", { name: "Gallery" });
    await galleryLink.waitFor({ state: "visible" });
    await galleryLink.scrollIntoViewIfNeeded();
    await galleryLink.waitFor({ state: "attached" }); // re-fetch after scroll
    // Small wait for the CSS transition to settle
    await page.waitForTimeout(400);
    await clickNavbar(galleryLink);
    await expect(page).toHaveURL(/.*\/gallery/);

    // Sheet should close after navigation
    await expect(page.locator('[data-open="true"]')).toHaveCount(0);
  });

  test("multi-item group Config navigates to Library", async ({ page }) => {
    await gotoPage(page, "/timeline");

    // Config has multiple items — open its sub-sheet and tap Library
    await clickNavbar(page.getByRole("button", { name: "Config" }));
    const libraryLink = page.getByRole("link", { name: "Library" });
    await libraryLink.waitFor({ state: "visible" });
    await libraryLink.scrollIntoViewIfNeeded();
    await libraryLink.waitFor({ state: "attached" });
    await page.waitForTimeout(400);
    await clickNavbar(libraryLink);
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
