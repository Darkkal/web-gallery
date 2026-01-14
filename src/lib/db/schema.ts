import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const sources = sqliteTable('sources', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    url: text('url').notNull(),
    type: text('type').$type<'gallery-dl' | 'yt-dlp' | 'unknown'>().default('unknown'),
    name: text('name'),
    lastScrapedAt: integer('last_scraped_at', { mode: 'timestamp' }),
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
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
