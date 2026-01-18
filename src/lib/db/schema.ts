import { sqliteTable, text, integer, primaryKey } from 'drizzle-orm/sqlite-core';

export const gallerydlExtractorTypes = sqliteTable('gallerydl_extractor_types', {
    id: text('id').primaryKey(), // 'twitter', 'pixiv', etc.
    description: text('description'),
});

export const sources = sqliteTable('sources', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    url: text('url').notNull(),
    extractorType: text('extractor_type').references(() => gallerydlExtractorTypes.id),
    name: text('name'),
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
    deletedAt: integer('deleted_at', { mode: 'timestamp' }),
});

export const scraperDownloadLogs = sqliteTable('scraper_download_logs', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    sourceId: integer('source_id').references(() => sources.id).notNull(),
    filePath: text('file_path').notNull().unique(), // Unique path to map back to source
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
    lastError: text('last_error'),
});

export const scanHistory = sqliteTable('scan_history', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    startTime: integer('start_time', { mode: 'timestamp' }).notNull(),
    endTime: integer('end_time', { mode: 'timestamp' }),
    status: text('status').$type<'running' | 'completed' | 'failed' | 'stopped'>().notNull(),
    filesProcessed: integer('files_processed').default(0),
    filesAdded: integer('files_added').default(0),
    filesUpdated: integer('files_updated').default(0),
    filesDeleted: integer('files_deleted').default(0),
    errors: integer('errors').default(0),
    lastError: text('last_error'),
});

// Forward declaration for circular references if needed in standard SQL, 
// but Drizzle handles them via callbacks usually or order doesn't matter for definition objects until usage.
// However, we need to define tables before referencing them if we pass them as objects.

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
    tweetId: text('tweet_id').notNull().unique(), // The actual string ID from Twitter
    retweetId: text('retweet_id'),
    quoteId: text('quote_id'),
    replyId: text('reply_id'),
    conversationId: text('conversation_id'),
    jsonSourceId: text('json_source_id'), // Renamed from sourceId
    internalSourceId: integer('internal_source_id').references(() => sources.id), // Link to source table
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
    category: text('category'),
    subcategory: text('subcategory'),
});

export const pixivUsers = sqliteTable('pixiv_users', {
    id: text('id').primaryKey(),
    name: text('name'),
    account: text('account'),
    profileImage: text('profile_image'),
    isFollowed: integer('is_followed', { mode: 'boolean' }),
    isAcceptRequest: integer('is_accept_request', { mode: 'boolean' }),
});

export const pixivIllusts = sqliteTable('pixiv_illusts', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    pixivId: integer('pixiv_id').notNull().unique(),
    userId: text('user_id').references(() => pixivUsers.id),
    internalSourceId: integer('internal_source_id').references(() => sources.id), // Link to source table
    title: text('title'),
    type: text('type'),
    caption: text('caption'),
    restrict: integer('restrict'),
    xRestrict: integer('x_restrict'),
    sanityLevel: integer('sanity_level'),
    width: integer('width'),
    height: integer('height'),
    pageCount: integer('page_count'),
    totalView: integer('total_view'),
    totalBookmarks: integer('total_bookmarks'),
    isBookmarked: integer('is_bookmarked', { mode: 'boolean' }),
    visible: integer('visible', { mode: 'boolean' }),
    isMuted: integer('is_muted', { mode: 'boolean' }),
    illustAiType: integer('illust_ai_type'),
    illustBookStyle: integer('illust_book_style'),
    tags: text('tags', { mode: 'json' }), // JSON array
    date: text('date'),
    category: text('category'),
    subcategory: text('subcategory'),
});

export const mediaItems = sqliteTable('media_items', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    // Removed sourceId as it is now on the post table (internalSourceId)
    filePath: text('file_path').notNull(),
    mediaType: text('media_type').$type<'image' | 'video' | 'audio' | 'text'>().default('image'),
    capturedAt: integer('captured_at', { mode: 'timestamp' }),
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),

    // Polymorphic Relationship
    extractorType: text('extractor_type').references(() => gallerydlExtractorTypes.id),
    internalPostId: integer('internal_post_id'), // Link to twitter_tweets.id or pixiv_illusts.id
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
    mediaItemId: integer('media_item_id').references(() => mediaItems.id, { onDelete: 'cascade' }).notNull(),
    addedAt: integer('added_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

export const tags = sqliteTable('tags', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull().unique(),
    extractorType: text('extractor_type').references(() => gallerydlExtractorTypes.id),
});

export const pixivIllustTags = sqliteTable('pixiv_illust_tags', {
    illustId: integer('illust_id').references(() => pixivIllusts.id, { onDelete: 'cascade' }).notNull(),
    tagId: integer('tag_id').references(() => tags.id, { onDelete: 'cascade' }).notNull(),
}, (t) => ({
    pk: primaryKey({ columns: [t.illustId, t.tagId] }),
}));
