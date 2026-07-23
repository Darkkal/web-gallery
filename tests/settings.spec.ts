import { expect, test } from "@playwright/test";

test.describe
  .serial("Settings Page", () => {
    test.beforeAll(async ({ browser }) => {
      const page = await browser.newPage();
      await page.goto("/settings");
      await expect(page.getByTestId("loading-skeleton")).toBeHidden();
      await expect(
        page.locator("[data-hydrated='true']").first(),
      ).toBeVisible();
      page.once("dialog", async (dialog) => {
        await dialog.accept();
      });
      await page
        .getByRole("button", { name: "Reset Defaults" })
        .first()
        .click();
      await page.getByRole("button", { name: "Save Changes" }).first().click();
      // Wait for success banner to ensure settings are saved to disk
      const alert = page.locator("[class*='notification']").first();
      await expect(alert).toBeVisible({ timeout: 15000 });
      await expect(alert).toContainText(
        "Settings saved and updated successfully!",
      );
      await page.close();
    });

    test.beforeEach(async ({ page }) => {
      // Navigate to settings page before each test
      await page.goto("/settings");
      await expect(page.getByTestId("loading-skeleton")).toBeHidden();
      await expect(
        page.locator("[data-hydrated='true']").first(),
      ).toBeVisible();
    });

    test("loads settings page and switches tabs", async ({ page }) => {
      // Check main title is present
      await expect(page.locator("h1").first()).toHaveText("System Settings");

      // "App Settings" tab is active by default and contains core layout controls
      const appSettingsTab = page
        .getByRole("button", { name: "App Settings" })
        .first();
      await expect(appSettingsTab).toBeVisible();
      await expect(
        page.getByRole("heading", { name: "General Display & Layout" }).first(),
      ).toBeVisible();

      // Switch to Scraper Settings
      const scraperSettingsTab = page
        .getByRole("button", { name: "Scraper Settings" })
        .first();
      await expect(scraperSettingsTab).toBeVisible();
      await scraperSettingsTab.click();

      // Network and Rate-limit groups should now be visible
      await expect(
        page
          .getByRole("heading", { name: "Network & Fetching Controls" })
          .first(),
      ).toBeVisible();
      await expect(
        page
          .getByRole("heading", { name: "Sleep & Rate-Limit Evasion" })
          .first(),
      ).toBeVisible();

      // Switch back to App Settings
      await appSettingsTab.click();
      await expect(
        page.getByRole("heading", { name: "General Display & Layout" }).first(),
      ).toBeVisible();
    });

    test("can modify and save App settings, and persists after reload", async ({
      page,
    }) => {
      // Modify Gallery Page Size
      const galleryPageSizeInput = page.locator("#galleryPageSize").first();
      await expect(galleryPageSizeInput).toBeAttached();
      await galleryPageSizeInput.fill("125");

      // Change Scroll Mode to "Explicit Button"
      const scrollModeSelect = page.locator("#scrollMode").first();
      await expect(scrollModeSelect).toBeAttached();
      await scrollModeSelect.selectOption("button");

      // Verify and toggle "Loop Videos by Default" (should be true initially)
      const loopVideosToggle = page.locator("#loopVideos").first();
      await expect(loopVideosToggle).toBeAttached();
      const initialLoopChecked = await loopVideosToggle.isChecked();
      expect(initialLoopChecked).toBe(true);

      const loopToggleLabel = page.locator("label[for='loopVideos']").first();
      await loopToggleLabel.click();
      expect(await loopVideosToggle.isChecked()).toBe(false);

      // Toggle Destructive Ops in Production by clicking its visible switch label wrapper
      const destructiveOpsToggle = page
        .locator("#enableProductionDestructiveOps")
        .first();
      await expect(destructiveOpsToggle).toBeAttached();
      const initialChecked = await destructiveOpsToggle.isChecked();

      const toggleLabel = page
        .locator("label[for='enableProductionDestructiveOps']")
        .first();
      await toggleLabel.click();

      expect(await destructiveOpsToggle.isChecked()).toBe(!initialChecked);

      // Modify Infinite Scroll Buffer
      const infiniteScrollBufferInput = page
        .locator("#infiniteScrollBuffer")
        .first();
      await expect(infiniteScrollBufferInput).toBeAttached();
      await infiniteScrollBufferInput.fill("450");

      // Save Changes
      const saveButton = page
        .getByRole("button", { name: "Save Changes" })
        .first();
      await saveButton.click();

      // Expect success notification
      const alert = page.locator("[class*='notification']").first();
      await expect(alert).toBeVisible({ timeout: 15000 });
      await expect(alert).toContainText(
        "Settings saved and updated successfully!",
      );

      // Reload the page and verify persistence
      await page.reload();
      await expect(page.getByTestId("loading-skeleton")).toBeHidden();
      await expect(
        page.locator("[data-hydrated='true']").first(),
      ).toBeVisible();

      // Verify values are preserved
      await expect(page.locator("#galleryPageSize").first()).toHaveValue("125");
      await expect(page.locator("#scrollMode").first()).toHaveValue("button");
      expect(await page.locator("#loopVideos").first().isChecked()).toBe(false);
      expect(
        await page
          .locator("#enableProductionDestructiveOps")
          .first()
          .isChecked(),
      ).toBe(!initialChecked);
      await expect(page.locator("#infiniteScrollBuffer").first()).toHaveValue(
        "450",
      );
    });

    test("can modify and save Scraper settings, and persists after reload", async ({
      page,
    }) => {
      // Switch to Scraper Settings tab
      await page
        .getByRole("button", { name: "Scraper Settings" })
        .first()
        .click();

      // Modify scraper settings
      const retriesInput = page.locator("#retries").first();
      await expect(retriesInput).toBeAttached();
      await retriesInput.fill("7");

      const proxyInput = page.locator("#proxy").first();
      await expect(proxyInput).toBeAttached();
      await proxyInput.fill("http://proxy.test:8888");

      const sleepMin = page.locator("#sleepMin").first();
      const sleepMax = page.locator("#sleepMax").first();
      await expect(sleepMin).toBeAttached();
      await expect(sleepMax).toBeAttached();
      await sleepMin.fill("4");
      await sleepMax.fill("9");

      // Save Changes
      await page.getByRole("button", { name: "Save Changes" }).first().click();

      // Expect success notification
      const alert = page.locator("[class*='notification']").first();
      await expect(alert).toBeVisible({ timeout: 15000 });
      await expect(alert).toContainText(
        "Settings saved and updated successfully!",
      );

      // Reload the page and verify persistence
      await page.reload();
      await expect(page.getByTestId("loading-skeleton")).toBeHidden();
      await expect(
        page.locator("[data-hydrated='true']").first(),
      ).toBeVisible();

      // The reload defaults to "app" tab. Switch to "scraper" tab to check
      await page
        .getByRole("button", { name: "Scraper Settings" })
        .first()
        .click();

      await expect(page.locator("#retries").first()).toHaveValue("7");
      await expect(page.locator("#proxy").first()).toHaveValue(
        "http://proxy.test:8888",
      );
      await expect(page.locator("#sleepMin").first()).toHaveValue("4");
      await expect(page.locator("#sleepMax").first()).toHaveValue("9");
    });

    test("validates App page sizes", async ({ page }) => {
      // Set invalid gallery page size (below 1) - use -1 since 0 falls back to 50 in form state logic
      const galleryPageSizeInput = page.locator("#galleryPageSize").first();
      await galleryPageSizeInput.fill("-1");

      await page.getByRole("button", { name: "Save Changes" }).first().click();
      const alert = page.locator("[class*='notification']").first();
      await expect(alert).toBeVisible({ timeout: 15000 });
      await expect(alert).toContainText(
        "Gallery page size must be between 1 and 500.",
      );

      // Set invalid gallery page size too large (above 500)
      await galleryPageSizeInput.fill("501");

      await page.getByRole("button", { name: "Save Changes" }).first().click();
      await expect(alert).toBeVisible({ timeout: 15000 });
      await expect(alert).toContainText(
        "Gallery page size must be between 1 and 500.",
      );
    });

    test("validates App scroll buffer", async ({ page }) => {
      const infiniteScrollBufferInput = page
        .locator("#infiniteScrollBuffer")
        .first();
      await expect(infiniteScrollBufferInput).toBeAttached();

      // Set invalid scroll buffer (below 0)
      await infiniteScrollBufferInput.fill("-50");
      await page.getByRole("button", { name: "Save Changes" }).first().click();
      const alert = page.locator("[class*='notification']").first();
      await expect(alert).toBeVisible({ timeout: 15000 });
      await expect(alert).toContainText(
        "Infinite scroll buffer must be between 0 and 2000 pixels.",
      );

      // Set invalid scroll buffer too large (above 2000)
      await infiniteScrollBufferInput.fill("2050");
      await page.getByRole("button", { name: "Save Changes" }).first().click();
      await expect(alert).toBeVisible({ timeout: 15000 });
      await expect(alert).toContainText(
        "Infinite scroll buffer must be between 0 and 2000 pixels.",
      );
    });

    test("validates Scraper sleep ranges", async ({ page }) => {
      await page
        .getByRole("button", { name: "Scraper Settings" })
        .first()
        .click();

      const sleepMin = page.locator("#sleepMin").first();
      const sleepMax = page.locator("#sleepMax").first();

      // Set invalid sleep range (Min > Max)
      await sleepMin.fill("12");
      await sleepMax.fill("6");

      await page.getByRole("button", { name: "Save Changes" }).first().click();
      const alert = page.locator("[class*='notification']").first();
      await expect(alert).toBeVisible({ timeout: 15000 });
      await expect(alert).toContainText(
        "Scraper sleep range is invalid (Min must be >= 0 and <= Max).",
      );
    });

    test("resets settings to defaults with confirmation", async ({ page }) => {
      // First, modify an app setting to a custom value
      const galleryPageSizeInput = page.locator("#galleryPageSize").first();
      await galleryPageSizeInput.fill("188");

      // Setup listener to accept the confirmation dialog
      page.once("dialog", async (dialog) => {
        expect(dialog.message()).toContain(
          "Are you sure you want to reset all settings to defaults?",
        );
        await dialog.accept();
      });

      // Click Reset Defaults button
      await page
        .getByRole("button", { name: "Reset Defaults" })
        .first()
        .click();

      // Verify it resets in form but not saved yet (shows notification warning banner)
      const alert = page.locator("[class*='notification']").first();
      await expect(alert).toBeVisible({ timeout: 15000 });
      await expect(alert).toContainText(
        "Reset settings in form. Click 'Save Changes' to commit.",
      );
      await expect(galleryPageSizeInput).toHaveValue("50"); // Default value
      await expect(page.locator("#loopVideos").first()).toBeChecked(); // Reset to default true

      // Save Changes to actually persist the default reset
      await page.getByRole("button", { name: "Save Changes" }).first().click();
      await expect(alert).toContainText(
        "Settings saved and updated successfully!",
      );

      // Reload and check it's still default
      await page.reload();
      await expect(page.getByTestId("loading-skeleton")).toBeHidden();
      await expect(
        page.locator("[data-hydrated='true']").first(),
      ).toBeVisible();
      await expect(page.locator("#galleryPageSize").first()).toHaveValue("50");
      await expect(page.locator("#loopVideos").first()).toBeChecked();
    });

    test("renders Lightbox settings section and handles auto-hide toggle state", async ({
      page,
    }) => {
      // Lightbox heading should be visible under App Settings
      await expect(
        page.getByRole("heading", { name: "Lightbox Settings" }).first(),
      ).toBeVisible();

      // Check all controls exist with defaults
      const fitModeSelect = page.locator("#lightboxFitMode").first();
      const zoomMinInput = page.locator("#lightboxZoomMin").first();
      const zoomMaxInput = page.locator("#lightboxZoomMax").first();
      const zoomStepInput = page.locator("#lightboxZoomStep").first();
      const autoHideToggle = page.locator("#lightboxAutoHideControls").first();
      const autoHideDelayInput = page.locator("#lightboxAutoHideDelay").first();

      await expect(fitModeSelect).toBeVisible();
      await expect(fitModeSelect).toHaveValue("fitBoth");

      await expect(zoomMinInput).toBeVisible();
      await expect(zoomMinInput).toHaveValue("50");

      await expect(zoomMaxInput).toBeVisible();
      await expect(zoomMaxInput).toHaveValue("200");

      await expect(zoomStepInput).toBeVisible();
      await expect(zoomStepInput).toHaveValue("25");

      await expect(autoHideToggle).toBeAttached();
      expect(await autoHideToggle.isChecked()).toBe(false);

      // Auto-hide delay input should be disabled when auto-hide is off
      await expect(autoHideDelayInput).toBeDisabled();

      // Toggle auto-hide on via switch label
      const toggleLabel = page
        .locator("label[for='lightboxAutoHideControls']")
        .first();
      await toggleLabel.click();

      expect(await autoHideToggle.isChecked()).toBe(true);
      await expect(autoHideDelayInput).toBeEnabled();
    });

    test("validates Lightbox zoom bounds and range rules", async ({ page }) => {
      const zoomMinInput = page.locator("#lightboxZoomMin").first();
      const zoomMaxInput = page.locator("#lightboxZoomMax").first();
      const saveButton = page
        .getByRole("button", { name: "Save Changes" })
        .first();

      // Min zoom out of range (< 10)
      await zoomMinInput.fill("5");
      await saveButton.click();
      const alert = page.locator("[class*='notification']").first();
      await expect(alert).toBeVisible({ timeout: 15000 });
      await expect(alert).toContainText(
        "Lightbox minimum zoom must be between 10% and 100%.",
      );

      // Reset min zoom, test min > max validation
      await zoomMinInput.fill("800");
      await saveButton.click();
      await expect(alert).toBeVisible({ timeout: 15000 });
      await expect(alert).toContainText(
        "Lightbox minimum zoom cannot be greater than maximum zoom.",
      );
    });

    test("can modify, save, and persist Lightbox settings", async ({
      page,
    }) => {
      const fitModeSelect = page.locator("#lightboxFitMode").first();
      const zoomMinInput = page.locator("#lightboxZoomMin").first();
      const zoomMaxInput = page.locator("#lightboxZoomMax").first();
      const zoomStepInput = page.locator("#lightboxZoomStep").first();
      const autoHideToggleLabel = page
        .locator("label[for='lightboxAutoHideControls']")
        .first();
      const autoHideDelayInput = page.locator("#lightboxAutoHideDelay").first();
      const saveButton = page
        .getByRole("button", { name: "Save Changes" })
        .first();

      await fitModeSelect.selectOption("fitWidth");
      await zoomMinInput.fill("30");
      await zoomMaxInput.fill("600");
      await zoomStepInput.fill("50");
      await autoHideToggleLabel.click();
      await autoHideDelayInput.fill("5");

      await saveButton.click();

      const alert = page.locator("[class*='notification']").first();
      await expect(alert).toBeVisible({ timeout: 15000 });
      await expect(alert).toContainText(
        "Settings saved and updated successfully!",
      );

      // Reload page and verify settings are preserved
      await page.reload();
      await expect(page.getByTestId("loading-skeleton")).toBeHidden();
      await expect(
        page.locator("[data-hydrated='true']").first(),
      ).toBeVisible();

      await expect(page.locator("#lightboxFitMode").first()).toHaveValue(
        "fitWidth",
      );
      await expect(page.locator("#lightboxZoomMin").first()).toHaveValue("30");
      await expect(page.locator("#lightboxZoomMax").first()).toHaveValue("600");
      await expect(page.locator("#lightboxZoomStep").first()).toHaveValue("50");
      expect(
        await page.locator("#lightboxAutoHideControls").first().isChecked(),
      ).toBe(true);
      await expect(page.locator("#lightboxAutoHideDelay").first()).toHaveValue(
        "5",
      );
    });
  });
