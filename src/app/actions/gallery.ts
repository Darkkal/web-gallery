"use server";

import { revalidatePath } from "next/cache";
import * as mediaRepo from "@/lib/db/repositories/media";

export async function getMediaItems(filters?: {
  search?: string;
  sortBy?: string;
  limit?: number;
  cursor?: string;
}) {
  return mediaRepo.getMediaItems(filters);
}

export async function deleteMediaItems(ids: number[], deleteFiles: boolean) {
  const result = await mediaRepo.deleteMediaItems(ids, deleteFiles);
  revalidatePath("/gallery");
  revalidatePath("/timeline");
  revalidatePath("/");
  return result;
}

function isHostnameInDomain(hostname: string, domain: string): boolean {
  const normalizedHost = hostname.toLowerCase();
  const normalizedDomain = domain.toLowerCase();
  return (
    normalizedHost === normalizedDomain ||
    normalizedHost.endsWith(`.${normalizedDomain}`)
  );
}

export async function refetchPostData(postIds: number[]) {
  console.log(
    `[GalleryActions] Refetching post data for ${postIds.length} posts`,
  );
  let successCount = 0;
  let deletedCount = 0;

  const { db } = await import("@/lib/db");
  const { posts, sources } = await import("@/lib/db/schema");
  const { eq } = await import("drizzle-orm");
  const { scraperManager } = await import("@/lib/scrapers/manager");
  const { paths } = await import("@/lib/config");

  for (const postId of postIds) {
    try {
      const post = await db.query.posts.findFirst({
        where: eq(posts.id, postId),
      });

      if (!post?.url) {
        console.warn(
          `[GalleryActions] Post ${postId} not found or has no URL, skipping`,
        );
        continue;
      }

      let sourceId = post.internalSourceId;
      if (!sourceId) {
        // Find existing source with the same URL
        const existingSource = await db.query.sources.findFirst({
          where: eq(sources.url, post.url),
        });

        if (existingSource) {
          sourceId = existingSource.id;
        } else {
          // Determine extractor type from url
          let type = "gallery-dl";
          try {
            const parsed = new URL(post.url);
            const hostname = parsed.hostname.toLowerCase();
            if (
              isHostnameInDomain(hostname, "twitter.com") ||
              isHostnameInDomain(hostname, "x.com")
            ) {
              type = "twitter";
            } else if (isHostnameInDomain(hostname, "pixiv.net")) {
              type = "pixiv";
            } else if (
              isHostnameInDomain(hostname, "gelbooru.com") ||
              isHostnameInDomain(hostname, "safebooru.org")
            ) {
              type = "gelbooruv02";
            }
          } catch {}

          const res = await db
            .insert(sources)
            .values({
              url: post.url,
              extractorType: type,
              name: `Refetch: ${post.title || post.url}`,
            })
            .returning({ id: sources.id });
          sourceId = res[0].id;
        }

        // Associate post with source
        await db
          .update(posts)
          .set({ internalSourceId: sourceId })
          .where(eq(posts.id, postId));
      }

      console.log(
        `[GalleryActions] Running scrape for post ${postId} (source ${sourceId}) URL: ${post.url}`,
      );

      const result = await scraperManager.startScrape(
        sourceId,
        "gallery-dl",
        post.url,
        paths.downloads,
        { mode: "quick" },
      );

      if (!result) {
        console.warn(
          `[GalleryActions] Failed to start scrape or scrape already active for post ${postId}`,
        );
        continue;
      }

      const output = result.output || "";
      const errorMsg = result.error || "";
      const fullText = `${output}\n${errorMsg}`.toLowerCase();

      // Check for remote deletion / private / suspension signatures
      const isDeleted =
        fullText.includes("404") ||
        fullText.includes("not found") ||
        fullText.includes("does not exist") ||
        fullText.includes("deleted") ||
        fullText.includes("is not available") ||
        fullText.includes("suspended") ||
        fullText.includes("403") ||
        fullText.includes("410");

      if (isDeleted) {
        console.log(
          `[GalleryActions] Post ${postId} remote source is deleted. Marking.`,
        );
        await db
          .update(posts)
          .set({ isSourceDeleted: true })
          .where(eq(posts.id, postId));
        deletedCount++;
      } else {
        await db
          .update(posts)
          .set({ isSourceDeleted: false })
          .where(eq(posts.id, postId));
        successCount++;
      }
    } catch (err) {
      console.error("[GalleryActions] Failed to refetch post %s:", postId, err);
    }
  }

  revalidatePath("/gallery");
  revalidatePath("/timeline");
  revalidatePath("/");

  return {
    successCount,
    deletedCount,
    totalCount: postIds.length,
  };
}
