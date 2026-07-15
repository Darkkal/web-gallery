import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { setupTestDb } from "../helpers/db";
import { seedTag } from "../helpers/seed";

const testDbHelper = setupTestDb();
let activeDb: ReturnType<typeof setupTestDb>["db"];

vi.mock("@/lib/db", () => {
  return {
    get db() {
      return activeDb;
    },
    initDb: vi.fn(),
  };
});

const testDb = testDbHelper.db;
activeDb = testDb;

import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/tags/children/route";
import { tags } from "@/lib/db/schema";

describe("Tags Children API Endpoint", () => {
  beforeAll(async () => {
    await testDbHelper.runMigrations();
  });

  beforeEach(async () => {
    await testDbHelper.clearDb();
  });

  it("should retrieve children tags and sort them alphabetical by default", async () => {
    const parent = await seedTag(testDb, "parent");
    const childB = await seedTag(testDb, "childB");
    const childA = await seedTag(testDb, "childA");

    // Assign parent
    await testDb
      .update(tags)
      .set({ parentTagId: parent.id })
      .where(eq(tags.id, childB.id));
    await testDb
      .update(tags)
      .set({ parentTagId: parent.id })
      .where(eq(tags.id, childA.id));

    const req = new NextRequest(
      `http://localhost/api/tags/children?parentTagId=${parent.id}`,
    );
    const res = await GET(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.items).toHaveLength(2);
    expect(data.items[0].name).toBe("childA");
    expect(data.items[1].name).toBe("childB");
  });

  it("should sort by child count when sortBy=childCount is active", async () => {
    const parentA = await seedTag(testDb, "parentA");
    const parentB = await seedTag(testDb, "parentB");
    const _parentC = await seedTag(testDb, "parentC");

    const child1 = await seedTag(testDb, "child1");
    const child2 = await seedTag(testDb, "child2");
    const child3 = await seedTag(testDb, "child3");

    // Set parentA children
    await testDb
      .update(tags)
      .set({ parentTagId: parentA.id })
      .where(eq(tags.id, child1.id));
    // Set parentB children
    await testDb
      .update(tags)
      .set({ parentTagId: parentB.id })
      .where(eq(tags.id, child2.id));
    await testDb
      .update(tags)
      .set({ parentTagId: parentB.id })
      .where(eq(tags.id, child3.id));

    const req = new NextRequest(
      "http://localhost/api/tags/children?sortBy=childCount",
    );
    const res = await GET(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    const names = data.items.map((t: { name: string }) => t.name);
    expect(names[0]).toBe("parentB"); // 2 children
    expect(names[1]).toBe("parentA"); // 1 child
    expect(names[2]).toBe("parentC"); // 0 children
  });

  it("should move hierarchies to the top when hierarchiesFirst=true is active", async () => {
    const _parentA = await seedTag(testDb, "parentA");
    const parentB = await seedTag(testDb, "parentB");
    const _parentC = await seedTag(testDb, "parentC");
    const parentD = await seedTag(testDb, "parentD");

    const child1 = await seedTag(testDb, "child1");
    const child2 = await seedTag(testDb, "child2");

    await testDb
      .update(tags)
      .set({ parentTagId: parentB.id })
      .where(eq(tags.id, child1.id));
    await testDb
      .update(tags)
      .set({ parentTagId: parentD.id })
      .where(eq(tags.id, child2.id));

    const req = new NextRequest(
      "http://localhost/api/tags/children?hierarchiesFirst=true",
    );
    const res = await GET(req);
    const data = await res.json();

    const names = data.items.map((t: { name: string }) => t.name);
    expect(names).toEqual(["parentB", "parentD", "parentA", "parentC"]);
  });

  it("should hide orphans when hideOrphans=true is active", async () => {
    const _parentA = await seedTag(testDb, "parentA");
    const parentB = await seedTag(testDb, "parentB");
    const child1 = await seedTag(testDb, "child1");

    await testDb
      .update(tags)
      .set({ parentTagId: parentB.id })
      .where(eq(tags.id, child1.id));

    const req = new NextRequest(
      "http://localhost/api/tags/children?hideOrphans=true",
    );
    const res = await GET(req);
    const data = await res.json();

    const names = data.items.map((t: { name: string }) => t.name);
    expect(names).toEqual(["parentB"]);
  });
});
