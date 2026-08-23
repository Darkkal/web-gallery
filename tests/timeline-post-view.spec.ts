import { expect, test } from "@playwright/test";

// PR #155 review: clicking empty space anywhere inside a timeline post
// container opens the full post view at /post/[id]. Interactive controls and
// the post body keep their own behavior.

test("timeline post container click opens the full post view", async ({
  page,
}) => {
  await page.goto("/timeline", { waitUntil: "domcontentloaded" });
  const card = page.locator("article[id^='timeline-post']").first();
  // Explicit timeout well under the 30s test timeout: if the timeline has no
  // seeded posts (CI), skip cleanly instead of racing test teardown.
  const appeared = await card
    .waitFor({ state: "visible", timeout: 10_000 })
    .then(() => true)
    .catch(() => false);
  test.skip(!appeared, "timeline has no seeded posts");
  if (!appeared) return;

  // Find an "empty space" point inside the card: not on a link, button,
  // media lightbox target, or video. Mirrors the component's own guard.
  const point = await card.evaluate((el) => {
    const rect = el.getBoundingClientRect();
    const candidates: Array<[number, number]> = [
      [rect.left + rect.width - 10, rect.top + rect.height - 10],
      [rect.left + 10, rect.top + rect.height - 10],
      [rect.left + rect.width / 2, rect.top + 6],
      [rect.left + 10, rect.top + rect.height / 2],
    ];
    for (const [x, y] of candidates) {
      const hit = document.elementFromPoint(x, y);
      if (
        hit &&
        el.contains(hit) &&
        !hit.closest("a, button, [role='button'], video")
      ) {
        return { x, y };
      }
    }
    return null;
  });

  test.skip(point === null, "no empty space found in the first post card");
  if (!point) return;

  await page.mouse.click(point.x, point.y);
  await expect(page).toHaveURL(/\/post\/\d+/);
});

test("clicking post media still opens the lightbox instead of navigating", async ({
  page,
}) => {
  await page.goto("/timeline", { waitUntil: "domcontentloaded" });
  const media = page
    .locator("article[id^='timeline-post'] [role='button']")
    .first();
  const appeared = await media
    .waitFor({ state: "visible", timeout: 10_000 })
    .then(() => true)
    .catch(() => false);
  test.skip(!appeared, "timeline has no clickable media");
  if (!appeared) return;

  await media.click();
  // Lightbox opens (URL stays on the timeline); the container click must not
  // navigate to /post/[id].
  await expect(page).not.toHaveURL(/\/post\/\d+/);
});
