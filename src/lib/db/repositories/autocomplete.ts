import { and, eq, isNull, like, notInArray, type SQL, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  pixivUsers,
  posts,
  postTags,
  sources,
  tags,
  twitterUsers,
} from "@/lib/db/schema";
import { parseSearchQuery } from "@/lib/utils/search-parser";
import type { AutocompleteSuggestion } from "@/types/autocomplete";

export async function autocompleteTag(
  prefix: string,
  limit: number = 8,
  context?: string,
): Promise<AutocompleteSuggestion[]> {
  const existingTags = context
    ? Array.from(context.matchAll(/\btag:(\S+)/gi)).map((m) => m[1])
    : [];

  const whereConditions: SQL[] = [like(tags.name, `${prefix}%`)];
  if (existingTags.length > 0) {
    const lowerTags = existingTags.map((t) => t.toLowerCase());
    whereConditions.push(notInArray(sql`lower(${tags.name})`, lowerTags));
  }

  // If there's a context, let's find posts matching it
  // biome-ignore lint/suspicious/noExplicitAny: Drizzle dynamic query typing requires any for reassignment
  let postsFilterSubquery: any = null;
  if (context) {
    const { cleanQuery, sourceFilter } = parseSearchQuery(context);
    const searchLower = cleanQuery.trim().toLowerCase();

    if (searchLower || sourceFilter) {
      const postWhereConditions: SQL[] = [isNull(posts.deletedAt)];
      if (sourceFilter) {
        postWhereConditions.push(eq(posts.extractorType, sourceFilter));
      }

      let q = db
        .select({
          id: posts.id,
        })
        .from(posts)
        .$dynamic();

      if (searchLower) {
        const ftsSub = db
          .select({
            search_id: sql<number>`rowid`.as("search_id"),
          })
          .from(sql`posts_fts`)
          .where(sql`posts_fts MATCH ${searchLower}`)
          .as("fts_sub");

        q = q.innerJoin(ftsSub, eq(posts.id, ftsSub.search_id));
      }

      postsFilterSubquery = q
        .where(and(...postWhereConditions))
        .as("posts_filter_subquery");
    }
  }

  let query = db
    .select({
      name: tags.name,
      count: sql<number>`count(${postTags.postId})`.mapWith(Number),
    })
    .from(tags)
    .$dynamic();

  if (postsFilterSubquery) {
    query = query
      .innerJoin(postTags, eq(tags.id, postTags.tagId))
      .innerJoin(
        postsFilterSubquery,
        eq(postTags.postId, postsFilterSubquery.id),
      );
  } else {
    query = query.leftJoin(postTags, eq(tags.id, postTags.tagId));
  }

  const results = await query
    .where(and(...whereConditions))
    .groupBy(tags.name)
    .orderBy(sql`count(${postTags.postId}) DESC`)
    .limit(limit);

  return results.map((r) => ({
    value: r.name,
    label: r.name,
    count: r.count,
    type: "value" as const,
  }));
}

export async function autocompleteUser(
  prefix: string,
  limit: number = 8,
): Promise<AutocompleteSuggestion[]> {
  const [twitterRes, pixivRes] = await Promise.all([
    db
      .select({
        name: twitterUsers.name,
        handle: twitterUsers.nick,
      })
      .from(twitterUsers)
      .where(like(twitterUsers.name, `${prefix}%`))
      .limit(limit),
    db
      .select({
        name: pixivUsers.name,
        account: pixivUsers.account,
      })
      .from(pixivUsers)
      .where(like(pixivUsers.name, `${prefix}%`))
      .limit(limit),
  ]);

  const merged = [
    ...twitterRes.map((u) => ({
      value: u.name || "",
      label: u.name || "",
      description: u.handle ? `@${u.handle}` : undefined,
      type: "value" as const,
    })),
    ...pixivRes.map((u) => ({
      value: u.name || "",
      label: u.name || "",
      description: u.account ? `@${u.account}` : undefined,
      type: "value" as const,
    })),
  ].filter((u) => u.value !== "");

  // Remove duplicates by value
  const unique = Array.from(
    new Map(merged.map((item) => [item.value, item])).values(),
  );
  return unique.slice(0, limit);
}

export async function autocompleteHandle(
  prefix: string,
  limit: number = 8,
): Promise<AutocompleteSuggestion[]> {
  // Handles usually typed with or without '@' - strip '@' if present
  const cleanPrefix = prefix.startsWith("@") ? prefix.slice(1) : prefix;

  const [twitterRes, pixivRes] = await Promise.all([
    db
      .select({
        name: twitterUsers.name,
        handle: twitterUsers.nick,
      })
      .from(twitterUsers)
      .where(like(twitterUsers.nick, `${cleanPrefix}%`))
      .limit(limit),
    db
      .select({
        name: pixivUsers.name,
        account: pixivUsers.account,
      })
      .from(pixivUsers)
      .where(like(pixivUsers.account, `${cleanPrefix}%`))
      .limit(limit),
  ]);

  const merged = [
    ...twitterRes.map((u) => ({
      value: u.handle || "",
      label: `@${u.handle}`,
      description: u.name || undefined,
      type: "value" as const,
    })),
    ...pixivRes.map((u) => ({
      value: u.account || "",
      label: `@${u.account}`,
      description: u.name || undefined,
      type: "value" as const,
    })),
  ].filter((u) => u.value !== "");

  const unique = Array.from(
    new Map(merged.map((item) => [item.value, item])).values(),
  );
  return unique.slice(0, limit);
}

export async function autocompleteSourceName(
  prefix: string,
  limit: number = 8,
): Promise<AutocompleteSuggestion[]> {
  const results = await db
    .select({
      name: sources.name,
    })
    .from(sources)
    .where(and(like(sources.name, `${prefix}%`), isNull(sources.deletedAt)))
    .limit(limit);

  const filtered = results.filter((r) => r.name !== null && r.name !== "");

  return filtered.map((r) => ({
    value: r.name as string,
    label: r.name as string,
    type: "value" as const,
  }));
}

export async function autocompleteTitle(
  prefix: string,
  limit: number = 8,
): Promise<AutocompleteSuggestion[]> {
  const results = await db
    .select({
      title: posts.title,
    })
    .from(posts)
    .where(and(like(posts.title, `${prefix}%`), isNull(posts.deletedAt)))
    .limit(limit);

  const filtered = results.filter((r) => r.title !== null && r.title !== "");
  const unique = Array.from(new Set(filtered.map((r) => r.title as string)));

  return unique.slice(0, limit).map((t) => ({
    value: t,
    label: t,
    type: "value" as const,
  }));
}

export async function autocompleteContent(
  prefix: string,
  limit: number = 8,
): Promise<AutocompleteSuggestion[]> {
  const results = await db
    .select({
      content: posts.content,
    })
    .from(posts)
    .where(and(like(posts.content, `${prefix}%`), isNull(posts.deletedAt)))
    .limit(limit);

  const filtered = results.filter(
    (r) => r.content !== null && r.content !== "",
  );
  const unique = Array.from(new Set(filtered.map((r) => r.content as string)));

  return unique.slice(0, limit).map((c) => {
    // Truncate long content for list item display
    const label = c.length > 50 ? `${c.slice(0, 50)}...` : c;
    return {
      value: c,
      label,
      type: "value" as const,
    };
  });
}
