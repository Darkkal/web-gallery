import { expect, test } from "@playwright/test";

test.describe("Search Autocomplete E2E", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/gallery");
    await expect(page.getByTestId("loading-skeleton")).toBeHidden();
  });

  test("should show column suggestions when typing search prefix", async ({
    page,
  }) => {
    const searchInput = page.getByPlaceholder(/Search \(e\.g\..*\)/).first();
    await expect(searchInput).toBeVisible();

    // Type the start of a column prefix
    await searchInput.focus();
    await searchInput.pressSequentially("ta", { delay: 50 });
    await expect(searchInput).toHaveValue("ta");

    // Dropdown should be visible
    const dropdown = page.locator("#search-autocomplete-listbox");
    await expect(dropdown).toBeVisible();

    // Check suggestions list matching "ta"
    const firstOption = page.locator("#suggestion-item-0");
    await expect(firstOption).toBeVisible();
    await expect(firstOption).toContainText("tag:");

    // Press Tab to complete the column prefix
    await page.keyboard.press("Tab");

    // The input should now contain "tag:"
    await expect(searchInput).toHaveValue("tag:");
  });

  test("should support keyboard navigation (Arrow keys and Enter)", async ({
    page,
  }) => {
    const searchInput = page.getByPlaceholder(/Search \(e\.g\..*\)/).first();
    await searchInput.focus();
    await searchInput.pressSequentially("t", { delay: 50 });
    await expect(searchInput).toHaveValue("t");

    const dropdown = page.locator("#search-autocomplete-listbox");
    await expect(dropdown).toBeVisible();

    const firstOption = page.locator("#suggestion-item-0");
    const secondOption = page.locator("#suggestion-item-1");

    await expect(firstOption).toHaveAttribute("aria-selected", "true");
    await expect(secondOption).toHaveAttribute("aria-selected", "false");

    // Navigate to the next suggestion
    await page.keyboard.press("ArrowDown");
    await expect(firstOption).toHaveAttribute("aria-selected", "false");
    await expect(secondOption).toHaveAttribute("aria-selected", "true");

    // Select it
    await page.keyboard.press("Enter");
    const val = await searchInput.inputValue();
    expect(val.toLowerCase()).toContain("title:");
  });

  test("should show static completions for source and extractor filters", async ({
    page,
  }) => {
    const searchInput = page.getByPlaceholder(/Search \(e\.g\..*\)/).first();

    await searchInput.focus();
    await searchInput.pressSequentially("extractor:", { delay: 50 });
    await expect(searchInput).toHaveValue("extractor:");

    const dropdown = page.locator("#search-autocomplete-listbox");
    await expect(dropdown).toBeVisible();

    // Playwright automatically retries this assertion until the asynchronous static suggestions load!
    await expect(dropdown).toContainText("twitter");
    await expect(dropdown).toContainText("pixiv");

    const suggestionCount = await page
      .locator('[class*="suggestionItem"]')
      .count();
    expect(suggestionCount).toBeGreaterThanOrEqual(2);
  });

  test("should close dropdown on Escape press", async ({ page }) => {
    const searchInput = page.getByPlaceholder(/Search \(e\.g\..*\)/).first();
    await searchInput.focus();
    await searchInput.pressSequentially("ta", { delay: 50 });
    await expect(searchInput).toHaveValue("ta");

    const dropdown = page.locator("#search-autocomplete-listbox");
    await expect(dropdown).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(dropdown).not.toBeVisible();
  });

  test("should show context-aware suggestions (co-occurring tags)", async ({
    page,
  }) => {
    await page.goto("/gallery");
    await expect(page.getByTestId("loading-skeleton")).toBeHidden();

    // Check for grid items
    const mediaItems = page.locator(
      'img[class*="media"], video[class*="media"]',
    );
    const itemsCount = await mediaItems.count();
    if (itemsCount === 0) {
      test.skip(
        true,
        "No gallery items found - skipping context-aware suggestion test",
      );
      return;
    }

    let tag1 = "";
    let tag2 = "";

    // Iterate through the first few items to find one with at least 2 tags
    const maxToInspect = Math.min(itemsCount, 5);
    for (let i = 0; i < maxToInspect; i++) {
      await mediaItems.nth(i).click();

      const lightbox = page.locator('div[class*="overlay"]');
      await expect(lightbox).toBeVisible();

      // Find the tag chips in the lightbox
      const tagChips = page.locator('span[class*="tagChip"]');
      const chipsCount = await tagChips.count();

      if (chipsCount >= 2) {
        const text1 = await tagChips.nth(0).textContent();
        const text2 = await tagChips.nth(1).textContent();

        if (text1 && text2) {
          tag1 = text1.trim().replace(/^#/, "");
          tag2 = text2.trim().replace(/^#/, "");

          // Make sure the tag names don't contain spaces to keep autocomplete simple
          if (tag1 && tag2 && !tag1.includes(" ") && !tag2.includes(" ")) {
            await page.keyboard.press("Escape");
            await expect(lightbox).not.toBeVisible();
            break;
          }
        }
      }

      // Close lightbox and try next item
      await page.keyboard.press("Escape");
      await expect(lightbox).not.toBeVisible();
    }

    if (!tag1 || !tag2) {
      test.skip(
        true,
        "No posts with 2+ valid tags found - skipping context-aware suggestion test",
      );
      return;
    }

    const searchInput = page.getByPlaceholder(/Search \(e\.g\..*\)/).first();
    await searchInput.focus();

    // Type the first filter
    await searchInput.pressSequentially(`tag:${tag1} `, { delay: 50 });
    await expect(searchInput).toHaveValue(`tag:${tag1} `);

    // Type the next filter prefix (first few characters of tag2)
    const tag2Prefix = tag2.slice(0, Math.max(1, Math.min(3, tag2.length)));
    await searchInput.pressSequentially(`tag:${tag2Prefix}`, { delay: 50 });
    await expect(searchInput).toHaveValue(`tag:${tag1} tag:${tag2Prefix}`);

    const dropdown = page.locator("#search-autocomplete-listbox");
    await expect(dropdown).toBeVisible();

    // The first option or suggestions list should update to contain tag2
    const firstOption = page.locator("#suggestion-item-0");
    await expect(firstOption).toContainText(tag2);

    // Press Enter to complete it
    await page.keyboard.press("Enter");

    // The search input should now contain both tags completed
    await expect(searchInput).toHaveValue(`tag:${tag1} tag:${tag2} `);
  });
});
