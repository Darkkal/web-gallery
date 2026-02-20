import { IMetadataProcessor } from './base';
import { ProcessTask, ProcessorContext } from '../types';
import { posts, postDetailsGelbooruV02, tags, postTags } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import path from 'path';

export class GelbooruProcessor implements IMetadataProcessor {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    process(meta: any, task: ProcessTask, context: ProcessorContext): number | null {
        const { tx, existingPosts, existingTags, internalSourceId } = context;

        let postId: number | null = null;

        const idStr = meta.id ? String(meta.id) : null;
        if (idStr) {
            const key = `gelbooruv02:${idStr}`;
            if (!existingPosts.has(key)) {

                let title = null;
                if (meta.title) title = meta.title;
                else if (meta.tags) {
                    const tagList = typeof meta.tags === 'string' ? meta.tags.split(' ') : meta.tags;
                    const charTags = tagList.filter((t: string) => t.startsWith('character:'));
                    const copyTags = tagList.filter((t: string) => t.startsWith('copyright:'));
                    if (charTags.length > 0) title = charTags[0].replace('character:', '');
                    else if (copyTags.length > 0) title = copyTags[0].replace('copyright:', '');
                }

                const inserted = tx.insert(posts).values({
                    extractorType: 'gelbooruv02',
                    jsonSourceId: idStr,
                    internalSourceId: internalSourceId,
                    userId: null,
                    date: meta.created_at || meta.date,
                    title: title,
                    content: meta.source,
                    url: `https://gelbooru.com/index.php?page=post&s=view&id=${idStr}`,
                    metadataPath: task.jsonPath ? path.relative(path.join(process.cwd(), 'public'), task.jsonPath).split(path.sep).join('/') : null,
                    createdAt: new Date()
                }).returning({ id: posts.id }).get();

                postId = inserted.id;
                existingPosts.set(key, postId!);

                const parsedTags = typeof meta.tags === 'string' ? meta.tags.split(' ') : meta.tags;

                tx.insert(postDetailsGelbooruV02).values({
                    postId: postId,
                    width: meta.width,
                    height: meta.height,
                    score: meta.score,
                    rating: meta.rating,
                    source: meta.source,
                    md5: meta.md5,
                    tags: parsedTags ? JSON.stringify(parsedTags) : null,
                    category: 'gelbooru',
                    subcategory: meta.subcategory,
                    type: meta.type
                }).run();
            } else {
                postId = existingPosts.get(key) || null;
            }
        }

        // Tags
        if (idStr && postId && meta.tags) {
            const rawTags = typeof meta.tags === 'string' ? meta.tags.split(' ') : meta.tags;
            if (Array.isArray(rawTags)) {
                for (const rawTag of rawTags) {
                    const baseTagName = typeof rawTag === 'string' ? rawTag : rawTag.name;
                    if (!baseTagName) continue;

                    const tagName = baseTagName.trim();
                    let tagId = existingTags.get(tagName);

                    if (!tagId) {
                        const newTag = tx.insert(tags).values({ name: tagName }).onConflictDoNothing().returning({ id: tags.id }).get();
                        if (newTag) tagId = newTag.id;
                        else {
                            const e = tx.select({ id: tags.id }).from(tags).where(eq(tags.name, tagName)).get();
                            if (e) tagId = e.id;
                        }
                        if (tagId) existingTags.set(tagName, tagId);
                    }

                    if (tagId && postId) {
                        tx.insert(postTags).values({
                            tagId,
                            postId
                        }).onConflictDoNothing().run();
                    }
                }
            }
        }

        return postId;
    }
}
