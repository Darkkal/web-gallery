import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { createClient } from "@libsql/client";
import { expect, test } from "@playwright/test";

for (const view of ["card", "table"] as const) {
  test(`editing a later tag in ${view} view keeps loaded pages and scroll position`, async ({
    baseURL,
    page,
  }, testInfo) => {
    const dbPath: string | undefined = testInfo.config.metadata.tagsFixtureDb;
    test.skip(
      !dbPath,
      "Set PLAYWRIGHT_TAGS_FIXTURE_DB to the disposable server database",
    );
    if (!dbPath || !baseURL)
      throw new Error("Missing test database or server URL");
    if (
      !["localhost", "127.0.0.1", "[::1]"].includes(new URL(baseURL).hostname)
    ) {
      throw new Error("Tag fixtures require a local disposable server");
    }
    if (!existsSync(dbPath))
      throw new Error(`Test database does not exist: ${dbPath}`);

    const client = createClient({ url: pathToFileURL(dbPath).href });
    const prefix = `e2e-tag-manage-${randomUUID()}-`;
    const names = Array.from(
      { length: 55 },
      (_, i) => `${prefix}${String(i).padStart(2, "0")}`,
    );
    const parent = names[0];
    const child = names[51];
    const renamed = `${child}-renamed`;
    const ownedIds: number[] = [];

    try {
      const inserted = await client.batch(
        names.map((name) => ({
          sql: "INSERT INTO tags (name) VALUES (?) RETURNING id",
          args: [name],
        })),
        "write",
      );
      ownedIds.push(...inserted.map((result) => Number(result.rows[0].id)));

      await page.setViewportSize({
        width: view === "card" ? 390 : 1280,
        height: 720,
      });
      await page.goto("/tags/manage");
      const matching = page.waitForResponse((response) => {
        const url = new URL(response.url());
        return (
          url.pathname === "/api/tags" &&
          url.searchParams.get("search") === prefix
        );
      });
      await page.getByRole("textbox", { name: "Search tags" }).fill(prefix);
      expect((await matching).ok()).toBe(true);
      await page
        .getByRole("combobox", { name: "Sort tags" })
        .selectOption("name");

      const list =
        view === "card"
          ? page.getByRole("list", { name: "Tag cards" })
          : page.getByRole("table", { name: "Tag table" });
      await expect(
        list.getByRole("link", { name: names[49], exact: true }),
      ).toBeVisible();
      await list
        .getByRole("link", { name: names[49], exact: true })
        .scrollIntoViewIfNeeded();
      await expect(list.getByRole("link")).toHaveCount(55);
      const row = list.getByRole(view === "card" ? "listitem" : "row").filter({
        has: page.getByRole("link", { name: child, exact: true }),
      });
      await row.getByRole("button", { name: "Rename", exact: true }).click();
      const beforeRename = await page.evaluate(() => window.scrollY);
      expect(beforeRename).toBeGreaterThan(1000);
      await page.getByRole("textbox", { name: "New Tag Name" }).fill(renamed);
      await page
        .getByRole("button", { name: "Rename", exact: true })
        .last()
        .click();
      const renamedLink = list.getByRole("link", {
        name: renamed,
        exact: true,
      });
      await expect(renamedLink).toBeInViewport();
      await expect(list.getByRole("link")).toHaveCount(55);
      expect(
        Math.abs((await page.evaluate(() => window.scrollY)) - beforeRename),
      ).toBeLessThan(100);

      const renamedRow = list
        .getByRole(view === "card" ? "listitem" : "row")
        .filter({
          has: page.getByRole("link", { name: renamed, exact: true }),
        });
      await renamedRow
        .getByRole("button", { name: "Set Parent", exact: true })
        .click();
      const beforeRelationship = await page.evaluate(() => window.scrollY);
      await page
        .getByRole("textbox", { name: "Parent Tag (autocomplete or type new)" })
        .fill(parent);
      const refresh = page.waitForResponse((response) => {
        const url = new URL(response.url());
        return (
          url.pathname === "/api/tags" &&
          url.searchParams.get("search") === prefix &&
          url.searchParams.get("cursor") === "" &&
          url.searchParams.get("limit") === "55"
        );
      });

      const pendingRequest = Promise.withResolvers<void>();
      const release = Promise.withResolvers<void>();
      await page.route("**/tags/manage", async (route) => {
        if (route.request().method() === "POST") {
          pendingRequest.resolve();
          await release.promise;
        }
        await route.continue();
      });
      try {
        await page
          .getByRole("button", { name: "Set Parent", exact: true })
          .last()
          .click();
        await pendingRequest.promise;
        await expect(
          renamedRow.getByRole("button", { name: "Rename" }),
        ).toBeDisabled();
        await expect(
          renamedRow.getByRole("button", { name: "Delete" }),
        ).toBeDisabled();
      } finally {
        release.resolve();
      }

      expect((await refresh).ok()).toBe(true);
      await expect(renamedRow.getByTitle(`Child of ${parent}`)).toBeVisible();
      await expect(renamedLink).toBeInViewport();
      await expect(list.getByRole("link")).toHaveCount(55);
      expect(
        Math.abs(
          (await page.evaluate(() => window.scrollY)) - beforeRelationship,
        ),
      ).toBeLessThan(100);

      const persisted = await client.execute({
        sql: "SELECT name, parent_tag_id FROM tags WHERE id = ?",
        args: [ownedIds[51]],
      });
      expect(persisted.rows[0].name).toBe(renamed);
      expect(persisted.rows[0].parent_tag_id).toBe(ownedIds[0]);
    } finally {
      try {
        if (ownedIds.length) {
          await client.execute({
            sql: `DELETE FROM tags WHERE id IN (${ownedIds.map(() => "?").join(", ")})`,
            args: ownedIds,
          });
        }
      } finally {
        client.close();
      }
    }
  });
}
