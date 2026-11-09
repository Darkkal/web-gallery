import { expect, type Page, test } from "@playwright/test";
import type { TagCategory, TagManageItem } from "../src/types/media";

const category: TagCategory = {
  id: 1,
  name: "character",
  colorHue: 140,
  colorSaturation: 60,
  colorLightness: 50,
  isBuiltin: true,
};
const longName = "longtag".repeat(20);
const longParent = "longparent".repeat(14);
const fixture: TagManageItem[] = Array.from({ length: 55 }, (_, i) => ({
  id: i + 1,
  name: i === 0 ? longName : `example-${String(i + 1).padStart(2, "0")}`,
  category: i === 0 ? category : null,
  postCount: i === 0 ? 12 : 0,
  aliasOfTagId: i === 1 ? 1 : null,
  aliasName: i === 1 ? longName : null,
  parentTagId: i === 0 ? 3 : null,
  parentName: i === 0 ? longParent : null,
}));

async function serveTags(page: Page) {
  const requests: URLSearchParams[] = [];
  await page.route("**/api/tags?*", async (route) => {
    const params = new URL(route.request().url()).searchParams;
    requests.push(params);
    const search = params.get("search") ?? "";
    const filter = params.get("category");
    const matches = fixture.filter(
      (tag) =>
        tag.name.includes(search) &&
        (filter === "all" ||
          (filter === "none" ? !tag.category : tag.category?.name === filter)),
    );
    if (params.get("sortBy") === "name") {
      matches.sort((a, b) => a.name.localeCompare(b.name));
    }
    const start = Number(params.get("cursor"));
    const end = start + Number(params.get("limit"));
    await route.fulfill({
      json: {
        items: matches.slice(start, end),
        nextCursor: end < matches.length ? String(end) : null,
      },
    });
  });
  return requests;
}

const grid = (page: Page) => page.getByRole("button", { name: "Grid View" });
const table = (page: Page) => page.getByRole("button", { name: "List View" });
const cardList = (page: Page) => page.getByRole("list", { name: "Tag cards" });
const tagTable = (page: Page) => page.getByRole("table", { name: "Tag table" });
const selectAll = (page: Page) =>
  page.getByRole("checkbox", { name: "Select all loaded tags" });

async function expectNoPageOverflow(page: Page) {
  const { scrollWidth, width } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    width: window.innerWidth,
  }));
  expect(scrollWidth, `Page width at ${width}px viewport`).toBeLessThanOrEqual(
    width,
  );
}

test("uses the viewport default until a view is chosen", async ({
  page,
}, testInfo) => {
  await serveTags(page);
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto("/tags/manage");
  await expect(
    cardList(page).getByRole("link", { name: longName }),
  ).toBeVisible();

  for (const width of [320, 390, 768, 769, 1280]) {
    await page.setViewportSize({ width, height: 720 });
    const mobile = width <= 768;
    await expect(mobile ? grid(page) : table(page)).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(mobile ? cardList(page) : tagTable(page)).toBeVisible();
    await expect(mobile ? tagTable(page) : cardList(page)).toHaveCount(0);
    await expectNoPageOverflow(page);
  }

  await table(page).focus();
  await page.keyboard.press("Shift+Tab");
  await expect(grid(page)).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(grid(page)).toHaveAttribute("aria-pressed", "true");
  await expect(cardList(page)).toBeVisible();

  await page.setViewportSize({ width: 390, height: 720 });
  await table(page).click();
  await expect(tagTable(page)).toBeVisible();
  await expectNoPageOverflow(page);
  expect(
    await tagTable(page).evaluate((element) => {
      const wrapper = element.parentElement;
      return !!wrapper && wrapper.scrollWidth > wrapper.clientWidth;
    }),
  ).toBe(true);

  await page.reload();
  await expect(grid(page)).toHaveAttribute("aria-pressed", "true");
  const firstCard = cardList(page).getByRole("listitem").first();
  await expect(firstCard.getByRole("link", { name: longName })).toHaveAttribute(
    "href",
    `/gallery?search=${encodeURIComponent(`tag:${longName} `)}`,
  );
  await expect(firstCard.getByText("character")).toBeVisible();
  await expect(firstCard.getByText("Post Count: 12")).toBeVisible();
  await expect(firstCard.getByTitle(`Child of ${longParent}`)).toHaveText(
    longParent,
  );
  for (const button of await firstCard.getByRole("button").all()) {
    const bounds = await button.boundingBox();
    expect(bounds?.width).toBeGreaterThanOrEqual(44);
    expect(bounds?.height).toBeGreaterThanOrEqual(44);
  }

  const alias = cardList(page).getByRole("listitem").nth(1);
  await expect(alias.getByTitle(`Alias of ${longName}`)).toBeVisible();
  await expect(alias.getByText("uncategorized")).toBeVisible();
  for (const name of ["Set Parent", "Manage Related", "Set Category"]) {
    await expect(alias.getByRole("button", { name })).toBeDisabled();
  }

  await page.setViewportSize({ width: 390, height: 940 });
  for (const theme of ["light", "dark"]) {
    await page.evaluate((theme) => localStorage.setItem("theme", theme), theme);
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    await expect(cardList(page)).toBeVisible();
    await expectNoPageOverflow(page);
    if (testInfo.project.name === "chromium-parallel" && theme === "light") {
      await testInfo.attach("phone-card-view", {
        body: await page.screenshot({ animations: "disabled" }),
        contentType: "image/png",
      });
    }
  }

  await page.setViewportSize({ width: 1280, height: 720 });
  await expect(
    tagTable(page).getByRole("link", { name: longName }),
  ).toBeVisible();
  await expect(
    tagTable(page).getByRole("cell", { name: "12", exact: true }),
  ).toBeVisible();
  if (testInfo.project.name === "chromium-parallel") {
    await testInfo.attach("desktop-table-view", {
      body: await page.screenshot({ animations: "disabled" }),
      contentType: "image/png",
    });
  }
});

test("keeps loaded pages and selections when switching views", async ({
  page,
}) => {
  const requests = await serveTags(page);
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto("/tags/manage");
  await expect(cardList(page).getByRole("listitem")).toHaveCount(50);
  await selectAll(page).check();
  await expect(page.getByText("50", { exact: true }).first()).toBeVisible();
  await expectNoPageOverflow(page);
  for (const name of [
    "Merge Selected",
    "Alias Selected",
    "Set Parent",
    "Set Category",
    "Delete Selected",
  ]) {
    await expect(
      page.getByRole("button", { name, exact: true }).first(),
    ).toBeEnabled();
  }

  await cardList(page).getByRole("listitem").last().scrollIntoViewIfNeeded();
  await expect(cardList(page).getByRole("listitem")).toHaveCount(55);
  await expect(selectAll(page)).not.toBeChecked();
  await expect(
    page.getByRole("checkbox", { name: "Select example-55" }),
  ).not.toBeChecked();
  await table(page).click();
  await expect(tagTable(page).getByRole("row")).toHaveCount(56);
  await expect(
    page.getByRole("checkbox", { name: `Select ${longName}` }),
  ).toBeChecked();
  await expect(
    page.getByRole("checkbox", { name: "Select example-55" }),
  ).not.toBeChecked();
  expect(requests.map((params) => params.get("cursor"))).toEqual(["", "50"]);
  await selectAll(page).check();
  await expect(
    page.getByRole("checkbox", { name: "Select example-55" }),
  ).toBeChecked();

  await page
    .getByRole("combobox", { name: "Filter by category" })
    .selectOption("none");
  await expect(
    tagTable(page).getByRole("link", { name: longName }),
  ).toHaveCount(0);
  await expect(page.getByText("tags selected")).toBeHidden();
  await expect(table(page)).toHaveAttribute("aria-pressed", "true");

  const sorted = page.waitForResponse(
    (response) => new URL(response.url()).searchParams.get("sortBy") === "name",
  );
  await page.getByRole("combobox", { name: "Sort tags" }).selectOption("name");
  await sorted;
  const search = page.getByRole("textbox", { name: "Search tags" });
  await search.fill("no-such-tag");
  await expect(page.getByText("No tags matched filters.")).toBeVisible();
  await expect(selectAll(page)).toBeDisabled();
  expect(requests.at(-1)?.get("category")).toBe("none");
  expect(requests.at(-1)?.get("sortBy")).toBe("name");
});

test("both views open the same tag actions and preserve open edits", async ({
  page,
}) => {
  await serveTags(page);
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto("/tags/manage");
  const actions = [
    ["Rename", "Rename Tag"],
    ["Merge into target", "Merge Tags"],
    ["Set Alias", "Set Tag Alias"],
    ["Set Parent", "Set Parent Tag"],
    ["Manage Related", `Related Tags: ${longName}`],
    ["Set Category", "Set Tag Category"],
  ];
  for (const view of ["card", "table"] as const) {
    if (view === "table") await table(page).click();
    const tag = (
      view === "card"
        ? cardList(page).getByRole("listitem")
        : tagTable(page).getByRole("row")
    ).filter({ has: page.getByRole("link", { name: longName }) });
    for (const [button, heading] of actions) {
      await tag.getByRole("button", { name: button, exact: true }).click();
      await expect(page.getByRole("heading", { name: heading })).toBeVisible();
      await expectNoPageOverflow(page);
      await page
        .getByRole("button", {
          name: button === "Manage Related" ? "Done" : "Cancel",
          exact: true,
        })
        .click();
    }
    page.once("dialog", async (dialog) => {
      expect(dialog.message()).toContain(longName);
      await dialog.dismiss();
    });
    await tag.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(tag).toBeVisible();
  }

  await page.reload();
  await cardList(page)
    .getByRole("listitem")
    .first()
    .getByRole("button", { name: "Rename" })
    .click();
  const rename = page.getByRole("textbox", { name: "New Tag Name" });
  await rename.fill("in-progress");
  await page.setViewportSize({ width: 1280, height: 720 });
  await expect(tagTable(page)).toBeVisible();
  await expect(rename).toHaveValue("in-progress");
});
