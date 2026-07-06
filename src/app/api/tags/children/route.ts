import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { postTags, tagCategories, tags } from "@/lib/db/schema";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const parentIdStr = searchParams.get("parentTagId");
  const limitStr = searchParams.get("limit");
  const category = searchParams.get("category") || "all";
  const cursor = searchParams.get("cursor") || undefined;

  // Sorting and filtering parameters
  const sortBy = searchParams.get("sortBy") || "name"; // "name" or "childCount"
  const hierarchiesFirst = searchParams.get("hierarchiesFirst") || "false"; // "true" or "false"
  const hideOrphans = searchParams.get("hideOrphans") || "false"; // "true" or "false"

  try {
    const parentTagId =
      parentIdStr && parentIdStr !== "null" ? parseInt(parentIdStr, 10) : null;
    const limit = limitStr ? parseInt(limitStr, 10) : 100;

    let offset = 0;
    if (!parentTagId && cursor && !Number.isNaN(parseInt(cursor, 10))) {
      offset = parseInt(cursor, 10);
    }

    let whereCond = and(
      parentTagId
        ? eq(tags.parentTagId, parentTagId)
        : isNull(tags.parentTagId),
      isNull(tags.aliasOfTagId),
    );

    if (category !== "all") {
      if (category === "none" || category === "uncategorized") {
        whereCond = and(whereCond, isNull(tags.categoryId));
      } else {
        whereCond = and(whereCond, eq(tagCategories.name, category));
      }
    }

    // Hide orphans (tags without children) when querying top-level tags
    if (!parentTagId && hideOrphans === "true") {
      whereCond = and(
        whereCond,
        sql`(SELECT count(*) FROM ${tags} c WHERE c.parent_tag_id = ${tags.id}) > 0`,
      );
    }

    // Determine order by list
    const orderByList = [];
    if (hierarchiesFirst === "true") {
      orderByList.push(
        sql`CASE WHEN (SELECT count(*) FROM ${tags} c WHERE c.parent_tag_id = ${tags.id}) > 0 THEN 0 ELSE 1 END ASC`,
      );
    }
    if (sortBy === "childCount") {
      orderByList.push(
        desc(
          sql`(SELECT count(*) FROM ${tags} c WHERE c.parent_tag_id = ${tags.id})`,
        ),
      );
    }
    orderByList.push(asc(tags.name));

    const query = db
      .select({
        id: tags.id,
        name: tags.name,
        parentTagId: tags.parentTagId,
        categoryId: tags.categoryId,
        category: {
          id: tagCategories.id,
          name: tagCategories.name,
          colorHue: tagCategories.colorHue,
          colorSaturation: tagCategories.colorSaturation,
          colorLightness: tagCategories.colorLightness,
          isBuiltin: tagCategories.isBuiltin,
        },
        postCount:
          sql<number>`(SELECT count(*) FROM ${postTags} WHERE ${postTags.tagId} = ${tags.id})`.mapWith(
            Number,
          ),
        childCount:
          sql<number>`(SELECT count(*) FROM ${tags} c WHERE c.parent_tag_id = ${tags.id})`.mapWith(
            Number,
          ),
        hasChildren:
          sql<boolean>`EXISTS (SELECT 1 FROM ${tags} c WHERE c.parent_tag_id = ${tags.id})`.mapWith(
            Boolean,
          ),
      })
      .from(tags)
      .leftJoin(tagCategories, eq(tags.categoryId, tagCategories.id))
      .where(whereCond)
      .orderBy(...orderByList);

    // Limit only top-level queries to support pagination
    if (!parentTagId) {
      query.limit(limit).offset(offset);
    }

    const results = await query;

    let nextCursor: string | null = null;
    if (!parentTagId && results.length === limit) {
      nextCursor = (offset + limit).toString();
    }

    return NextResponse.json({
      items: results,
      nextCursor,
    });
  } catch (err) {
    console.error("[API Tags Children GET Error]", err);
    return NextResponse.json(
      { error: "Failed to fetch tags children" },
      { status: 500 },
    );
  }
}
