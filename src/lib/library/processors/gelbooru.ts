import path from "node:path";
import { eq } from "drizzle-orm";
import { postDetailsGelbooruV02, posts, postTags, tags } from "@/lib/db/schema";
import type { IMetadataProcessor } from "@/lib/library/processors/base";
import type { ProcessorContext, ProcessTask } from "@/lib/library/types";

interface GelbooruMeta {
  id?: string | number;
  created_at?: string;
  date?: string;
  title?: string;
  tags?: string | string[];
  source?: string;
  width?: number;
  height?: number;
  score?: number;
  rating?: string;
  md5?: string;
  subcategory?: string;
  type?: string;
}

export class GelbooruProcessor implements IMetadataProcessor<GelbooruMeta> {
  async process(
    meta: GelbooruMeta,
    task: ProcessTask,
    context: ProcessorContext,
  ): Promise<number | null> {
    const { tx, existingPosts, existingTags, internalSourceId } = context;

    let postId: number | null = null;

    const idStr = meta.id ? String(meta.id) : null;
    if (idStr) {
      const key = `gelbooruv02:${idStr}`;
      if (!existingPosts.has(key)) {
        let title = null;
        if (meta.title) title = meta.title;
        else if (meta.tags) {
          const tagList =
            typeof meta.tags === "string" ? meta.tags.split(" ") : meta.tags;
          const charTags = tagList.filter((t: string) =>
            t.startsWith("character:"),
          );
          const copyTags = tagList.filter((t: string) =>
            t.startsWith("copyright:"),
          );
          if (charTags.length > 0)
            title = charTags[0].replace("character:", "");
          else if (copyTags.length > 0)
            title = copyTags[0].replace("copyright:", "");
        }

        const inserted = await tx
          .insert(posts)
          .values({
            extractorType: "gelbooruv02",
            jsonSourceId: idStr,
            internalSourceId: internalSourceId,
            userId: null,
            date: meta.created_at || meta.date,
            title: title,
            content: meta.source,
            url: `https://gelbooru.com/index.php?page=post&s=view&id=${idStr}`,
            metadataPath: task.jsonPath
              ? path
                  .relative(path.join(process.cwd(), "public"), task.jsonPath)
                  .split(path.sep)
                  .join("/")
              : null,
            createdAt: new Date(),
          })
          .returning({ id: posts.id });

        postId = inserted[0]?.id ?? null;
        if (postId === null) {
          console.warn(
            `[GelbooruProcessor] Failed to insert post for Gelbooru ID: ${idStr}`,
          );
          return null;
        }
        existingPosts.set(key, postId);

        const parsedTags: string[] | null =
          typeof meta.tags === "string"
            ? meta.tags.split(" ")
            : Array.isArray(meta.tags)
              ? meta.tags
              : null;

        await tx.insert(postDetailsGelbooruV02).values({
          postId: postId,
          width: meta.width,
          height: meta.height,
          score: meta.score,
          rating: meta.rating,
          source: meta.source,
          md5: meta.md5,
          tags: parsedTags ? JSON.stringify(parsedTags) : null,
        });
      } else {
        postId = existingPosts.get(key) || null;
        if (postId) {
          let title = null;
          if (meta.title) title = meta.title;
          else if (meta.tags) {
            const tagList =
              typeof meta.tags === "string" ? meta.tags.split(" ") : meta.tags;
            const charTags = tagList.filter((t: string) =>
              t.startsWith("character:"),
            );
            const copyTags = tagList.filter((t: string) =>
              t.startsWith("copyright:"),
            );
            if (charTags.length > 0)
              title = charTags[0].replace("character:", "");
            else if (copyTags.length > 0)
              title = copyTags[0].replace("copyright:", "");
          }

          const updateSet: Record<string, unknown> = {
            date: meta.created_at || meta.date,
            title: title,
            content: meta.source,
            url: `https://gelbooru.com/index.php?page=post&s=view&id=${idStr}`,
          };
          if (internalSourceId) {
            updateSet.internalSourceId = internalSourceId;
          }
          if (task.jsonPath) {
            updateSet.metadataPath = path
              .relative(path.join(process.cwd(), "public"), task.jsonPath)
              .split(path.sep)
              .join("/");
          }
          await tx.update(posts).set(updateSet).where(eq(posts.id, postId));

          const parsedTags: string[] | null =
            typeof meta.tags === "string"
              ? meta.tags.split(" ")
              : Array.isArray(meta.tags)
                ? meta.tags
                : null;

          await tx
            .update(postDetailsGelbooruV02)
            .set({
              width: meta.width,
              height: meta.height,
              score: meta.score,
              rating: meta.rating,
              source: meta.source,
              md5: meta.md5,
              tags: parsedTags ? JSON.stringify(parsedTags) : null,
            })
            .where(eq(postDetailsGelbooruV02.postId, postId));
        }
      }
    }

    // Tags
    if (idStr && postId && meta.tags) {
      const rawTags: string[] =
        typeof meta.tags === "string" ? meta.tags.split(" ") : meta.tags;
      if (Array.isArray(rawTags)) {
        for (const rawTag of rawTags) {
          const baseTagName =
            typeof rawTag === "string" ? rawTag : String(rawTag);
          if (!baseTagName) continue;

          const tagName = baseTagName.trim();
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
    }

    return postId;
  }
}
