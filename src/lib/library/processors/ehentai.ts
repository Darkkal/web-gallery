import path from "node:path";
import { eq } from "drizzle-orm";
import { paths } from "@/lib/config";
import { postDetailsEHentai, posts, postTags, tags } from "@/lib/db/schema";
import type { IMetadataProcessor } from "@/lib/library/processors/base";
import type { ProcessorContext, ProcessTask } from "@/lib/library/types";

export interface EHentaiMeta {
  gid?: number;
  token?: string;
  title?: string;
  title_jpn?: string;
  eh_category?: string;
  uploader?: string;
  date?: string;
  parent?: string;
  expunged?: boolean;
  language?: string;
  filesize?: number;
  filecount?: string | number;
  favorites?: string | number;
  rating?: string | number;
  torrentcount?: string | number;
  lang?: string;
  tags?: string[];
  category?: string;
  subcategory?: string;
}

export class EHentaiProcessor implements IMetadataProcessor<EHentaiMeta> {
  private extractorType: string;

  constructor(extractorType: string) {
    this.extractorType = extractorType;
  }

  async process(
    meta: EHentaiMeta,
    task: ProcessTask,
    context: ProcessorContext,
  ): Promise<number | null> {
    const { tx, existingPosts, existingTags, internalSourceId } = context;

    let postId: number | null = null;

    const gid = meta.gid ? String(meta.gid) : null;
    if (!gid) {
      console.warn("[EHentaiProcessor] Missing gid in metadata");
      return null;
    }

    const key = `${this.extractorType}:${gid}`;

    if (!existingPosts.has(key)) {
      // Create a new post record
      const inserted = await tx
        .insert(posts)
        .values({
          extractorType: this.extractorType,
          jsonSourceId: gid,
          internalSourceId: internalSourceId,
          userId: meta.uploader || null,
          date: meta.date || null,
          title: meta.title_jpn || meta.title || null,
          content: meta.title || meta.title_jpn || null,
          url:
            this.extractorType === "exhentai"
              ? `https://exhentai.org/g/${gid}/${meta.token || ""}`
              : `https://e-hentai.org/g/${gid}/${meta.token || ""}`,
          metadataPath: task.jsonPath
            ? path
                .relative(path.dirname(paths.downloads), task.jsonPath)
                .split(path.sep)
                .join("/")
            : null,
          createdAt: new Date(),
        })
        .returning({ id: posts.id });

      postId = inserted[0]?.id ?? null;
      if (postId === null) {
        console.warn(
          `[EHentaiProcessor] Failed to insert post for gid: ${gid}`,
        );
        return null;
      }
      existingPosts.set(key, postId);

      // Insert detail table record
      await tx.insert(postDetailsEHentai).values({
        postId: postId,
        gid: meta.gid ? Number(meta.gid) : null,
        token: meta.token || null,
        ehCategory: meta.eh_category || null,
        uploader: meta.uploader || null,
        language: meta.language || null,
        filecount: meta.filecount ? Number(meta.filecount) : null,
        rating: meta.rating ? String(meta.rating) : null,
        torrentcount: meta.torrentcount ? Number(meta.torrentcount) : null,
      });
    } else {
      postId = existingPosts.get(key) || null;
      if (postId) {
        // Update existing post
        const updateSet: Record<string, unknown> = {
          date: meta.date || null,
          title: meta.title_jpn || meta.title || null,
          content: meta.title || meta.title_jpn || null,
          url:
            this.extractorType === "exhentai"
              ? `https://exhentai.org/g/${gid}/${meta.token || ""}`
              : `https://e-hentai.org/g/${gid}/${meta.token || ""}`,
        };
        if (internalSourceId) {
          updateSet.internalSourceId = internalSourceId;
        }
        if (task.jsonPath) {
          updateSet.metadataPath = path
            .relative(path.dirname(paths.downloads), task.jsonPath)
            .split(path.sep)
            .join("/");
        }
        await tx.update(posts).set(updateSet).where(eq(posts.id, postId));

        // Update detail table record
        await tx
          .update(postDetailsEHentai)
          .set({
            gid: meta.gid ? Number(meta.gid) : null,
            token: meta.token || null,
            ehCategory: meta.eh_category || null,
            uploader: meta.uploader || null,
            language: meta.language || null,
            filecount: meta.filecount ? Number(meta.filecount) : null,
            rating: meta.rating ? String(meta.rating) : null,
            torrentcount: meta.torrentcount ? Number(meta.torrentcount) : null,
          })
          .where(eq(postDetailsEHentai.postId, postId));
      }
    }

    // Process Tags
    if (postId && meta.tags && Array.isArray(meta.tags)) {
      for (const rawTag of meta.tags) {
        if (!rawTag) continue;
        const tagName = rawTag.trim();
        let tagId = existingTags.get(tagName);

        if (!tagId) {
          const newTag = await tx
            .insert(tags)
            .values({ name: tagName })
            .onConflictDoNothing()
            .returning({ id: tags.id });
          if (newTag.length > 0) tagId = newTag[0].id;
          else {
            const e = await tx
              .select({ id: tags.id })
              .from(tags)
              .where(eq(tags.name, tagName));
            if (e.length > 0) tagId = e[0].id;
          }
          if (tagId) existingTags.set(tagName, tagId);
        }

        if (tagId && postId) {
          await tx
            .insert(postTags)
            .values({
              tagId,
              postId,
            })
            .onConflictDoNothing();
        }
      }
    }

    return postId;
  }
}
