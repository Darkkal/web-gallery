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
});
