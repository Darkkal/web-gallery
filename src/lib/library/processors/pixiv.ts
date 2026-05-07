import { IMetadataProcessor } from '@/lib/library/processors/base';
import { ProcessTask, ProcessorContext } from '@/lib/library/types';
import { posts, postDetailsPixiv, pixivUsers, tags, postTags } from '@/lib/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import path from 'path';

interface PixivUser {
    id?: string | number;
    name?: string;
    account?: string;
    is_followed?: boolean;
    is_accept_request?: boolean;
}

interface PixivMeta {
    user?: PixivUser;
    id?: string | number;
    date?: string;
    create_date?: string;
    title?: string;
    caption?: string;
    width?: number;
    height?: number;
    page_count?: number;
    restrict?: number;
    x_restrict?: number;
    sanity_level?: number;
    total_view?: number;
    total_bookmarks?: number;
    is_bookmarked?: boolean;
    visible?: boolean;
    is_muted?: boolean;
    illust_ai_type?: number;
    illust_book_style?: number;
    tags?: string[] | { name: string }[];
    subcategory?: string;
    type?: string;
}

export class PixivProcessor implements IMetadataProcessor<PixivMeta> {
    async process(meta: PixivMeta, task: ProcessTask, context: ProcessorContext): Promise<number | null> {
        const { tx, existingPixivUsers, existingPosts, existingTags, userAvatars, internalSourceId } = context;

        let postId: number | null = null;

        const userId = meta.user?.id;
        const uidStr = userId ? String(userId) : null;

        if (uidStr) {
            const avatarPath = userAvatars.get(uidStr);
            if (!existingPixivUsers.has(uidStr)) {
                const user = meta.user!;
                const updateSet: Record<string, unknown> = {
                    name: user.name,
                };
                if (avatarPath) updateSet.profileImage = avatarPath;

                await tx.insert(pixivUsers).values({
                    id: uidStr,
                    name: user.name,
                    account: user.account,
                    profileImage: avatarPath,
                    isFollowed: user.is_followed,
                    isAcceptRequest: user.is_accept_request
                }).onConflictDoUpdate({
                    target: pixivUsers.id,
                    set: updateSet
                });
                existingPixivUsers.add(uidStr);
            }
        }

        const pid = meta.id ? String(meta.id) : null;
        if (pid) {
            const key = `pixiv:${pid}`;
            if (!existingPosts.has(key)) {
                const inserted = await tx.insert(posts).values({
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
                }).returning({ id: posts.id });

                postId = inserted[0]?.id ?? null;
                existingPosts.set(key, postId!);

                await tx.insert(postDetailsPixiv).values({
                    postId: postId!,
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
                });
            } else {
                postId = existingPosts.get(key) || null;
                if (postId && internalSourceId) {
                    await tx.update(posts)
                        .set({ internalSourceId })
                        .where(and(eq(posts.id, postId), isNull(posts.internalSourceId)));
                }
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
                    const newTag = await tx.insert(tags).values({ name: tagName }).onConflictDoNothing().returning({ id: tags.id });
                    if (newTag.length > 0) tagId = newTag[0].id;
                    else {
                        const e = await tx.select({ id: tags.id }).from(tags).where(eq(tags.name, tagName));
                        if (e.length > 0) tagId = e[0].id;
                    }
                    if (tagId) existingTags.set(tagName, tagId);
                }

                if (tagId && postId) {
                    await tx.insert(postTags).values({
                        tagId,
                        postId
                    }).onConflictDoNothing();
                }
            }
        }

        return postId;
    }
}
