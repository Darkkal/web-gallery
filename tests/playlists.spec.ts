import { expect, test } from "@playwright/test";

test.describe("Playlists feature E2E tests", () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  test("playlists page loads and displays empty state/playlists", async ({
    page,
  }) => {
    await page.goto("/playlists");
    await expect(page).toHaveURL(/.*\/playlists/);

    // Check page header
    await expect(
      page.getByRole("heading", { name: "Playlists", exact: true }),
    ).toBeVisible();

    // Check if the "Create Playlist" button is visible
    await expect(
      page.getByRole("button", { name: "Create Playlist" }),
    ).toBeVisible();
  });

  test("create, edit, and delete a playlist", async ({ page }) => {
    // 1. Load playlists page
    await page.goto("/playlists");

    // 2. Click on "Create Playlist"
    await page.getByRole("button", { name: "Create Playlist" }).click();

    // Check modal title is visible
    await expect(
      page.getByRole("heading", { name: "Create Playlist" }),
    ).toBeVisible();

    // Fill in playlist name and description
    const uniquePlaylistName = `E2E Test Playlist - ${Date.now()}`;
    await page.locator("#playlist-name").fill(uniquePlaylistName);
    await page
      .locator("#playlist-desc")
      .fill("Created by Playwright E2E automation");

    // Save
    await page.getByRole("button", { name: "Save" }).click();

    // Verify modal is closed and new playlist is listed in the grid
    await expect(
      page.getByRole("heading", { name: "Create Playlist" }),
    ).toBeHidden();
    await expect(page.getByText(uniquePlaylistName)).toBeVisible();

    // 3. Edit the newly created playlist
    // Hover over the playlist card to reveal action controls or select edit button directly
    // Let's search for the edit button within the card or locator
    const playlistCard = page
      .locator('div[class*="playlistCard"]')
      .filter({ hasText: uniquePlaylistName });
    await expect(playlistCard).toBeVisible();

    const editBtn = playlistCard.getByRole("button", { name: "Edit" });
    // Trigger edit
    await editBtn.click();

    // Verify modal loads initial values
    await expect(
      page.getByRole("heading", { name: "Edit Playlist Details" }),
    ).toBeVisible();
    await expect(page.locator("#playlist-name")).toHaveValue(
      uniquePlaylistName,
    );

    // Update name
    const updatedName = `${uniquePlaylistName} (Edited)`;
    await page.locator("#playlist-name").fill(updatedName);

    // Submit
    await page.getByRole("button", { name: "Save" }).click();

    // Verify update
    await expect(page.getByText(updatedName)).toBeVisible();

    // 4. Delete the playlist
    // Set up confirm dialog handler (Playwright automatically accepts or we can mock/dismiss/accept)
    page.once("dialog", async (dialog) => {
      expect(dialog.message()).toContain("delete the playlist");
      await dialog.accept();
    });

    const updatedCard = page
      .locator('div[class*="playlistCard"]')
      .filter({ hasText: updatedName });
    await updatedCard.getByRole("button", { name: "Delete" }).click();

    // Verify it is removed
    await expect(page.getByText(updatedName)).toBeHidden();
  });
});
