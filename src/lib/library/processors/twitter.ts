import { IMetadataProcessor } from '@/lib/library/processors/base';
import { ProcessTask, ProcessorContext } from '@/lib/library/types';
import { posts, postDetailsTwitter, twitterUsers } from '@/lib/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import path from 'path';

interface TwitterUser {
    id?: string | number;
    nick?: string;
    name?: string;
    description?: string;
    location?: string;
    date?: string;
    verified?: boolean;
    protected?: boolean;
    profile_banner?: string;
    profileImage?: string;
    favourites_count?: number;
    followers_count?: number;
    friends_count?: number;
    listed_count?: number;
    media_count?: number;
    statuses_count?: number;
}

interface TwitterMeta {
    user?: TwitterUser;
    author?: TwitterUser;
    user_id?: string | number;
    uploader?: string;
    tweet_id?: string | number;
    date?: string;
    content?: string;
    retweet_id?: string | number;
    quote_id?: string | number;
    reply_id?: string | number;
    conversation_id?: string | number;
    lang?: string;
    source?: string;
    sensitive?: boolean;
    sensitive_flags?: string[];
    favorite_count?: number;
    quote_count?: number;
    reply_count?: number;
    retweet_count?: number;
    bookmark_count?: number;
    view_count?: number;
}

export class TwitterProcessor implements IMetadataProcessor<TwitterMeta> {
    process(meta: TwitterMeta, task: ProcessTask, context: ProcessorContext): number | null {
        const { tx, existingTwitterUsers, existingPosts, userAvatars, internalSourceId } = context;

        const userObj = meta.user || meta.author || {};
        const userId = userObj.id || meta.user_id;
        const uidStr = userId ? String(userId) : null;

        if (uidStr) {
            const avatarPath = userAvatars.get(uidStr);
            if (!existingTwitterUsers.has(uidStr)) {
                const updateSet: Record<string, unknown> = {
                    name: userObj.nick || userObj.name,
                    followersCount: userObj.followers_count
                };
                if (avatarPath) updateSet.profileImage = avatarPath;

                tx.insert(twitterUsers).values({
                    id: uidStr,
                    name: userObj.nick || userObj.name || meta.uploader,
                    nick: userObj.name || userObj.nick,
                    description: userObj.description,
                    location: userObj.location,
                    date: userObj.date,
                    verified: userObj.verified,
                    protected: userObj.protected,
                    profileBanner: userObj.profile_banner,
                    profileImage: avatarPath,
                    favouritesCount: userObj.favourites_count,
                    followersCount: userObj.followers_count,
                    friendsCount: userObj.friends_count,
                    listedCount: userObj.listed_count,
                    mediaCount: userObj.media_count,
                    statusesCount: userObj.statuses_count
                }).onConflictDoUpdate({
                    target: twitterUsers.id,
                    set: updateSet
                }).run();
                existingTwitterUsers.add(uidStr);
            }
        }

        const tid = meta.tweet_id ? String(meta.tweet_id) : null;
        if (tid) {
            const key = `twitter:${tid}`;
            if (!existingPosts.has(key)) {
                const inserted = tx.insert(posts).values({
                    extractorType: 'twitter',
                    jsonSourceId: tid,
                    internalSourceId: internalSourceId,
                    userId: uidStr,
                    date: meta.date,
                    title: userObj.nick || userObj.name,
                    content: meta.content,
                    url: `https://x.com/${userObj.name || userObj.nick || 'i'}/status/${tid}`,
                    metadataPath: task.jsonPath ? path.relative(path.join(process.cwd(), 'public'), task.jsonPath).split(path.sep).join('/') : null,
                    createdAt: new Date()
                }).returning({ id: posts.id }).get();

                const postId = inserted.id;
                existingPosts.set(key, postId);

                tx.insert(postDetailsTwitter).values({
                    postId: postId,
                    retweetId: meta.retweet_id ? String(meta.retweet_id) : null,
                    quoteId: meta.quote_id ? String(meta.quote_id) : null,
                    replyId: meta.reply_id ? String(meta.reply_id) : null,
                    conversationId: meta.conversation_id ? String(meta.conversation_id) : null,
                    lang: meta.lang,
                    source: meta.source,
                    sensitive: meta.sensitive,
                    sensitiveFlags: meta.sensitive_flags,
                    favoriteCount: meta.favorite_count,
                    quoteCount: meta.quote_count,
                    replyCount: meta.reply_count,
                    retweetCount: meta.retweet_count,
                    bookmarkCount: meta.bookmark_count,
                    viewCount: meta.view_count,
                    category: 'twitter',
                    subcategory: 'tweet'
                }).run();
                return postId;
            } else {
                const postId = existingPosts.get(key) || null;
                if (postId && internalSourceId) {
                    // Update internalSourceId if it's currently null
                    tx.update(posts)
                        .set({ internalSourceId })
                        .where(and(eq(posts.id, postId), isNull(posts.internalSourceId)))
                        .run();
                }
                return postId;
            }
        }
        return null;
    }
}
