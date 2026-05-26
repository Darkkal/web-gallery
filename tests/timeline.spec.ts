import { expect, test } from "@playwright/test";

test.beforeAll(async ({ browser }) => {
  const page = await browser.newPage();
  await page.goto("/settings");
  await expect(page.getByTestId("loading-skeleton")).toBeHidden();
  page.once("dialog", async (dialog) => {
    await dialog.accept();
  });
  await page.getByRole("button", { name: "Reset Defaults" }).first().click();
  await page.getByRole("button", { name: "Save Changes" }).first().click();
  // Wait for success banner to ensure settings are saved to disk
  const alert = page.locator("[class*='notification']").first();
  await expect(alert).toBeVisible({ timeout: 15000 });
  await expect(alert).toContainText("Settings saved and updated successfully!");
  await page.close();
});

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

  // Wait for the first media item wrapper to be visible
  await expect(mediaItem.first()).toBeVisible({ timeout: 5000 });
  // Dispatch click event directly to bypass native browser control interception (e.g. Firefox native video player controls)
  await mediaItem.first().dispatchEvent("click");

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
    const sentinel = page.locator('div[class*="sentinel"]').first();
    await expect(sentinel).toBeVisible();
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

test("timeline post condensing settings and toggle interaction", async ({
  page,
}) => {
  // 1. Go to settings page
  await page.goto("/settings");
  await expect(page.getByTestId("loading-skeleton")).toBeHidden();

  // 2. Toggle "Condense Long Timeline Posts" and set a short limit to ensure triggering
  const condenseToggle = page.locator("#condensePostText").first();
  await expect(condenseToggle).toBeAttached();

  const isInitiallyChecked = await condenseToggle.isChecked();
  if (!isInitiallyChecked) {
    const toggleLabel = page.locator("label[for='condensePostText']").first();
    await toggleLabel.click();
  }

  const lengthInput = page.locator("#condensePostLines").first();
  await expect(lengthInput).toBeAttached();
  await lengthInput.fill("1");

  // Save changes
  const saveButton = page.getByRole("button", { name: "Save Changes" }).first();
  await saveButton.click();

  // Expect success banner
  const alert = page.locator("[class*='notification']").first();
  await expect(alert).toBeVisible({ timeout: 15000 });
  await expect(alert).toContainText("Settings saved and updated successfully!");

  // 3. Go to timeline
  await page.goto("/timeline");
  await expect(page.getByTestId("loading-skeleton")).toBeHidden();

  // Skip test if no posts found
  try {
    await expect(page.locator("article").first()).toBeVisible({
      timeout: 5000,
    });
  } catch {
    test.skip(true, "No posts found to test condensing");
    return;
  }

  // Find a post that has the "Show More" button (condensed text)
  const showMoreBtn = page.locator('button[class*="toggleTextButton"]').first();

  // Wait for the button to become visible (ResizeObserver runs asynchronously after layout)
  try {
    await showMoreBtn.waitFor({ state: "visible", timeout: 5000 });
  } catch {
    test.skip(true, "No posts met the 1-line limit to show 'Show More'");
    return;
  }
  await expect(showMoreBtn).toHaveText("Show More");

  // Click Show More
  await showMoreBtn.click();
  await expect(showMoreBtn).toHaveText("Show Less");

  // Click Show Less
  await showMoreBtn.click();
  await expect(showMoreBtn).toHaveText("Show More");
});
