import { relations } from "drizzle-orm";
import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const gallerydlExtractorTypes = sqliteTable(
  "gallerydl_extractor_types",
  {
    id: text("id").primaryKey(), // 'twitter', 'pixiv', etc.
    description: text("description"),
  },
);

export const sources = sqliteTable("sources", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  url: text("url").notNull(),
  extractorType: text("extractor_type").references(
    () => gallerydlExtractorTypes.id,
  ),
  name: text("name"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
    () => new Date(),
  ),
  deletedAt: integer("deleted_at", { mode: "timestamp" }),
});

export const scraperDownloadLogs = sqliteTable(
  "scraper_download_logs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    sourceId: integer("source_id")
      .references(() => sources.id, { onDelete: "cascade" })
      .notNull(),
    filePath: text("file_path").notNull().unique(), // Unique path to map back to source
    createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
      () => new Date(),
    ),
  },
  (table) => ({
    sourceIdIdx: index("idx_scraper_download_logs_source_id").on(
      table.sourceId,
    ),
  }),
);

export const scrapingTasks = sqliteTable(
  "scraping_tasks",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    sourceId: integer("source_id")
      .references(() => sources.id, { onDelete: "cascade" })
      .notNull(),
    name: text("name"),
    downloadOptions: text("download_options", { mode: "json" }).$type<{
      stopAfterCompleted?: number;
      stopAfterSkipped?: number;
      stopAfterPosts?: number;
    }>(),
    scheduleInterval: integer("schedule_interval"), // in seconds
    scheduleCron: text("schedule_cron"), // cron pattern string
    nextRunAt: integer("next_run_at", { mode: "timestamp" }),
    lastRunAt: integer("last_run_at", { mode: "timestamp" }),
    enabled: integer("enabled", { mode: "boolean" }).default(true),
    createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
      () => new Date(),
    ),
  },
  (table) => ({
    sourceIdIdx: index("idx_scraping_tasks_source_id").on(table.sourceId),
  }),
);

export const scrapeHistory = sqliteTable(
  "scrape_history",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    sourceId: integer("source_id")
      .references(() => sources.id, { onDelete: "cascade" })
      .notNull(),
    startTime: integer("start_time", { mode: "timestamp" }).notNull(),
    endTime: integer("end_time", { mode: "timestamp" }),
    status: text("status")
      .$type<"running" | "completed" | "stopped" | "failed">()
      .notNull(),
    filesDownloaded: integer("files_downloaded").default(0),
    bytesDownloaded: integer("bytes_downloaded").default(0),
    errorCount: integer("error_count").default(0),
    skippedCount: integer("skipped_count").default(0),
    postsProcessed: integer("posts_processed").default(0),
    averageSpeed: integer("average_speed").default(0), // bytes per second
    lastError: text("last_error"),
    logPath: text("log_path"),
    cursor: text("cursor"), // gallery-dl resume cursor for continuing failed scrapes
    taskId: integer("task_id").references(() => scrapingTasks.id, {
      onDelete: "set null",
    }),
  },
  (table) => ({
    sourceIdIdx: index("idx_scrape_history_source_id").on(table.sourceId),
    taskIdIdx: index("idx_scrape_history_task_id").on(table.taskId),
  }),
);

export const scanHistory = sqliteTable("scan_history", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  startTime: integer("start_time", { mode: "timestamp" }).notNull(),
  endTime: integer("end_time", { mode: "timestamp" }),
  status: text("status")
    .$type<"running" | "completed" | "failed" | "stopped">()
    .notNull(),
  scanType: text("scan_type").$type<"full" | "incremental">().default("full"),
  filesProcessed: integer("files_processed").default(0),
  filesAdded: integer("files_added").default(0),
  filesUpdated: integer("files_updated").default(0),
  filesDeleted: integer("files_deleted").default(0),
  errors: integer("errors").default(0),
  lastError: text("last_error"),
});

// Forward declaration for circular references if needed in standard SQL,
// but Drizzle handles them via callbacks usually or order doesn't matter for definition objects until usage.
// However, we need to define tables before referencing them if we pass them as objects.

export const twitterUsers = sqliteTable("twitter_users", {
  id: text("id").primaryKey(), // Twitter User ID is big, keep as text
  name: text("name"),
  nick: text("nick"),
  location: text("location"),
  date: text("date"), // "2024-10-02 02:03:45"
  verified: integer("verified", { mode: "boolean" }),
  protected: integer("protected", { mode: "boolean" }),
  profileBanner: text("profile_banner"),
  profileImage: text("profile_image"),
  favouritesCount: integer("favourites_count"),
  followersCount: integer("followers_count"),
  friendsCount: integer("friends_count"),
  listedCount: integer("listed_count"),
  mediaCount: integer("media_count"),
  statusesCount: integer("statuses_count"),
  description: text("description"),
});

export const pixivUsers = sqliteTable("pixiv_users", {
  id: text("id").primaryKey(),
  name: text("name"),
  account: text("account"),
  profileImage: text("profile_image"),
  isFollowed: integer("is_followed", { mode: "boolean" }),
  isAcceptRequest: integer("is_accept_request", { mode: "boolean" }),
});

export const posts = sqliteTable(
  "posts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    extractorType: text("extractor_type").notNull(), // 'twitter', 'pixiv', 'gelbooruv02'
    jsonSourceId: text("json_source_id"), // Original platform ID (tweet_id, pixiv_id)
    internalSourceId: integer("internal_source_id").references(
      () => sources.id,
      {
        onDelete: "cascade",
      },
    ),
    userId: text("user_id"), // Generic user identifier
    date: text("date"), // Original creation date
    title: text("title"),
    content: text("content"), // caption, body, etc.
    url: text("url"), // Link to original post
    metadataPath: text("metadata_path"), // Path to the JSON metadata file
    isSourceDeleted: integer("is_source_deleted", { mode: "boolean" }).default(
      false,
    ),
    createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
      () => new Date(),
    ),
    deletedAt: integer("deleted_at", { mode: "timestamp" }),
  },
  (table) => ({
    internalSourceIdIdx: index("idx_posts_internal_source_id").on(
      table.internalSourceId,
    ),
  }),
);

export const postDetailsTwitter = sqliteTable(
  "post_details_twitter",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    postId: integer("post_id")
      .references(() => posts.id, { onDelete: "cascade" })
      .notNull(),
    retweetId: text("retweet_id"),
    quoteId: text("quote_id"),
    replyId: text("reply_id"),
    conversationId: text("conversation_id"),
    lang: text("lang"),
    source: text("source"),
    sensitive: integer("sensitive", { mode: "boolean" }),
    sensitiveFlags: text("sensitive_flags", { mode: "json" }),
    favoriteCount: integer("favorite_count"),
    quoteCount: integer("quote_count"),
    replyCount: integer("reply_count"),
    retweetCount: integer("retweet_count"),
    bookmarkCount: integer("bookmark_count"),
    viewCount: integer("view_count"),
    category: text("category"),
    subcategory: text("subcategory"),
  },
  (table) => ({
    postIdIdx: index("idx_post_details_twitter_post_id").on(table.postId),
  }),
);

export const postDetailsPixiv = sqliteTable(
  "post_details_pixiv",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    postId: integer("post_id")
      .references(() => posts.id, { onDelete: "cascade" })
      .notNull(),
    width: integer("width"),
    height: integer("height"),
    pageCount: integer("page_count"),
    restrict: integer("restrict"),
    xRestrict: integer("x_restrict"),
    sanityLevel: integer("sanity_level"),
    totalView: integer("total_view"),
    totalBookmarks: integer("total_bookmarks"),
    isBookmarked: integer("is_bookmarked", { mode: "boolean" }),
    visible: integer("visible", { mode: "boolean" }),
    isMuted: integer("is_muted", { mode: "boolean" }),
    illustAiType: integer("illust_ai_type"),
    illustBookStyle: integer("illust_book_style"),
    tags: text("tags", { mode: "json" }),
    category: text("category"),
    subcategory: text("subcategory"),
    type: text("type"), // illust, manga, ugoira
  },
  (table) => ({
    postIdIdx: index("idx_post_details_pixiv_post_id").on(table.postId),
  }),
);

export const postDetailsGelbooruV02 = sqliteTable(
  "post_details_gelbooruv02",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    postId: integer("post_id")
      .references(() => posts.id, { onDelete: "cascade" })
      .notNull(),
    rating: text("rating"),
    score: integer("score"),
    md5: text("md5"),
    width: integer("width"),
    height: integer("height"),
    tags: text("tags", { mode: "json" }),
    directory: text("directory"),
    source: text("source"),
  },
  (table) => ({
    postIdIdx: index("idx_post_details_gelbooruv02_post_id").on(table.postId),
  }),
);

export const postDetailsEHentai = sqliteTable(
  "post_details_ehentai",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    postId: integer("post_id")
      .references(() => posts.id, { onDelete: "cascade" })
      .notNull(),
    gid: integer("gid"),
    token: text("token"),
    ehCategory: text("eh_category"),
    uploader: text("uploader"),
    language: text("language"),
    filecount: integer("file_count"),
    rating: text("rating"),
    torrentcount: integer("torrent_count"),
  },
  (table) => ({
    postIdIdx: index("idx_post_details_ehentai_post_id").on(table.postId),
  }),
);

export const mediaItems = sqliteTable(
  "media_items",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    filePath: text("file_path").notNull(),
    mediaType: text("media_type")
      .$type<"image" | "video" | "audio" | "text">()
      .default("image"),
    capturedAt: integer("captured_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
      () => new Date(),
    ),
    width: integer("width"),
    height: integer("height"),

    // Relationship
    postId: integer("post_id").references(() => posts.id, {
      onDelete: "set null",
    }),
  },
  (table) => ({
    postIdIdx: index("idx_media_items_post_id").on(table.postId),
  }),
);

export const playlists = sqliteTable("playlists", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  description: text("description"),
  thumbnail: text("thumbnail"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
    () => new Date(),
  ),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(
    () => new Date(),
  ),
});

export const playlistItems = sqliteTable(
  "playlist_items",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    playlistId: integer("playlist_id")
      .references(() => playlists.id, { onDelete: "cascade" })
      .notNull(),
    mediaItemId: integer("media_item_id")
      .references(() => mediaItems.id, { onDelete: "cascade" })
      .notNull(),
    position: integer("position").notNull().default(0),
    addedAt: integer("added_at", { mode: "timestamp" }).$defaultFn(
      () => new Date(),
    ),
  },
  (table) => ({
    playlistIdIdx: index("idx_playlist_items_playlist_id").on(table.playlistId),
    mediaItemIdIdx: index("idx_playlist_items_media_item_id").on(
      table.mediaItemId,
    ),
  }),
);

export const tagCategories = sqliteTable("tag_categories", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  colorHue: integer("color_hue").notNull(),
  colorSaturation: integer("color_saturation").notNull(),
  colorLightness: integer("color_lightness").notNull(),
  isBuiltin: integer("is_builtin", { mode: "boolean" })
    .notNull()
    .default(false),
});

export const tags = sqliteTable("tags", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  categoryId: integer("category_id").references(() => tagCategories.id, {
    onDelete: "set null",
  }),
  aliasOfTagId: integer("alias_of_tag_id").references((): any => tags.id, {
    onDelete: "set null",
  }),
});

export const postTags = sqliteTable(
  "post_tags",
  {
    tagId: integer("tag_id")
      .references(() => tags.id, { onDelete: "cascade" })
      .notNull(),
    postId: integer("post_id")
      .references(() => posts.id, { onDelete: "cascade" })
      .notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.tagId, t.postId] }),
    postIdIdx: index("idx_post_tags_post_id").on(t.postId),
  }),
);

// ──────────────────────────────────────────────
// Relations
// ──────────────────────────────────────────────

export const gallerydlExtractorTypesRelations = relations(
  gallerydlExtractorTypes,
  ({ many }) => ({
    sources: many(sources),
  }),
);

export const sourcesRelations = relations(sources, ({ one, many }) => ({
  extractorType: one(gallerydlExtractorTypes, {
    fields: [sources.extractorType],
    references: [gallerydlExtractorTypes.id],
  }),
  scrapingTasks: many(scrapingTasks),
  scraperDownloadLogs: many(scraperDownloadLogs),
  scrapeHistory: many(scrapeHistory),
  posts: many(posts),
}));

export const scraperDownloadLogsRelations = relations(
  scraperDownloadLogs,
  ({ one }) => ({
    source: one(sources, {
      fields: [scraperDownloadLogs.sourceId],
      references: [sources.id],
    }),
  }),
);

export const scrapingTasksRelations = relations(
  scrapingTasks,
  ({ one, many }) => ({
    source: one(sources, {
      fields: [scrapingTasks.sourceId],
      references: [sources.id],
    }),
    scrapeHistory: many(scrapeHistory),
  }),
);

export const scrapeHistoryRelations = relations(scrapeHistory, ({ one }) => ({
  source: one(sources, {
    fields: [scrapeHistory.sourceId],
    references: [sources.id],
  }),
  task: one(scrapingTasks, {
    fields: [scrapeHistory.taskId],
    references: [scrapingTasks.id],
  }),
}));

export const postsRelations = relations(posts, ({ one, many }) => ({
  source: one(sources, {
    fields: [posts.internalSourceId],
    references: [sources.id],
  }),
  twitterDetails: one(postDetailsTwitter, {
    fields: [posts.id],
    references: [postDetailsTwitter.postId],
  }),
  pixivDetails: one(postDetailsPixiv, {
    fields: [posts.id],
    references: [postDetailsPixiv.postId],
  }),
  gelbooruDetails: one(postDetailsGelbooruV02, {
    fields: [posts.id],
    references: [postDetailsGelbooruV02.postId],
  }),
  ehentaiDetails: one(postDetailsEHentai, {
    fields: [posts.id],
    references: [postDetailsEHentai.postId],
  }),
  mediaItems: many(mediaItems),
  tags: many(postTags),
}));

export const postDetailsTwitterRelations = relations(
  postDetailsTwitter,
  ({ one }) => ({
    post: one(posts, {
      fields: [postDetailsTwitter.postId],
      references: [posts.id],
    }),
  }),
);

export const postDetailsPixivRelations = relations(
  postDetailsPixiv,
  ({ one }) => ({
    post: one(posts, {
      fields: [postDetailsPixiv.postId],
      references: [posts.id],
    }),
  }),
);

export const postDetailsGelbooruV02Relations = relations(
  postDetailsGelbooruV02,
  ({ one }) => ({
    post: one(posts, {
      fields: [postDetailsGelbooruV02.postId],
      references: [posts.id],
    }),
  }),
);

export const postDetailsEHentaiRelations = relations(
  postDetailsEHentai,
  ({ one }) => ({
    post: one(posts, {
      fields: [postDetailsEHentai.postId],
      references: [posts.id],
    }),
  }),
);

export const mediaItemsRelations = relations(mediaItems, ({ one, many }) => ({
  post: one(posts, {
    fields: [mediaItems.postId],
    references: [posts.id],
  }),
  playlistItems: many(playlistItems),
}));

export const playlistsRelations = relations(playlists, ({ many }) => ({
  items: many(playlistItems),
}));

export const playlistItemsRelations = relations(playlistItems, ({ one }) => ({
  playlist: one(playlists, {
    fields: [playlistItems.playlistId],
    references: [playlists.id],
  }),
  mediaItem: one(mediaItems, {
    fields: [playlistItems.mediaItemId],
    references: [mediaItems.id],
  }),
}));

export const tagCategoriesRelations = relations(tagCategories, ({ many }) => ({
  tags: many(tags),
}));

export const tagsRelations = relations(tags, ({ one, many }) => ({
  postTags: many(postTags),
  category: one(tagCategories, {
    fields: [tags.categoryId],
    references: [tagCategories.id],
  }),
  aliasOf: one(tags, {
    fields: [tags.aliasOfTagId],
    references: [tags.id],
    relationName: "tag_aliases",
  }),
  aliases: many(tags, {
    relationName: "tag_aliases",
  }),
}));

export const postTagsRelations = relations(postTags, ({ one }) => ({
  tag: one(tags, {
    fields: [postTags.tagId],
    references: [tags.id],
  }),
  post: one(posts, {
    fields: [postTags.postId],
    references: [posts.id],
  }),
}));

export const libraryStatistics = sqliteTable("library_statistics", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  totalPosts: integer("total_posts").notNull().default(0),
  totalMediaItems: integer("total_media_items").notNull().default(0),
  totalTags: integer("total_tags").notNull().default(0),
  totalCanonicalTags: integer("total_canonical_tags").notNull().default(0),
  totalUsers: integer("total_users").notNull().default(0),
  totalExtractors: integer("total_extractors").notNull().default(0),
  storageBytes: integer("storage_bytes").notNull().default(0),
  updatedAt: integer("updated_at").notNull(),
});

export const statisticsHistory = sqliteTable(
  "statistics_history",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    date: text("date").notNull(),
    dateType: text("date_type").notNull().default("import"),
    totalPosts: integer("total_posts").notNull().default(0),
    totalMediaItems: integer("total_media_items").notNull().default(0),
    totalTags: integer("total_tags").notNull().default(0),
    totalCanonicalTags: integer("total_canonical_tags").notNull().default(0),
    totalUsers: integer("total_users").notNull().default(0),
    totalExtractors: integer("total_extractors").notNull().default(0),
    storageBytes: integer("storage_bytes").notNull().default(0),
  },
  (table) => ({
    dateIdx: uniqueIndex("idx_statistics_history_date").on(
      table.date,
      table.dateType,
    ),
  }),
);
