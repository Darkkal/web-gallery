export interface UnifiedPixivData {
    id?: number;
    pixivId?: string | number;
    title?: string | null;
    caption?: string | null;
    totalBookmarks?: number | null;
    totalView?: number | null;
    pageCount?: number | null;
}

export interface UnifiedTwitterData {
    content?: string | null;
    favoriteCount?: number | null;
    retweetCount?: number | null;
    bookmarkCount?: number | null;
    viewCount?: number | null;
    tweetId?: string | null;
}

export interface UnifiedUserData {
    name?: string | null;
    username?: string | null; // For Twitter handle
    nick?: string | null; // For Twitter nickname / handle
    account?: string | null; // For Pixiv account
    profileImage?: string | null;
}

export interface UnifiedGelbooruv02Data {
    id?: number;
    sourceId?: string | null; // md5 or id
    tags?: string[];
    source?: string | null;
    score?: number | null;
    rating?: string | null;
}

/**
 * Merges raw post data and Pixiv details into a unified object for Lightbox.
 */
export function mergePixivMetadata(
    post: { id: number; jsonSourceId: string | null; title: string | null; content: string | null } | undefined | null,
    details: { totalBookmarks: number | null; totalView: number | null; pageCount: number | null } | undefined | null
): UnifiedPixivData | undefined {
    if (!post && !details) return undefined;

    // Check if we have any meaningful data
    const hasPostData = !!(post?.id || post?.jsonSourceId || post?.title || post?.content);
    // const hasDetailsData = !!(details?.totalBookmarks || details?.totalView || details?.pageCount); // Unused

    if (!hasPostData && !details) return undefined;

    // If we only have details but they are all null/0, maybe we should still return it if it's explicitly a pixiv post?
    // But for Gallery where we mix types, we only want to return if it REALLY is pixiv data.
    // The gallery logic passes `current.pixiv` which is left joined. If it matches, it's not null.
    // But if there is no matching row, `details` is null.

    // If details is null and post is null, we returned above.
    // If details is null but post is NOT null (generic post data), we might return a partial object.
    // BUT, we only want to show Pixiv section if it IS a Pixiv post.
    // The caller should ideally only call this if it knows it's a Pixiv post, OR we detect it here.
    // In Gallery, we pass `currentItemRow.pixiv` which is the joined table. If the post is NOT pixiv, this join should be empty? 
    // Actually, `postDetailsPixiv` join condition is `eq(posts.id, postDetailsPixiv.postId)`. 
    // If the post is Twitter, it won't have a row in `postDetailsPixiv`, so `details` will be null.
    // But `post` (generic) is passed. 

    // So if `details` is null, we should probably return undefined UNLESS we know from `post` that it's Pixiv.
    // But `post` generic object doesn't have type info passed here (it's just id/title/content).

    // Strategy: Only return if `details` exists OR if `post` has `jsonSourceId` (which might be ambiguous but likely implies source existence).
    // Better: Rely on the fact that for non-Pixiv posts, `details` is null.
    // If `details` is null, and we are just mapping generic post data, we effectively convert a Generic Post to Pixiv Metadata? No.

    // If details is NULL, we assume it's NOT a Pixiv post, unless we want to support "Pixiv post without details loaded yet".
    // For now, let's strictly require `details` OR specific Pixiv fields.

    if (!details && !post?.jsonSourceId) return undefined;

    return {
        id: post?.id,
        pixivId: post?.jsonSourceId || undefined,
        title: post?.title,
        caption: post?.content,
        totalBookmarks: details?.totalBookmarks,
        totalView: details?.totalView,
        pageCount: details?.pageCount,
    };
}

/**
 * Merges raw post data and Twitter details into a unified object for Lightbox.
 */
export function mergeTwitterMetadata(
    post: { jsonSourceId: string | null; content: string | null } | undefined | null,
    details: { favoriteCount: number | null; retweetCount: number | null; bookmarkCount: number | null; viewCount: number | null } | undefined | null
): UnifiedTwitterData | undefined {
    if (!post && !details) return undefined;

    // Similar logic: if details is null, likely not a Twitter post (or no stats).
    if (!details && !post?.jsonSourceId) return undefined;

    return {
        tweetId: post?.jsonSourceId || undefined,
        content: post?.content,
        favoriteCount: details?.favoriteCount,
        retweetCount: details?.retweetCount,
        bookmarkCount: details?.bookmarkCount,
        viewCount: details?.viewCount,
    };
}

/**
 * Merges raw post data and Gelbooru details into a unified object.
 */
export function mergeGelbooruv02Metadata(
    post: { id: number; jsonSourceId: string | null; url: string | null } | undefined | null,
    details: { score: number | null; rating: string | null; tags: unknown } | undefined | null
): UnifiedGelbooruv02Data | undefined {
    if (!post && !details) return undefined;

    let parsedTags: string[] = [];
    if (details?.tags) {
        if (Array.isArray(details.tags)) {
            parsedTags = details.tags as string[];
        } else if (typeof details.tags === 'string') {
            try {
                parsedTags = JSON.parse(details.tags);
            } catch {
                parsedTags = [];
            }
        }
    }

    return {
        id: post?.id,
        sourceId: post?.jsonSourceId,
        source: post?.url,
        score: details?.score,
        rating: details?.rating,
        tags: parsedTags,
    };
}
