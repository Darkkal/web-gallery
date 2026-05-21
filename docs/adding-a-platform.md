# Adding a New Platform

This guide walks through adding support for a new scraping platform — for example,
Bluesky, Mastodon, or any site that `gallery-dl` can download from.

The library scanner uses a **Strategy + Factory** pattern: each platform has a
dedicated processor class that extracts metadata from the JSON files that
`gallery-dl` deposits alongside the downloaded media. Adding a platform means
implementing one new file and registering it in a few places. No existing processors
or base classes need to change.

---

## Prerequisites

- The platform must be downloadable by `gallery-dl` (check the
  [supported sites list](https://github.com/mikf/gallery-dl/blob/master/docs/supportedsites.md)).
- `gallery-dl` must output a `.json` sidecar file alongside each downloaded file
  (enabled via `--write-metadata` in the config).

---

## Overview of touch points

| File | What changes |
|------|-------------|
| `src/lib/library/processors/<platform>.ts` | **New file** — metadata processor class |
| `src/lib/library/processors/factory.ts` | Register the new processor |
| `src/lib/library/scanner.ts` | Seed the new extractor type + detection logic |
| `src/lib/db/schema.ts` | *(Optional)* New platform-specific detail table |
| `drizzle/` | *(Optional)* New migration if schema changed |
| `src/lib/utils/search-parser.ts` | *(Optional)* New FTS5 column aliases |

---

## Step 1 — Create the metadata processor

Create `src/lib/library/processors/<platform>.ts`. The processor must implement
`IMetadataProcessor` from `@/lib/library/processors/base`.

```ts
// src/lib/library/processors/bluesky.ts
import { posts } from "@/lib/db/schema";
import type { IMetadataProcessor } from "@/lib/library/processors/base";
import type { ProcessorContext, ProcessTask } from "@/lib/library/types";

// Type the metadata fields gallery-dl produces for this platform.
// Check the JSON sidecar files for the actual field names.
interface BlueskyMeta {
  post_id?: string;
  user?: { did?: string; handle?: string; display_name?: string };
  created_at?: string;
  text?: string;
  uri?: string;
}

export class BlueskyProcessor implements IMetadataProcessor<BlueskyMeta> {
  async process(
    meta: BlueskyMeta,
    task: ProcessTask,
    context: ProcessorContext,
  ): Promise<number | null> {
    const { tx, existingPosts, internalSourceId } = context;

    const postId = meta.post_id ? String(meta.post_id) : null;
    if (!postId) return null;

    const key = `bluesky:${postId}`;
    if (existingPosts.has(key)) {
      return existingPosts.get(key) ?? null;
    }

    const inserted = await tx
      .insert(posts)
      .values({
        extractorType: "bluesky",
        jsonSourceId: postId,
        internalSourceId,
        userId: meta.user?.did ?? null,
        date: meta.created_at ?? null,
        title: meta.user?.display_name ?? meta.user?.handle ?? null,
        content: meta.text ?? null,
        url: meta.uri ?? null,
        metadataPath: task.jsonPath ?? null,
      })
      .returning({ id: posts.id });

    const newId = inserted[0]?.id ?? null;
    if (newId !== null) existingPosts.set(key, newId);

    // If you need a platform-specific detail table, insert it here.
    // See twitter.ts (postDetailsTwitter) or pixiv.ts (postDetailsPixiv)
    // for reference.

    return newId;
  }
}
```

**Tips:**
- Use `onConflictDoNothing()` or `onConflictDoUpdate()` if the platform might
  produce duplicate entries across multiple scrapes.
- If you need to cache and upsert a user record (like `twitterUsers`), follow
  the pattern in `twitter.ts`: check the `UserCache`, insert with
  `onConflictDoUpdate`, then add the ID to the cache.
- Keep all DB writes inside `context.tx` — the scanner wraps each batch in a
  single transaction for atomicity.

---

## Step 2 — Register in the factory

Open `src/lib/library/processors/factory.ts` and add a case:

```ts
import { BlueskyProcessor } from "@/lib/library/processors/bluesky"; // add

export const MetadataProcessorFactory = {
  getProcessor(extractorType: string): IMetadataProcessor | null {
    switch (extractorType) {
      case "twitter":
        return new TwitterProcessor();
      case "pixiv":
        return new PixivProcessor();
      case "gelbooruv02":
        return new GelbooruProcessor();
      case "bluesky":                  // add
        return new BlueskyProcessor(); // add
      default:
        return null;
    }
  },
};
```

---

## Step 3 — Seed the extractor type + add detection logic

The scanner needs two things:

**3a. Seed the `gallerydl_extractor_types` table** so Sources can be tagged with
the new platform. In `src/lib/library/scanner.ts`, find the `db.insert(gallerydlExtractorTypes)` call and add your platform:

```ts
await db
  .insert(gallerydlExtractorTypes)
  .values([
    { id: "twitter",    description: "Twitter/X" },
    { id: "pixiv",      description: "Pixiv" },
    { id: "gelbooruv02", description: "Gelbooru/Safebooru" },
    { id: "gallery-dl", description: "Generic gallery-dl" },
    { id: "bluesky",    description: "Bluesky" }, // add
  ])
  .onConflictDoNothing();
```

**3b. Add detection logic** in the `processItem` function in the same file. Find
the block that checks `meta.category` / `meta.extractor` and add your platform:

```ts
if (meta.category === "twitter" || meta.extractor === "twitter" || meta.tweet_id)
  extractorType = "twitter";
else if (meta.category === "pixiv" || meta.extractor === "pixiv")
  extractorType = "pixiv";
else if (/* gelbooru checks */)
  extractorType = "gelbooruv02";
else if (meta.category === "bluesky" || meta.extractor === "bluesky") // add
  extractorType = "bluesky";                                           // add
```

> [!TIP]
> Inspect the actual `.json` sidecar files that `gallery-dl` produces for your
> platform to find the right field names for detection. The `category` and
> `extractor` fields are the most reliable.

---

## Step 4 — (Optional) Add a platform-specific detail table

If the platform has metadata beyond what the generic `posts` table holds
(engagement counts, content ratings, dimensions, etc.), add a detail table.

**4a. Add the table to the schema** (`src/lib/db/schema.ts`):

```ts
export const postDetailsBluesky = sqliteTable("post_details_bluesky", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  postId: integer("post_id")
    .references(() => posts.id, { onDelete: "cascade" })
    .notNull(),
  replyCount: integer("reply_count"),
  repostCount: integer("repost_count"),
  likeCount: integer("like_count"),
});

// Add to postsRelations:
export const postsRelations = relations(posts, ({ one, many }) => ({
  // ... existing relations ...
  blueskyDetails: one(postDetailsBluesky, {
    fields: [posts.id],
    references: [postDetailsBluesky.postId],
  }),
}));
```

**4b. Generate and apply the migration:**

```bash
npm run db:generate   # writes a new SQL file to drizzle/
npm run db:migrate    # applies it to sqlite.db
```

**4c. Insert the detail row inside your processor's `process()` method** (after
inserting the parent `posts` row):

```ts
await tx.insert(postDetailsBluesky).values({
  postId: newId,
  replyCount: meta.reply_count ?? null,
  repostCount: meta.repost_count ?? null,
  likeCount: meta.like_count ?? null,
});
```

---

## Step 5 — (Optional) Add FTS5 search column aliases

If your detail table introduces new columns that users should be able to search
by prefix (e.g. `like_count:`, `handle:`), register them in
`src/lib/utils/search-parser.ts`:

```ts
const ftsColumnAliases: Record<string, string> = {
  // ... existing aliases ...
  handle:       "user_handle",  // add if your FTS5 view exposes this column
};
```

> [!IMPORTANT]
> The `ftsColumnAliases` map doubles as the **allowlist** for valid FTS5 column
> filters. Any unrecognized `prefix:` in a search query is silently stripped to
> prevent SQLite parse errors. Only add columns that actually exist in the FTS5
> virtual table.

---

## Checklist

- [ ] `src/lib/library/processors/<platform>.ts` — implements `IMetadataProcessor`
- [ ] `factory.ts` — new `case` added
- [ ] `scanner.ts` — extractor type seeded + detection condition added
- [ ] *(if needed)* `schema.ts` — detail table added + relations updated
- [ ] *(if needed)* `npm run db:generate && npm run db:migrate` — migration applied
- [ ] *(if needed)* `search-parser.ts` — FTS5 column aliases updated

---

## Reference implementations

| Platform | Processor | Detail table |
|----------|-----------|-------------|
| Twitter/X | [`processors/twitter.ts`](../src/lib/library/processors/twitter.ts) | `post_details_twitter` |
| Pixiv | [`processors/pixiv.ts`](../src/lib/library/processors/pixiv.ts) | `post_details_pixiv` |
| Gelbooru/Safebooru | [`processors/gelbooru.ts`](../src/lib/library/processors/gelbooru.ts) | `post_details_gelbooruv02` |
