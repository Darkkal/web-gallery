# Architecture

This document describes the high-level architecture of **Web Gallery**: how the system is structured, how its major subsystems interact, and the key design decisions behind them.

For day-to-day coding conventions and established patterns, see [CONTRIBUTING.md](./CONTRIBUTING.md).

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Directory Map](#2-directory-map)
3. [Subsystems](#3-subsystems)
   - [3.1 Boot & Initialization](#31-boot--initialization)
   - [3.2 Database Layer](#32-database-layer)
   - [3.3 Scraping Subsystem](#33-scraping-subsystem)
   - [3.4 Library Scanner](#34-library-scanner)
   - [3.5 Next.js Application Layer](#35-nextjs-application-layer)
   - [3.6 Avatar Proxy & Request Queue](#36-avatar-proxy--request-queue)
   - [3.7 Settings & Configuration System](#37-settings--configuration-system)
   - [3.8 Task Scheduling Subsystem](#38-task-scheduling-subsystem)
   - [3.9 Statistics Subsystem](#39-statistics-subsystem)
4. [Data Flow](#4-data-flow)
   - [4.1 Scrape → Scan → Display](#41-scrape--scan--display)
   - [4.2 Client-Side Data Fetching](#42-client-side-data-fetching)
5. [Database Schema](#5-database-schema)
6. [Storage Layout](#6-storage-layout)
7. [Deployment](#7-deployment)
8. [Key Design Decisions](#8-key-design-decisions)

---

## 1. System Overview

Web Gallery is a **self-hosted Next.js application** that:

1. **Scrapes** media from external platforms (Twitter/X, Pixiv, Gelbooru, etc.) using the `gallery-dl` CLI tool.
2. **Scans** the downloaded files, extracts platform metadata from co-located JSON files, and indexes everything into a local SQLite database.
3. **Serves** the indexed media through a web UI with multiple view modes: a masonry gallery, a chronological timeline, and curated collections.

The application runs as a single Node.js server process. There is no separate background worker — scraping and scanning run as in-process async tasks managed by singletons.

```
┌─────────────────────────────────────────────────────────────────┐
│                        Browser (Client)                         │
│           React 19 + CSS Modules + Lucide React Icons           │
└───────────────────────────┬─────────────────────────────────────┘
                            │  HTTP / fetch
┌───────────────────────────▼─────────────────────────────────────┐
│                   Next.js 16 App Router (Server)                │
│                                                                 │
│  ┌──────────────┐  ┌─────────────────┐  ┌────────────────────┐ │
│  │ Server Comps │  │  Route Handlers │  │  Server Actions    │ │
│  │ (SSR, reads) │  │  (API / reads)  │  │  (mutations only)  │ │
│  └──────┬───────┘  └────────┬────────┘  └────────┬───────────┘ │
│         │                   │                    │             │
│  ┌──────▼───────────────────▼────────────────────▼───────────┐ │
│  │                    lib/  (Server-only modules)             │ │
│  │                                                           │ │
│  │  ┌────────────┐  ┌─────────────────┐  ┌────────────────┐ │ │
│  │  │  lib/db/   │  │ lib/scrapers/   │  │ lib/library/   │ │ │
│  │  │  Drizzle + │  │ ScraperManager  │  │ Scanner +      │ │ │
│  │  │  SQLite    │  │ + Strategies    │  │ Processors     │ │ │
│  │  └─────┬──────┘  └────────┬────────┘  └───────┬────────┘ │ │
│  │        │                  │                   │           │ │
│  └────────┼──────────────────┼───────────────────┼───────────┘ │
└───────────┼──────────────────┼───────────────────┼─────────────┘
            │                  │                   │
    ┌───────▼──────┐  ┌────────▼───────┐  ┌────────▼─────────┐
    │  sqlite.db   │  │  gallery-dl    │  │  /downloads/     │
    │  (DATA_DIR)  │  │  subprocess    │  │  media files     │
    └──────────────┘  └────────────────┘  │  + JSON metadata │
                                          │  (MEDIA_DIR)     │
                                          └──────────────────┘
```

---

## 2. Directory Map

```
web-gallery/
├── src/
│   ├── app/                        # Next.js App Router
│   │   ├── actions/                # Server Actions (mutations, domain-split)
│   │   │   ├── debug.ts            #   Destructive debug helpers (production-guarded)
│   │   │   ├── gallery.ts          #   Gallery item mutations
│   │   │   ├── playlists.ts        #   Playlist CRUD mutations
│   │   │   ├── scanning.ts         #   Library scan control (start/stop)
│   │   │   ├── settings.ts         #   Settings updates & config sync
│   │   │   ├── sources.ts          #   Source CRUD
│   │   │   ├── tags.ts             #   Tag read/write
│   │   │   └── timeline.ts         #   Timeline mutations
│   │   ├── api/                    # Route Handlers (REST, client-side reads)
│   │   │   ├── avatar/             #   Avatar proxy + caching
│   │   │   ├── gallery/            #   Gallery item list (paginated)
│   │   │   ├── library/            #   Library scan status
│   │   │   ├── playlists/          #   Playlist read/write (REST)
│   │   │   ├── sources/            #   Source list + scrape status
│   │   │   ├── statistics/         #   Statistics data route
│   │   │   ├── tags/               #   Tag pagination route
│   │   │   │   └── children/       #     Retrieve child tags (offset pagination)
│   │   │   └── timeline/           #   Timeline post list (paginated)
│   │   ├── gallery/                # Masonry gallery page
│   │   ├── timeline/               # Chronological post feed page
│   │   ├── sources/                # Source management page
│   │   ├── settings/               # Settings configuration page
│   │   ├── library/                # Library scan control page
│   │   ├── scrape/                 # Scrape trigger page
│   │   ├── tags/                   # Tag statistics page
│   │   │   └── manage/             #   Tag management dashboard
│   │   ├── playlists/              # Playlist / collection management
│   │   ├── statistics/             # Statistics & dashboard page
│   │   ├── downloads/              # Local file serving handler
│   │   ├── avatars/                # Avatar image route handler
│   │   ├── globals.css             # Design tokens (HSL variables, dark/light themes)
│   │   ├── layout.tsx              # Root layout + metadata template
│   │   ├── loading.tsx             # Root loading skeleton
│   │   ├── error.tsx               # Root error boundary
│   │   └── not-found.tsx           # 404 page
│   ├── components/                 # Shared UI components
│   │   ├── Lightbox.tsx            #   Full-screen media viewer
│   │   ├── MasonryGrid.tsx         #   CSS columns masonry layout
│   │   ├── Navbar.tsx              #   Top navigation bar + theme toggle
│   │   ├── ThemeProvider.tsx       #   Dark/light theme via data-theme attribute
│   │   ├── FormattedContent.tsx    #   Renders post body (links, hashtags, mentions)
│   │   ├── InfiniteScrollSentinel.tsx # IntersectionObserver-based infinite scroll trigger
│   │   ├── AddToPlaylistModal.tsx  #   Modal to add media items to a playlist
│   │   └── TagAutocompleteInput.tsx #  Input with autocomplete suggestions for tags
│   ├── hooks/                      # Shared custom React hooks
│   │   ├── useAutoplayVideo.ts     #   IntersectionObserver-based video autoplay
│   │   ├── useDebouncedValue.ts    #   Debounce for search/sort inputs
│   │   ├── useInfiniteScroll.ts    #   Manages IntersectionObserver sentinel
│   │   ├── useLightbox.ts          #   Lightbox open/close/navigate state
│   │   ├── usePaginatedData.ts     #   Generic cursor-based pagination + fetch
│   │   └── useSelection.ts         #   Multi-item selection state
│   ├── types/                      # Shared TypeScript interfaces
│   │   ├── media.ts                #   MediaItem, GalleryGroup, GalleryRow
│   │   ├── playlist.ts             #   Playlist, playlist-related types
│   │   ├── posts.ts                #   TimelinePost, post-related types
│   │   ├── settings.ts             #   SystemSettings, AppSettings definitions
│   │   ├── source.ts               #   Source, source-related types
│   │   ├── statistics.ts           #   Statistics data structures & types
│   │   └── users.ts                #   TwitterUser, PixivUser
│   ├── lib/                        # Server-only business logic
│   │   ├── config.ts               #   Centralized path config (DATA_DIR / MEDIA_DIR)
│   │   ├── metadata.ts             #   Shared metadata extraction helpers
│   │   ├── request-queue.ts        #   Rate-limited avatar fetch queue (singleton)
│   │   ├── settings.ts             #   Settings management (conf sync, log purger)
│   │   ├── db/
│   │   │   ├── index.ts            #   DB client init + custom migration runner
│   │   │   ├── schema.ts           #   Drizzle table definitions + relations
│   │   │   └── repositories/       #   Domain queries (media.ts, posts.ts, sources.ts, statistics.ts)
│   │   ├── library/
│   │   │   ├── scanner.ts          #   Main sync orchestrator (syncLibrary)
│   │   │   ├── types.ts            #   ProcessTask, ProcessorContext, etc.
│   │   │   └── processors/         #   Per-platform metadata extractors
│   │   │       ├── base.ts         #     BaseMetadataProcessor interface
│   │   │       ├── factory.ts      #     MetadataProcessorFactory (Strategy selector)
│   │   │       ├── twitter.ts      #     Twitter/X metadata processor
│   │   │       ├── pixiv.ts        #     Pixiv metadata processor
│   │   ├── scrapers/
│   │   │   ├── manager.ts          #   ScraperManager singleton (start/stop/status)
│   │   │   ├── runner.ts           #   ScraperRunner (spawns child process)
│   │   │   ├── types.ts            #   ScrapeProgress, shared scraper types
│   │   │   └── strategies/         #   Per-tool CLI argument builders
│   │   │       ├── base.ts         #     BaseScraperStrategy interface
│   │   │       ├── gallery-dl.ts   #     gallery-dl CLI strategy
│   │   │       └── yt-dlp.ts       #     yt-dlp CLI strategy (stub)
│   │   ├── scheduler/
│   │   │   └── scheduler.ts        #   TaskScheduler singleton (FIFO queue, Croner)
│   │   └── utils/
│   │       ├── format.ts           #   formatBytes, parseSizeToBytes, formatDate
│   │       └── search-parser.ts    #   FTS5 query parser + column alias allowlist
│   └── instrumentation.ts          # Next.js boot hook (DB init + stale record cleanup)
├── drizzle/                        # Generated SQL migration files
│   └── meta/_journal.json          # Migration journal
├── tests/                          # Playwright E2E tests
├── Dockerfile                      # Multi-stage production image
├── compose.yaml                    # Docker Compose (production)
├── compose.debug.yaml              # Docker Compose (debug/dev)
├── compose.test.yaml               # Docker Compose (E2E test runner)
├── gallery-dl-default.conf         # Default gallery-dl configuration template
├── docker-entrypoint.sh            # Entrypoint: creates symlinks DATA_DIR↔public/
├── drizzle.config.ts               # Drizzle Kit configuration
├── next.config.ts                  # Next.js config (standalone output, security headers)
├── biome.json                      # Biome linter/formatter config
└── playwright.config.ts            # Playwright test configuration
```

---

## 3. Subsystems

### 3.1 Boot & Initialization

**Entry point**: [`src/instrumentation.ts`](./src/instrumentation.ts)

Next.js calls `register()` once at server startup (Node.js runtime only, not during Edge builds). It performs three critical tasks before any request is served:

1. **`initDb()`** — initializes the SQLite connection and applies pending migrations via the custom `applyMigrations()` runner (see §3.2).
2. **`cleanupStaleScans()`** — finds any `scan_history` rows left as `"running"` from a previous crash/restart and marks them `"stopped"`. This makes the DB the source of truth for scan state.
3. **`taskScheduler.init()`** — initializes the task scheduler by reading all enabled scraping tasks from the database and starting their in-memory cron schedules (see §3.8).

Additionally, `instrumentation.ts` registers global `uncaughtException` and `unhandledRejection` handlers to ensure fatal errors are logged with full stack traces before the process exits.

### 3.2 Database Layer

**Location**: [`src/lib/db/`](./src/lib/db/)

| File | Role |
|------|------|
| `index.ts` | Creates the `@libsql/client` connection, exports the Drizzle `db` instance, and implements the custom migration runner. |
| `schema.ts` | All table definitions and `relations()` for Drizzle's relational query API. |
| `repositories/` | Domain-specific query functions — the only place raw Drizzle queries should appear outside of `scanner.ts`. |

**Custom Migration Runner** (`applyMigrations`): Rather than using Drizzle's built-in `migrate()`, a custom runner reads `drizzle/meta/_journal.json`, replays each SQL file, and tolerates `"already exists"` / `"duplicate column name"` errors. This handles databases previously bootstrapped with `drizzle-kit push` without requiring a destructive reset.

**Driver**: `@libsql/client` (async). All DB calls are `await`-ed. Synchronous `.run()` is never used.

**Relational Queries**: Drizzle's `db.query.*` API with `with:` for eager-loading is preferred over manual `leftJoin` calls.

**Full-Text Search**: The `posts` table is backed by a SQLite FTS5 virtual table. Column aliases and the filter allowlist are maintained in [`src/lib/utils/search-parser.ts`](./src/lib/utils/search-parser.ts).

**Search Autocomplete**: Implements a Discord-style two-phase search suggestions dropdown (suggesting filter columns and matching database values) driven by `useSearchAutocomplete`, a dedicated repository (`src/lib/db/repositories/autocomplete.ts`), and the `/api/autocomplete` Route Handler. Typing/selection queries are debounced, and live-search pagination refetches are suppressed while the autocomplete popover is active to minimize overhead.

**Search Expansion & Tag Hierarchies**: When executing searches, if `implicitHierarchyFiltering` is enabled, the system uses recursive Common Table Expressions (CTEs) via `expandSearchTags` (defined in `src/lib/db/repositories/posts.ts` and `media.ts`) to expand the query tags. This recursively retrieves all child tags of the searched tag, allowing queries to match posts annotated with more specific descendant tags.

### 3.3 Scraping Subsystem

**Location**: [`src/lib/scrapers/`](./src/lib/scrapers/)

The scraping subsystem uses two design patterns:

- **Singleton** (`ScraperManager`) — manages the lifecycle of all active scrape processes (start, stop, status).
- **Strategy** (`BaseScraperStrategy` → `GalleryDlStrategy` / `YtDlpStrategy`) — encapsulates the CLI arguments and output parsing for each tool.

```
ScraperManager (singleton)
  └── ScraperRunner.run(type, options, limits)
        └── BaseScraperStrategy.buildArgs() → spawn(child_process)
              ├── stdout parsing → onProgress callback
              └── resolves/rejects ScraperResult
```

**Lifecycle**:

1. `startScrape()` creates a `scrape_history` row (status: `"running"`) and a log file.
2. `ScraperRunner` spawns the child process and streams stdout back via `onProgress`.
3. Progress is written to `scrape_history` at most every 5 seconds (throttled).
4. On completion, the history row is finalized and `syncLibrary()` is triggered automatically.
5. The `ScraperManager` holds the completed status in memory for 30 seconds so the UI can display the final result before the entry is evicted.
6. On restart, the singleton constructor marks any in-memory-orphaned `"running"` history rows as `"failed"` (zombie cleanup).

**Global singleton pattern**: Both `ScraperManager` and `RequestQueue` attach themselves to `globalThis` in development to survive Next.js Hot Module Replacement without spawning duplicate instances.

### 3.4 Library Scanner

**Location**: [`src/lib/library/`](./src/lib/library/)

The scanner uses a module-level FIFO scan queue (`queueScan()`) to serialize all library scans sequentially rather than dropping concurrent scan requests. It supports two modes: **Full Scan** (walks the entire download directory, index everything, and purge deleted items) and **Incremental Scan** (precision walks only the directories containing new/updated files, processes only the targeted files, and skips deletion checks entirely for high-speed scrape integration).

```
queueScan() / queueIncrementalScan()
  └── FIFO Queue
        └── syncLibrary(options)
              ├── File Discovery:
              │     ├── Full: Walk DOWNLOAD_DIR recursively
              │     └── Incremental: Walk only parent dirs of targetFiles
              ├── Group files by dir → dirGroups (media + JSON per directory)
              ├── Load in-memory caches (existing media paths, users, posts, tags)
              ├── Match media files ↔ JSON files (exact, prefix, or contains)
              ├── Build ProcessTask list:
              │     ├── Full: Process all matched tasks
              │     └── Incremental: Filter to tasks where media or JSON is in targetFiles
              ├── Batched DB transactions (BATCH_SIZE = 100)
              │     └── For each task:
              │           ├── prepareTask() — read JSON + stat the file
              │           ├── MetadataProcessorFactory.getProcessor(extractorType)
              │           │     └── processor.process(meta, task, context)
              │           │           ├── Upsert platform user
              │           │           ├── Upsert post + details
              │           │           └── Upsert tags
              │           └── Insert/update mediaItems row
              └── Deletion cleanup (Full scan only)
```

**Processors** follow the Strategy + Factory pattern:
- `MetadataProcessorFactory.getProcessor(extractorType)` returns the right processor for `"twitter"`, `"pixiv"`, or `"gelbooruv02"`.
- Each processor implements `BaseMetadataProcessor.process()`.
- Adding a new platform = implementing a new processor file and registering it in `factory.ts`. No base class changes needed.

**Memory management**: `libsql` leaks ~0.85 MB of native memory per `db.transaction()` call. Batching 100 items per transaction keeps this bounded (~60 transactions for 6,000 items ≈ 51 MB vs. 5.1 GB for per-item transactions).

**Stale scan cleanup**: Both `instrumentation.ts` (at boot) and `stopScanning()` (on manual stop) clean up any `scan_history` rows stuck in `"running"` state.

### 3.5 Next.js Application Layer

**Location**: [`src/app/`](./src/app/)

Every data-fetching page follows a two-layer pattern:

| File | Runtime | Role |
|------|---------|------|
| `page.tsx` | Server | `async` Server Component — fetches initial data, passes as props |
| `page-client.tsx` | Client | `'use client'` — handles interactivity (search, selection, infinite scroll) |

**Server Actions** (`src/app/actions/`) are used **only for mutations** (form submissions, triggering scrapes, deleting items). They are split by domain and must never be used for reads.

**Route Handlers** (`src/app/api/`) serve paginated, filterable data for client-side fetching (infinite scroll, dynamic filtering). They are the only correct place for client-side `fetch()` calls.

**Pagination**: All list endpoints use **cursor-based** pagination (not offset). The repository returns `{ items, nextCursor }`. The client passes `cursor` back to the Route Handler on "Load More".

**Component structure per page**:
```
src/app/gallery/
├── page.tsx              # Server Component (initial data fetch)
├── page-client.tsx       # Client Component (state, callbacks, layout)
├── components/           # Sub-components (pure rendering)
│   ├── FilterBar.tsx
│   ├── GalleryItem.tsx
│   ├── BulkActionBar.tsx
│   └── BulkTagPopover.tsx    #   Popover for bulk tagging selected gallery items
└── page.module.css       # Shared CSS for this page and all sub-components
```

Sub-components import the parent page's `page.module.css` to keep class name hashing consistent.

### 3.6 Avatar Proxy & Request Queue

**Location**: [`src/app/api/avatar/`](./src/app/api/avatar/), [`src/lib/request-queue.ts`](./src/lib/request-queue.ts)

External avatar URLs are proxied through the Next.js server to avoid CORS issues and to enable local caching. Requests are serialized through `RequestQueue`, a rate-limiting FIFO queue that fires at most 5 requests per second (200 ms interval). The queue is a singleton attached to `globalThis` to survive HMR.

### 3.7 Settings & Configuration System

**Location**: [`src/app/settings/`](./src/app/settings/), [`src/lib/settings.ts`](./src/lib/settings.ts)

The settings system manages core application preferences and CLI scraper profiles with a unified, type-safe persistence layer:

- **JSON Persistence**: All settings are serialized to `$DATA_DIR/settings.json`. At startup or if missing, it attempts to back-populate fields by loading any pre-existing `$DATA_DIR/scrapers/gallery-dl/gallery-dl.conf` before falling back to `DEFAULT_SETTINGS` defined in `src/types/settings.ts`.
- **Dynamic Scraper Config Injection**: On settings updates and scraper executions, the system dynamically merges scraper settings (proxies, request throttling/sleep intervals, retries, cookie sources) into `$DATA_DIR/scrapers/gallery-dl/gallery-dl.conf` by reading and parsing the template config or modifying the existing file.
- **Log Retention Purging**: Integrated directly with Next.js boot (`instrumentation.ts`), the settings layer automatically cleans up physical scraper logs and clear references in the `scrape_history` DB table that exceed the configured `scrapeLogRetentionDays` limit.
- **Production Guarding**: Standardizes UI color schemes (`colorTheme`), pagination counts, scroll feed modes (`infinite` waterfall vs. explicit `button` loaders), and production environments' execution permissions (`enableProductionDestructiveOps`) to safeguard sqlite truncation or directory clears in deployment.
- **Implicit Hierarchy Filtering**: Standardizes the behavior of queries when fetching media/posts. If `implicitHierarchyFiltering` is enabled, search queries automatically expand to include matching tags and their descendants recursively using a recursive CTE.

### 3.8 Task Scheduling Subsystem

**Location**: [`src/lib/scheduler/`](./src/lib/scheduler/)

The Task Scheduling Subsystem enables recurring scraper executions for automation:

- **Croner & SQLite**: Uses `Croner` for in-memory, high-precision schedule timers. Configured cron expressions (`scheduleCron`) and intervals in seconds (`scheduleInterval`) are persisted in the local SQLite database to survive server restarts.
- **Singleton Pattern**: Managed via a global `TaskScheduler` singleton to persist schedules through Next.js Hot Module Replacement (HMR) during development without spawning duplicate cron registrations.
- **FIFO Queue Serialization**: To prevent database write contention and SQLite locks during concurrent scheduled operations, scheduled tasks are enqueued into a sequential FIFO queue. A scheduled execution awaits the completion of any previous scraper run before starting.

**Flow**:
1. On boot, `taskScheduler.init()` reads enabled scraping tasks from the SQLite database.
2. Interval-based tasks are mapped to equivalent Cron expressions (e.g., `*/30 * * * * *` for 30s) so they can also use Croner's high-precision triggers and next-run calculations.
3. When a Cron job fires, it enqueues the task to the execution queue (`taskScheduler.enqueue()`) and calculates + updates `nextRunAt` in the database.
4. The queue executes tasks sequentially, calling `scraperManager.startScrape()` and polling for completion.

### 3.9 Statistics Subsystem

**Location**: [`src/lib/db/repositories/statistics.ts`](./src/lib/db/repositories/statistics.ts)

The Statistics Subsystem provides pre-computed counters and historical growth metrics to drive the dashboard:

- **Pre-Computed Snapshot**: The `library_statistics` table acts as a single-row caching layer for aggregate counts of posts, media items, tags, users, extractors, and overall storage bytes. It also tracks `totalCanonicalTags`, which counts only non-aliased tags. This avoids running heavy `COUNT(*)` queries on page loads.
- **Scanner & Repository Triggers**: 
  - After any full library scan, the scanner calls `recomputeStatistics()` to rebuild precise aggregates, then calls `recordHistorySnapshot()` to append or update daily growth history.
  - Increment-based adjustments: Targeted operations, such as deleting media items via `deleteMediaItems()`, trigger `incrementStatistics(delta)` to deduct counters and storage sizes atomically in real-time.
- **Proportional Timeline Distribution**: For historical charts, cumulative growth is tracked daily in `statistics_history`. If a metric lacks historical timestamps (such as tags or user entries), the repository maps them proportionally to the daily posts import velocity to provide clean growth curves.
- **REST Endpoints & Client Rendering**: The dashboard fetches its data on-demand from `/api/statistics` for modular caching and instant filters (date granularity, range limits, active page sorting).

---

## 4. Data Flow

### 4.1 Scrape → Scan → Display

```
User clicks "Scrape"
        │
        ▼
Server Action (actions/sources.ts)
        │
        ▼
ScraperManager.startScrape(sourceId, type, url, downloadDir)
        │
        ├── Creates scrape_history row (status: "running")
        ├── ScraperRunner.run() → spawns gallery-dl subprocess
        │       └── stdout → onProgress → throttled DB updates
        │
        ▼ (on completion)
ScraperManager finalizes scrape_history
        │
        ▼
queueIncrementalScan(result.items)
        │
        ▼
Scan Queue (FIFO serialization)
        │
        ▼
syncLibrary({ targetFiles, scanType: "incremental" })
        │
        ├── Walks only parent directories of targetFiles
        ├── Matches media ↔ JSON within those directories
        ├── Filters ProcessTask list to only new/updated files
        ├── MetadataProcessorFactory → processor.process()
        │       └── Upserts: users, posts, post_details_*, tags, mediaItems
        └── Finalizes scan_history (status: "completed", type: "incremental")
                │
                ▼
        Gallery / Timeline pages now show new content
```

### 4.2 Client-Side Data Fetching

```
page.tsx (Server Component)
  └── Fetches initial data (first 50 items)
  └── Renders <PageClient initialItems={items} initialNextCursor={cursor} />

page-client.tsx ('use client')
  └── usePaginatedData(apiRoute, filters)
        └── fetch(`/api/gallery?cursor=X&search=Y&sortBy=Z`)
              └── Route Handler → Repository → DB → JSON response
```

---

## 5. Database Schema

The schema is defined in [`src/lib/db/schema.ts`](./src/lib/db/schema.ts).

```
gallerydl_extractor_types   (id: 'twitter' | 'pixiv' | 'gelbooruv02' | ...)
         │
         └──< sources (url, name, extractor_type, soft-delete via deletedAt)
                  │
                  ├──< scraping_tasks (schedule, download options)
                  │        │
                  │        └──< scrape_history (run log, metrics, resume cursor)
                  │
                  └──< posts (generic: jsonSourceId, date, content, url)
                           │
                           ├──  post_details_twitter   (engagement, lang, sensitivity)
                           ├──  post_details_pixiv     (dimensions, tags, AI type)
                           ├──  post_details_gelbooruv02 (rating, score, md5, tags)
                           │
                           └──< media_items (filePath, mediaType, capturedAt)
                                    │
                                    └──< playlist_items (position, addedAt)
                                              │
                                              └──> playlists (name, description, thumbnail)

                 ┌── aliasOfTagId (self-ref FK)
                 ├── parentTagId (self-ref FK)
tag_categories ──< tags ──< post_tags >──< posts
                    │
                    └──< tag_relations (symmetric pair join)

twitter_users  (profile, stats — standalone, linked via posts.userId)
pixiv_users    (profile — standalone, linked via posts.userId)

scan_history   (standalone: run log for library syncs)
scraper_download_logs  (sourceId → filePath mapping for source attribution)
library_statistics (standalone: pre-computed snapshot counters, tracking totalCanonicalTags)
statistics_history (standalone: daily snapshots for historical cumulative growth, tracking totalCanonicalTags)
```

**Key relationships**:
- `posts.internalSourceId → sources.id` (which Source URL produced this post)
- `media_items.postId → posts.id` (`SET NULL` on delete — media survives post deletion)
- `playlist_items` is the many-to-many join between `media_items` and `playlists` (maintaining order position)
- `post_tags` is the many-to-many join between `posts` and `tags`
- `tags.categoryId → tag_categories.id` (`SET NULL` on delete — assigns a customizable HSL-colored category to a tag)
- `tags.aliasOfTagId → tags.id` (self-referencing flat alias relationship; maps a tag to its canonical equivalent)
- `tags.parentTagId → tags.id` (self-referencing hierarchical parent relationship)
- `tag_relations` is the symmetric many-to-many join table between related tags, constrained by `tag_id < related_tag_id` to prevent duplicate pairs
- Platform detail tables (`post_details_*`) are one-to-one with `posts`

---

## 6. Storage Layout

Persistent data is split across two configurable roots to support separating fast storage (SSD) from bulk storage (HDD):

| Env var | Default (dev) | Purpose |
|---------|---------------|---------|
| `DATA_DIR` | `process.cwd()` | Fast I/O: SQLite DB, scraper archives, logs |
| `MEDIA_DIR` | `process.cwd()` | Bulk storage: downloaded media, cached avatars |

Resolved paths (see [`src/lib/config.ts`](./src/lib/config.ts)):

```
DATA_DIR/
├── sqlite.db
├── settings.json       # Centralized application settings config
└── scrapers/
    └── gallery-dl/
        ├── gallery-dl.conf     # Dynamic/isolated scraper config
        ├── archives/           # gallery-dl URL archives (skip-already-downloaded)
        └── logs/               # Per-scrape log files (scrape_<historyId>.log)

MEDIA_DIR/
├── downloads/                  # Downloaded media + JSON metadata
│   └── <platform>/<user>/
│       ├── <id>.jpg
│       └── <id>.json
└── avatars/                    # Cached avatar images
```

**Docker serving**: Downloads and avatars are served dynamically by Next.js Route Handlers (`src/app/downloads/[[...path]]/route.ts` and `src/app/avatars/[[...path]]/route.ts`) which read directly from `$MEDIA_DIR/downloads` and `$MEDIA_DIR/avatars`.

This ensures that Next.js successfully serves static files even when bulk media resides on a separate volume, without requiring complex symlinking or hosting overrides.

---

## 7. Deployment

### Development

```bash
npm run dev          # Next.js dev server (localhost:3000)
npm run db:generate  # Generate SQL migrations from schema changes
npm run db:migrate   # Apply pending migrations
npm run test:e2e     # Run Playwright E2E tests
```

### Docker (Production)

The `Dockerfile` uses a multi-stage build with `output: "standalone"` to produce a minimal self-contained server bundle. `@libsql/client` is listed in `serverExternalPackages` to prevent Turbopack from bundling its native bindings.

```bash
docker compose up          # Production stack
docker compose -f compose.debug.yaml up  # With bind-mounted source
docker compose -f compose.test.yaml up   # E2E test runner
```

### Standalone Binary Packaging (Production Releases)

Web Gallery can be compiled into a single executable binary for Linux, macOS, and Windows. This is designed for users who want to run the application natively without setting up a Node.js runtime or Docker.

- **Packaging Engine**: `@yao-pkg/pkg` in **SEA (Single Executable Application)** Mode.
- **Virtual File System (VFS)**: Frontend assets (`.next/static`, `public` favicon/images), database migrations (`drizzle/`), and configuration templates are packaged directly inside the executable. The VFS layer intercepts `fs` module operations and maps files to `/snapshot/web-gallery/` at runtime, allowing the app to read static files and run database migrations out of the binary itself.
- **Data Persistence**: Writable operations (like database updates to `sqlite.db` or writing settings to `settings.json`) bypass the read-only VFS and resolve to the real host filesystem (falling back to the current working directory, or controlled via `DATA_DIR` and `MEDIA_DIR` environment variables). These environment variables, along with server port and hostname, can also be configured using a `.env` file placed next to the binary at runtime.
- **Local Dependencies (`./bin/`)**: The scraper runner and dimension utilities search for `gallery-dl`, `ffmpeg`, and `ffprobe` in a local `./bin/` folder first. This enables a portable, self-contained deployment using setup scripts (`scripts/setup-deps.sh` or `scripts/setup-deps.ps1`) to download dependencies.

**Security headers** (configured in `next.config.ts`, applied to all routes):
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`

> **Note on CSP**: A Content Security Policy is intentionally not configured. The application renders media from arbitrary external domains scraped at runtime, making a meaningful CSP infeasible without blocking core functionality.

---

## 8. Key Design Decisions

### Singleton singletons survive HMR
`ScraperManager` and `RequestQueue` are attached to `globalThis` in development mode. This prevents Next.js Hot Module Replacement from creating duplicate instances that would spawn extra child processes or lose track of active scrapes.

### Custom migration runner instead of `drizzle-kit migrate`
The built-in Drizzle migrator fails when schema objects already exist (from prior `drizzle-kit push` usage). The custom `applyMigrations()` tolerates `"already exists"` and `"duplicate column name"` errors, allowing a seamless transition from push-managed to migration-managed databases.

### DB as source of truth for long-running task state
Scrape and scan state is written to the database (`scrape_history`, `scan_history`) as tasks run. On restart, boot hooks clean up any `"running"` records. This means the UI always reflects a consistent state regardless of crashes, without needing a persistent message queue or external state store.

### Batch transactions for scanner memory safety
`libsql` leaks ~0.85 MB of native memory per `db.transaction()` call. The scanner batches 100 items per transaction to keep total overhead manageable for large libraries (thousands of files).

### Server Actions = mutations only; Route Handlers = reads
This separation makes it straightforward to reason about where side effects can occur and keeps the data-fetching path cacheable and independent.

### Platform metadata via Strategy + Factory, never if/else in base
Adding a new platform (e.g. Instagram) requires only a new processor file and a one-line factory registration. No existing processors or base classes are modified, minimizing regression risk.

### Split DATA_DIR / MEDIA_DIR
Separating fast-access data (database, scraper state) from bulk media allows operators to put the SQLite database on an SSD while storing potentially hundreds of gigabytes of media on a cheaper HDD — a common NAS/homelab setup.

### FIFO schedule execution for SQLite safety
To prevent multiple concurrent scheduled scraping tasks from locking or corrupting the SQLite database, all scheduled runs are serialized through a sequential FIFO queue. The next scheduled task begins execution only after the current scraper process completes and its database synchronization finishes.

---

## 9. Testing Architecture

Testing in Web Gallery is split into two primary layers: **E2E Tests** (via Playwright) and **Unit/Integration Tests** (via Vitest). 

### 9.1 Playwright E2E Tests
- **Scope**: Validates complete user-facing browser flows (e.g. settings updates, gallery interaction, media deletion, scraper scheduling) on a running production Next.js build.
- **Isolation**: Runs against a pre-built Docker container defined in `compose.test.yaml`, pointing to a dedicated test SQLite file and downloads folder.
- **Concurrency**: State-modifying tests (scrapers, settings) are run sequentially (via Playwright serial projects configured in `playwright.config.ts`) to avoid SQLite file lock contentions.

### 9.2 Vitest Unit/Integration Tests
- **Scope**: Directly tests database repositories (`src/lib/db/repositories/`) and Server Actions (`src/app/actions/`) in isolation.
- **In-Memory SQLite DB**: To ensure speed, zero host dependency, and perfect isolation, tests execute against a lightweight in-memory SQLite database instance (`:memory:`).
- **Dynamic Schema Generation**: At setup, the test helper reads `drizzle/meta/_journal.json` to identify all migration files and dynamically executes the generated SQL script-by-script to build the database schema in memory.
- **Drizzle Interception**: Tests leverage a live getter mock binding for `@/lib/db` to intercept Drizzle calls at import time and redirect them to the active test database.
- **Mocking and Spying**: Built-in NodeJS ESM modules (such as `node:fs` and `node:fs/promises` for statistics and media deletions) are mocked using `vi.mock` wrappers with actual fallbacks (`vi.importActual`) to intercept specific target directories without breaking the migration SQL reader.
- **CI/CD Integration**: The unit test suite is run automatically on every push and pull request via a GitHub Action (`.github/workflows/unit-tests.yml`).


