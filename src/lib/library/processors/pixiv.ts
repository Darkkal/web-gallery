import { IMetadataProcessor } from './base';
import { ProcessTask, ProcessorContext } from '../types';
import { posts, postDetailsPixiv, pixivUsers, tags, postTags } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import path from 'path';

export class PixivProcessor implements IMetadataProcessor {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    process(meta: any, task: ProcessTask, context: ProcessorContext): number | null {
        const { tx, existingPixivUsers, existingPosts, existingTags, userAvatars, internalSourceId } = context;

        let postId: number | null = null;

        const userId = meta.user?.id;
        const uidStr = userId ? String(userId) : null;

        if (uidStr) {
            const avatarPath = userAvatars.get(uidStr);
            if (!existingPixivUsers.has(uidStr)) {
                tx.insert(pixivUsers).values({
                    id: uidStr,
                    name: meta.user.name,
                    account: meta.user.account,
                    profileImage: avatarPath,
                    isFollowed: meta.user.is_followed,
                    isAcceptRequest: meta.user.is_accept_request
                }).onConflictDoUpdate({
                    target: pixivUsers.id, set: {
                        name: meta.user.name,
                        profileImage: avatarPath
                    }
                }).run();
                existingPixivUsers.add(uidStr);
            }
        }

        const pid = meta.id ? String(meta.id) : null;
        if (pid) {
            const key = `pixiv:${pid}`;
            if (!existingPosts.has(key)) {
                const inserted = tx.insert(posts).values({
                    extractorType: 'pixiv',
                    jsonSourceId: pid,
                    internalSourceId: internalSourceId,
                    userId: uidStr,
                    date: meta.date || meta.create_date,
                    title: meta.title,
                    content: meta.caption,
                    url: `https://www.pixiv.net/artworks/${pid}`,
                    metadataPath: task.jsonPath ? path.relative(path.join(process.cwd(), 'public'), task.jsonPath).split(path.sep).join('/') : null,
                    createdAt: new Date()
                }).returning({ id: posts.id }).get();

                postId = inserted.id;
                existingPosts.set(key, postId!);

                tx.insert(postDetailsPixiv).values({
                    postId: postId,
                    width: meta.width,
                    height: meta.height,
                    pageCount: meta.page_count,
                    restrict: meta.restrict,
                    xRestrict: meta.x_restrict,
                    sanityLevel: meta.sanity_level,
                    totalView: meta.total_view,
                    totalBookmarks: meta.total_bookmarks,
                    isBookmarked: meta.is_bookmarked,
                    visible: meta.visible,
                    isMuted: meta.is_muted,
                    illustAiType: meta.illust_ai_type,
                    illustBookStyle: meta.illust_book_style,
                    tags: meta.tags,
                    category: 'pixiv',
                    subcategory: meta.subcategory,
                    type: meta.type
                }).run();
            } else {
                postId = existingPosts.get(key) || null;
            }
        }

        // Tags
        if (pid && postId && meta.tags && Array.isArray(meta.tags)) {
            for (const rawTag of meta.tags) {
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

        return postId;
    }
}
