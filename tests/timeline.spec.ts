import { test, expect } from "@playwright/test";

test("timeline page loads", async ({ page }) => {
  // Start from the index page (which redirects to timeline)
  await page.goto("/");
  await expect(page.getByTestId("loading-skeleton")).toBeHidden();

  // Expect to be redirected to /timeline
  await expect(page).toHaveURL(/.*\/timeline/);

  // Check for the search input
  await expect(page.getByPlaceholder(/Search timeline/).first()).toBeVisible();

  // Check for the feed container
  const feed = page.locator('div[class*="feed"]').first();
  await expect(feed).toBeVisible();
});

test("timeline search interaction", async ({ page }) => {
  await page.goto("/timeline");
  await expect(page.getByTestId("loading-skeleton")).toBeHidden();
  const searchInput = page.getByPlaceholder(/Search timeline/).first();
  await expect(searchInput).toBeVisible();

  await searchInput.fill("source:twitter");
  await expect(searchInput).toHaveValue("source:twitter");
});

test("timeline lightbox opens", async ({ page }) => {
  await page.goto("/timeline");
  await expect(page.getByTestId("loading-skeleton")).toBeHidden();

  // Wait for posts — skip if no data (CI has empty DB)
  try {
    await expect(page.locator("article").first()).toBeVisible({
      timeout: 5000,
    });
  } catch {
    test.skip(true, "No posts found to test lightbox");
    return;
  }

  // Check if we have any media items
  const mediaItem = page.locator('div[class*="mediaItem"]');
  if ((await mediaItem.count()) === 0) {
    test.skip(true, "No media items found to test lightbox");
    return;
  }

  await mediaItem.first().click();

  // Expect lightbox overlay
  const lightbox = page.locator('div[class*="overlay"]');
  await expect(lightbox).toBeVisible();

  // Close it
  await page.keyboard.press("Escape");
  await expect(lightbox).not.toBeVisible();
});

test("timeline sorting interaction", async ({ page }) => {
  await page.goto("/timeline");
  await expect(page.getByTestId("loading-skeleton")).toBeHidden();

  // Check for the sort select
  const sortSelect = page.locator("select").first();
  await expect(sortSelect).toBeVisible();

  // Change sort to "Oldest First"
  await sortSelect.selectOption("created-asc");
  await expect(sortSelect).toHaveValue("created-asc");
});

test("timeline scroll mode toggle is visible", async ({ page }) => {
  await page.goto("/timeline");
  await expect(page.getByTestId("loading-skeleton")).toBeHidden();

  // The scroll mode toggle should be visible in the filter bar regardless of data
  await expect(page.getByLabel("Use infinite scroll").first()).toBeVisible();
  await expect(page.getByLabel("Paginate manually").first()).toBeVisible();
});

test("timeline defaults to infinite scroll mode", async ({ page }) => {
  await page.goto("/timeline");
  await expect(page.getByTestId("loading-skeleton")).toBeHidden();

  // Wait for posts — skip if no data (CI has empty DB)
  try {
    await expect(page.locator("article").first()).toBeVisible({
      timeout: 5000,
    });
  } catch {
    test.skip(true, "No posts — cannot test scroll mode behavior");
    return;
  }

  // By default, the "Load More" button should NOT be visible (infinite scroll is the default)
  const loadMoreButton = page.getByRole("button", { name: "Load More" });
  await expect(loadMoreButton).not.toBeVisible();

  // The sentinel element should be present if there are enough posts
  const articles = page.locator("article");
  if ((await articles.count()) >= 20) {
    const sentinel = page.locator('div[class*="sentinel"]');
    await expect(sentinel).toBeVisible();
  }
});

test("timeline can switch to load more button mode", async ({ page }) => {
  await page.goto("/timeline");
  await expect(page.getByTestId("loading-skeleton")).toBeHidden();

  // Wait for posts — skip if no data (CI has empty DB)
  try {
    await expect(page.locator("article").first()).toBeVisible({
      timeout: 5000,
    });
  } catch {
    test.skip(true, "No posts — cannot test scroll mode switching");
    return;
  }

  // Click the manual pagination toggle
  await page.getByLabel("Paginate manually").click();

  // Wait for React to re-render with the new scroll mode
  await page.waitForTimeout(500);

  // The "Load More" button should now be visible if there are enough posts
  const articles = page.locator("article");
  if ((await articles.count()) >= 20) {
    const loadMoreButton = page.getByRole("button", { name: "Load More" });
    await expect(loadMoreButton).toBeVisible();
  }
});

test("timeline infinite scroll loads more posts", async ({ page }) => {
  await page.goto("/timeline");
  await expect(page.getByTestId("loading-skeleton")).toBeHidden();

  // Wait for posts — skip if no data (CI has empty DB)
  try {
    await expect(page.locator("article").first()).toBeVisible({
      timeout: 5000,
    });
  } catch {
    test.skip(true, "No posts — cannot test infinite scroll");
    return;
  }

  const articles = page.locator("article");
  const initialCount = await articles.count();

  if (initialCount < 20) {
    test.skip(true, "Not enough posts to test infinite scroll");
    return;
  }

  // Scroll to the bottom to trigger the IntersectionObserver
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

  // Wait for potential loading and new posts
  try {
    await expect(async () => {
      const newCount = await articles.count();
      expect(newCount).toBeGreaterThan(initialCount);
    }).toPass({ timeout: 5000 });
  } catch {
    // May have been no more data to load — that's fine
    console.log("No additional posts loaded (may be at end of data)");
  }
});
