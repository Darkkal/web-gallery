import { expect, test } from "@playwright/test";

test.describe("statistics navigation to gallery search", () => {
  test("clicking statistics card links redirects to filtered gallery search", async ({
    page,
  }) => {
    await page.goto("/statistics");

    // Wait for the loading skeletons to disappear
    const skeleton = page.getByTestId("loading-skeleton");
    if ((await skeleton.count()) > 0) {
      await expect(skeleton.first()).toBeHidden();
    }

    // Check if there are any ranking cards visible
    const rankingCards = page.locator('div[class*="rankingCard"]');
    const rankingCardCount = await rankingCards.count();

    if (rankingCardCount === 0) {
      // If there is no data (e.g. clean test database), skip the interactive click tests
      test.skip(
        true,
        "No ranking cards found in statistics - skipping click navigation tests",
      );
      return;
    }

    // Find the first entity link (main header/name of a card)
    const entityLink = page.locator('a[class*="entityLink"]').first();
    await expect(entityLink).toBeVisible();

    const entityHref = await entityLink.getAttribute("href");
    expect(entityHref).toContain("/gallery?search=");

    // Click the entity link and check redirection
    await entityLink.click();
    await expect(page).toHaveURL(/.*\/gallery\?search=.+/);

    // Go back to statistics
    await page.goto("/statistics");

    // Check if there are any associated items links in the footers
    const associationLink = page.locator('a[class*="associationLink"]').first();
    if ((await associationLink.count()) > 0) {
      await expect(associationLink).toBeVisible();
      const assocHref = await associationLink.getAttribute("href");
      expect(assocHref).toContain("/gallery?search=");

      // Click the association link and check redirection
      await associationLink.click();
      await expect(page).toHaveURL(/.*\/gallery\?search=.+/);
    }
  });
});
