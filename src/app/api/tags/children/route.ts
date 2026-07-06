import { and, asc, eq, gt, isNull, sql } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { postTags, tagCategories, tags } from "@/lib/db/schema";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const parentIdStr = searchParams.get("parentTagId");
  const limitStr = searchParams.get("limit");
  const category = searchParams.get("category") || "all";
  const cursor = searchParams.get("cursor") || undefined;

  try {
    const parentTagId =
      parentIdStr && parentIdStr !== "null" ? parseInt(parentIdStr, 10) : null;
    const limit = limitStr ? parseInt(limitStr, 10) : 100;

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

    // Apply cursor pagination for top-level tags
    if (!parentTagId && cursor) {
      whereCond = and(whereCond, gt(tags.name, cursor));
    }

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
        hasChildren:
          sql<boolean>`EXISTS (SELECT 1 FROM ${tags} c WHERE c.parent_tag_id = ${tags.id})`.mapWith(
            Boolean,
          ),
      })
      .from(tags)
      .leftJoin(tagCategories, eq(tags.categoryId, tagCategories.id))
      .where(whereCond)
      .orderBy(asc(tags.name));

    // Limit only top-level queries to support pagination
    if (!parentTagId) {
      query.limit(limit);
    }

    const results = await query;

    let nextCursor: string | null = null;
    if (!parentTagId && results.length === limit) {
      nextCursor = results[results.length - 1].name;
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
