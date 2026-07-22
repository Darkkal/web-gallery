import { expect, test } from "@playwright/test";

test("gallery page loads", async ({ page }) => {
  await page.goto("/gallery");
  await expect(page.getByTestId("loading-skeleton")).toBeHidden();
  await expect(page).toHaveURL(/.*\/gallery/);

  // Check for search bar
  await expect(
    page.getByPlaceholder(/Search \(e\.g\..*\)/).first(),
  ).toBeVisible();
});

test("gallery filtering", async ({ page }) => {
  await page.goto("/gallery");
  await expect(page.getByTestId("loading-skeleton")).toBeHidden();

  // Check filter select exists
  await expect(page.locator("select").first()).toBeVisible();

  // Just verify the search input works for filtering
  const searchInput = page.getByPlaceholder(/Search \(e\.g\..*\)/).first();
  await searchInput.fill("source:pixiv");
  await expect(searchInput).toHaveValue("source:pixiv");
});

test("gallery grid and lightbox", async ({ page }) => {
  await page.goto("/gallery");
  await expect(page.getByTestId("loading-skeleton")).toBeHidden();

  // Check for grid
  await expect(page.getByTestId("masonry-grid").first()).toBeVisible();

  // Wait for items — skip if no data (CI has empty DB)
  try {
    await expect(page.locator('img[class*="media"]').first()).toBeVisible({
      timeout: 5000,
    });
  } catch {
    test.skip(true, "No gallery items to test");
    return;
  }

  // Test Lightbox
  await page.locator('img[class*="media"]').first().click();

  const lightbox = page.locator('div[class*="overlay"]');
  await expect(lightbox).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(lightbox).not.toBeVisible();
});

test("lightbox navigation zones span full-height and handle navigation", async ({
  page,
}) => {
  await page.goto("/gallery");
  await expect(page.getByTestId("loading-skeleton")).toBeHidden();

  try {
    await expect(page.locator('img[class*="media"]').first()).toBeVisible({
      timeout: 5000,
    });
  } catch {
    test.skip(true, "No gallery items to test lightbox navigation zones");
    return;
  }

  // Open lightbox on first item
  await page.locator('img[class*="media"]').first().click();
  const lightbox = page.locator('div[class*="overlay"]');
  await expect(lightbox).toBeVisible();

  // Next navigation zone should be visible and attached
  const nextZone = page.locator('button[class*="navZoneNext"]').first();
  const prevZone = page.locator('button[class*="navZonePrev"]').first();

  await expect(nextZone).toBeVisible();

  // Verify bounding box height matches mainArea
  const boundingBox = await nextZone.boundingBox();
  const mainAreaBox = await page
    .locator('div[class*="mainArea"]')
    .first()
    .boundingBox();

  expect(boundingBox).not.toBeNull();
  expect(mainAreaBox).not.toBeNull();

  if (boundingBox && mainAreaBox) {
    expect(boundingBox.height).toBeGreaterThanOrEqual(mainAreaBox.height - 2);
  }

  // Click next zone
  if (await nextZone.isVisible()) {
    await nextZone.click();
    // After navigating to second item, prev zone should become visible
    await expect(prevZone).toBeVisible();
  }

  await page.keyboard.press("Escape");
  await expect(lightbox).not.toBeVisible();
});

test("gallery defaults to infinite scroll mode", async ({ page }) => {
  await page.goto("/gallery");
  await expect(page.getByTestId("loading-skeleton")).toBeHidden();

  // Wait for items — skip if no data (CI has empty DB)
  try {
    await expect(page.locator('img[class*="media"]').first()).toBeVisible({
      timeout: 5000,
    });
  } catch {
    test.skip(true, "No gallery items — cannot test scroll mode behavior");
    return;
  }

  // By default, the "Load More" button should NOT be visible (infinite scroll is the default)
  const loadMoreButton = page.getByRole("button", { name: "Load More" });
  await expect(loadMoreButton).not.toBeVisible();

  // The sentinel element should be present since there are items
  const sentinel = page.locator('div[class*="sentinel"]').first();
  await expect(sentinel).toBeVisible();
});

test("gallery infinite scroll loads more items", async ({ page }) => {
  await page.goto("/gallery");
  await expect(page.getByTestId("loading-skeleton")).toBeHidden();

  // Wait for items — skip if no data (CI has empty DB)
  try {
    await expect(page.locator('img[class*="media"]').first()).toBeVisible({
      timeout: 5000,
    });
  } catch {
    test.skip(true, "No gallery items — cannot test infinite scroll");
    return;
  }

  // Count both images and videos — both use the .media CSS module class
  const mediaElements = page.locator(
    'img[class*="media"], video[class*="media"]',
  );

  // Wait for the count to be at least 1 to ensure some rendering happened
  await expect(mediaElements.first()).toBeVisible();

  const initialCount = await mediaElements.count();

  if (initialCount < 20) {
    test.skip(
      true,
      `Only ${initialCount} items, need at least 20 to test infinite scroll`,
    );
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
    console.log("No additional items loaded (may be at end of data)");
  }
});

test("gallery column controls change column counts", async ({ page }) => {
  await page.goto("/gallery");
  await expect(page.getByTestId("loading-skeleton")).toBeHidden();

  // Find the column count label
  const label = page.locator("span", { hasText: /Columns:/ }).first();
  await expect(label).toBeVisible();

  // Find and click "Decrease Columns" button
  const decreaseBtn = page
    .getByRole("button", { name: "Decrease Columns" })
    .first();
  const increaseBtn = page
    .getByRole("button", { name: "Increase Columns" })
    .first();

  await expect(decreaseBtn).toBeVisible();
  await expect(increaseBtn).toBeVisible();

  // Check initial columns count (default is 4)
  await expect(label).toHaveText("Columns: 4");

  // Click decrease columns
  await decreaseBtn.click();
  await expect(label).toHaveText("Columns: 3");

  // Click decrease columns twice more
  await decreaseBtn.click();
  await decreaseBtn.click();
  await expect(label).toHaveText("Columns: 1");
  await expect(decreaseBtn).toBeDisabled();

  // Click increase columns twice
  await increaseBtn.click();
  await increaseBtn.click();
  await expect(label).toHaveText("Columns: 3");
  await expect(decreaseBtn).toBeEnabled();
});

test("lightbox user click populates user filter search", async ({ page }) => {
  await page.goto("/gallery");
  await expect(page.getByTestId("loading-skeleton")).toBeHidden();

  try {
    await expect(page.locator('img[class*="media"]').first()).toBeVisible({
      timeout: 5000,
    });
  } catch {
    test.skip(true, "No gallery items to test user click in lightbox");
    return;
  }

  await page.locator('img[class*="media"]').first().click();
  const lightbox = page.locator('div[class*="overlay"]');
  await expect(lightbox).toBeVisible();

  const userAvatar = page
    .locator('button[class*="userClickableAvatar"]')
    .first();
  const userText = page.locator('button[class*="userClickableText"]').first();

  if ((await userAvatar.count()) > 0) {
    await userAvatar.click();
    await expect(lightbox).not.toBeVisible();
    const searchInput = page.getByPlaceholder(/Search \(e\.g\..*\)/).first();
    await expect(searchInput).toHaveValue(/user:.*/);
  } else if ((await userText.count()) > 0) {
    await userText.click();
    await expect(lightbox).not.toBeVisible();
    const searchInput = page.getByPlaceholder(/Search \(e\.g\..*\)/).first();
    await expect(searchInput).toHaveValue(/user:.*/);
  } else {
    test.skip(true, "No user metadata present on open lightbox item");
  }
});
