import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const sources = sqliteTable('sources', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    url: text('url').notNull(),
    type: text('type').$type<'gallery-dl' | 'yt-dlp' | 'unknown'>().default('unknown'),
    name: text('name'),
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

export const scrapeHistory = sqliteTable('scrape_history', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    sourceId: integer('source_id').references(() => sources.id).notNull(),
    startTime: integer('start_time', { mode: 'timestamp' }).notNull(),
    endTime: integer('end_time', { mode: 'timestamp' }),
    status: text('status').$type<'running' | 'completed' | 'stopped' | 'failed'>().notNull(),
    filesDownloaded: integer('files_downloaded').default(0),
    bytesDownloaded: integer('bytes_downloaded').default(0),
    errorCount: integer('error_count').default(0),
    averageSpeed: integer('average_speed').default(0), // bytes per second
});

export const mediaItems = sqliteTable('media_items', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    sourceId: integer('source_id').references(() => sources.id),
    filePath: text('file_path').notNull(),
    originalUrl: text('original_url'),
    mediaType: text('media_type').$type<'image' | 'video' | 'audio' | 'text'>().default('image'),
    title: text('title'),
    description: text('description'),
    capturedAt: integer('captured_at', { mode: 'timestamp' }),
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
    metadata: text('metadata'), // JSON string
});

export const collections = sqliteTable('collections', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull(),
    description: text('description'),
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

export const collectionItems = sqliteTable('collection_items', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    collectionId: integer('collection_id').references(() => collections.id).notNull(),
    mediaItemId: integer('media_item_id').references(() => mediaItems.id).notNull(),
    addedAt: integer('added_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

export const twitterUsers = sqliteTable('twitter_users', {
    id: text('id').primaryKey(), // Twitter User ID is big, keep as text
    name: text('name'),
    nick: text('nick'),
    location: text('location'),
    date: text('date'), // "2024-10-02 02:03:45"
    verified: integer('verified', { mode: 'boolean' }),
    protected: integer('protected', { mode: 'boolean' }),
    profileBanner: text('profile_banner'),
    profileImage: text('profile_image'),
    favouritesCount: integer('favourites_count'),
    followersCount: integer('followers_count'),
    friendsCount: integer('friends_count'),
    listedCount: integer('listed_count'),
    mediaCount: integer('media_count'),
    statusesCount: integer('statuses_count'),
    description: text('description'),
});

export const twitterTweets = sqliteTable('twitter_tweets', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    tweetId: text('tweet_id').notNull(),
    mediaItemId: integer('media_item_id').references(() => mediaItems.id),
    retweetId: text('retweet_id'),
    quoteId: text('quote_id'),
    replyId: text('reply_id'),
    conversationId: text('conversation_id'),
    sourceId: text('source_id'),
    date: text('date'),
    userId: text('user_id').references(() => twitterUsers.id),
    lang: text('lang'),
    source: text('source'),
    sensitive: integer('sensitive', { mode: 'boolean' }),
    sensitiveFlags: text('sensitive_flags', { mode: 'json' }), // JSON array
    favoriteCount: integer('favorite_count'),
    quoteCount: integer('quote_count'),
    replyCount: integer('reply_count'),
    retweetCount: integer('retweet_count'),
    bookmarkCount: integer('bookmark_count'),
    viewCount: integer('view_count'),
    content: text('content'),
    count: integer('count'), // Not sure what this is, maybe media count in tweet?
    category: text('category'),
    subcategory: text('subcategory'),
});
