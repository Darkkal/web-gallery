import { IMetadataProcessor } from './base';
import { ProcessTask, ProcessorContext } from '../types';
import { posts, postDetailsTwitter, twitterUsers } from '@/lib/db/schema';
import path from 'path';

export class TwitterProcessor implements IMetadataProcessor {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    process(meta: any, task: ProcessTask, context: ProcessorContext): number | null {
        const { tx, existingTwitterUsers, existingPosts, userAvatars, internalSourceId } = context;

        const userObj = meta.user || meta.author || {};
        const userId = userObj.id || meta.user_id;
        const uidStr = userId ? String(userId) : null;

        if (uidStr) {
            const avatarPath = userAvatars.get(uidStr);
            if (!existingTwitterUsers.has(uidStr)) {
                tx.insert(twitterUsers).values({
                    id: uidStr,
                    name: userObj.name || meta.uploader,
                    nick: userObj.nick,
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
                    target: twitterUsers.id, set: {
                        name: userObj.name,
                        profileImage: avatarPath,
                        followersCount: userObj.followers_count
                    }
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
                    title: userObj.name,
                    content: meta.content,
                    url: `https://twitter.com/${userObj.nick || 'i'}/status/${tid}`,
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
                return existingPosts.get(key) || null;
            }
        }
        return null;
    }
}
