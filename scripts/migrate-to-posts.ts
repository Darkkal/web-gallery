
import { db } from '@/lib/db';
import {
    posts,
    postDetailsTwitter,
    postDetailsPixiv,
    mediaItems,
    postTags,
    postTagsNew,
    twitterTweets,
    pixivIllusts,
    twitterUsers,
    pixivUsers
} from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

async function migrate() {
    console.log("Starting migration...");

    // 1. Migrate Twitter Tweets
    console.log("Migrating Twitter Tweets...");
    const tweets = await db.select({
        tweet: twitterTweets,
        user: twitterUsers
    })
        .from(twitterTweets)
        .leftJoin(twitterUsers, eq(twitterTweets.userId, twitterUsers.id));

    let twitterCount = 0;
    for (const { tweet, user } of tweets) {
        try {
            // Insert into posts
            const postResult = await db.insert(posts).values({
                extractorType: 'twitter',
                jsonSourceId: tweet.tweetId,
                internalSourceId: tweet.internalSourceId,
                userId: tweet.userId,
                date: tweet.date,
                title: user?.name,
                content: tweet.content,
                url: `https://twitter.com/${user?.nick || 'i'}/status/${tweet.tweetId}`,
                createdAt: new Date(),
            }).returning({ id: posts.id }).get();

            const postId = postResult.id;

            // Insert details
            await db.insert(postDetailsTwitter).values({
                postId: postId,
                retweetId: tweet.retweetId,
                quoteId: tweet.quoteId,
                replyId: tweet.replyId,
                conversationId: tweet.conversationId,
                lang: tweet.lang,
                source: tweet.source,
                sensitive: tweet.sensitive,
                sensitiveFlags: tweet.sensitiveFlags,
                favoriteCount: tweet.favoriteCount,
                quoteCount: tweet.quoteCount,
                replyCount: tweet.replyCount,
                retweetCount: tweet.retweetCount,
                bookmarkCount: tweet.bookmarkCount,
                viewCount: tweet.viewCount,
                category: tweet.category,
                subcategory: tweet.subcategory
            }).run();

            // Link Media Items
            await db.update(mediaItems)
                .set({ postId: postId })
                .where(and(
                    eq(mediaItems.internalPostId, tweet.id),
                    eq(mediaItems.extractorType, 'twitter')
                ))
                .run();

            // Migrate Tags (SELECT from old postTags, INSERT to postTagsNew)
            const tagsForPost = await db.select()
                .from(postTags)
                .where(and(
                    eq(postTags.internalPostId, tweet.id),
                    eq(postTags.extractorType, 'twitter')
                ));

            for (const t of tagsForPost) {
                await db.insert(postTagsNew).values({
                    postId: postId,
                    tagId: t.tagId
                }).onConflictDoNothing().run();
            }

            twitterCount++;
        } catch (e) {
            console.error(`Failed to migrate tweet ${tweet.tweetId}:`, e);
        }
    }
    console.log(`Migrated ${twitterCount} tweets.`);

    // 2. Migrate Pixiv Illusts
    console.log("Migrating Pixiv Illusts...");
    const illusts = await db.select({
        illust: pixivIllusts,
        user: pixivUsers
    })
        .from(pixivIllusts)
        .leftJoin(pixivUsers, eq(pixivIllusts.userId, pixivUsers.id));

    let pixivCount = 0;
    for (const { illust } of illusts) {
        try {
            // Insert into posts
            const postResult = await db.insert(posts).values({
                extractorType: 'pixiv',
                jsonSourceId: String(illust.pixivId),
                internalSourceId: illust.internalSourceId,
                userId: illust.userId,
                date: illust.date,
                title: illust.title,
                content: illust.caption,
                url: `https://www.pixiv.net/artworks/${illust.pixivId}`,
                createdAt: new Date(),
            }).returning({ id: posts.id }).get();

            const postId = postResult.id;

            // Insert details
            await db.insert(postDetailsPixiv).values({
                postId: postId,
                width: illust.width,
                height: illust.height,
                pageCount: illust.pageCount,
                restrict: illust.restrict,
                xRestrict: illust.xRestrict,
                sanityLevel: illust.sanityLevel,
                totalView: illust.totalView,
                totalBookmarks: illust.totalBookmarks,
                isBookmarked: illust.isBookmarked,
                visible: illust.visible,
                isMuted: illust.isMuted,
                illustAiType: illust.illustAiType,
                illustBookStyle: illust.illustBookStyle,
                tags: illust.tags,
                category: illust.category,
                subcategory: illust.subcategory,
                type: illust.type
            }).run();

            // Link Media Items
            await db.update(mediaItems)
                .set({ postId: postId })
                .where(and(
                    eq(mediaItems.internalPostId, illust.id),
                    eq(mediaItems.extractorType, 'pixiv')
                ))
                .run();

            // Migrate Tags
            const tagsForPost = await db.select()
                .from(postTags)
                .where(and(
                    eq(postTags.internalPostId, illust.id),
                    eq(postTags.extractorType, 'pixiv')
                ));

            for (const t of tagsForPost) {
                await db.insert(postTagsNew).values({
                    postId: postId,
                    tagId: t.tagId
                }).onConflictDoNothing().run();
            }

            pixivCount++;
        } catch (e) {
            console.error(`Failed to migrate illust ${illust.pixivId}:`, e);
        }
    }
    console.log(`Migrated ${pixivCount} illusts.`);
    console.log("Migration completed.");
}

migrate().catch(console.error);
