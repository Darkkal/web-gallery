# Architecture

This document describes the high-level architecture of **Personal Web Gallery**: how the system is structured, how its major subsystems interact, and the key design decisions behind them.

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
4. [Data Flow](#4-data-flow)
   - [4.1 Scrape → Scan → Display](#41-scrape--scan--display)
   - [4.2 Client-Side Data Fetching](#42-client-side-data-fetching)
5. [Database Schema](#5-database-schema)
6. [Storage Layout](#6-storage-layout)
7. [Deployment](#7-deployment)
8. [Key Design Decisions](#8-key-design-decisions)

---

## 1. System Overview

Personal Web Gallery is a **self-hosted Next.js application** that:

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
│   │   │   ├── scanning.ts         #   Library scan control (start/stop)
│   │   │   ├── sources.ts          #   Source CRUD
│   │   │   ├── tags.ts             #   Tag read/write
│   │   │   └── timeline.ts         #   Timeline mutations
│   │   ├── api/                    # Route Handlers (REST, client-side reads)
│   │   │   ├── avatar/             #   Avatar proxy + caching
│   │   │   ├── gallery/            #   Gallery item list (paginated)
│   │   │   ├── library/            #   Library scan status
│   │   │   ├── sources/            #   Source list + scrape status
│   │   │   └── timeline/           #   Timeline post list (paginated)
│   │   ├── gallery/                # Masonry gallery page
│   │   ├── timeline/               # Chronological post feed page
│   │   ├── sources/                # Source management page
│   │   ├── library/                # Library scan control page
│   │   ├── scrape/                 # Scrape trigger page
│   │   ├── tags/                   # Tag browser page
│   │   ├── playlists/              # Playlist / collection management
│   │   ├── downloads/              # Download management page
│   │   ├── avatars/                # Avatar image route
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
│   │   └── ScrollModeToggle.tsx    #   Waterfall vs. standard scroll toggle
│   ├── hooks/                      # Shared custom React hooks
│   │   ├── useDebouncedValue.ts    #   Debounce for search/sort inputs
│   │   ├── useInfiniteScroll.ts    #   Manages IntersectionObserver sentinel
│   │   ├── useLightbox.ts          #   Lightbox open/close/navigate state
│   │   ├── usePaginatedData.ts     #   Generic cursor-based pagination + fetch
│   │   ├── useScrollMode.tsx       #   Scroll mode persistence (localStorage)
│   │   └── useSelection.ts         #   Multi-item selection state
│   ├── types/                      # Shared TypeScript interfaces
│   │   ├── media.ts                #   MediaItem, GalleryGroup, GalleryRow
│   │   ├── posts.ts                #   TimelinePost, post-related types
│   │   ├── source.ts               #   Source, source-related types
│   │   └── users.ts                #   TwitterUser, PixivUser
│   ├── lib/                        # Server-only business logic
│   │   ├── config.ts               #   Centralized path config (DATA_DIR / MEDIA_DIR)
│   │   ├── metadata.ts             #   Shared metadata extraction helpers
│   │   ├── request-queue.ts        #   Rate-limited avatar fetch queue (singleton)
│   │   ├── db/
│   │   │   ├── index.ts            #   DB client init + custom migration runner
│   │   │   ├── schema.ts           #   Drizzle table definitions + relations
│   │   │   └── repositories/       #   Domain queries (media.ts, posts.ts, sources.ts)
│   │   ├── library/
│   │   │   ├── scanner.ts          #   Main sync orchestrator (syncLibrary)
│   │   │   ├── types.ts            #   ProcessTask, ProcessorContext, etc.
│   │   │   └── processors/         #   Per-platform metadata extractors
│   │   │       ├── base.ts         #     BaseMetadataProcessor interface
│   │   │       ├── factory.ts      #     MetadataProcessorFactory (Strategy selector)
│   │   │       ├── twitter.ts      #     Twitter/X metadata processor
│   │   │       ├── pixiv.ts        #     Pixiv metadata processor
│   │   │       └── gelbooru.ts     #     Gelbooru/Safebooru metadata processor
│   │   ├── scrapers/
│   │   │   ├── manager.ts          #   ScraperManager singleton (start/stop/status)
│   │   │   ├── runner.ts           #   ScraperRunner (spawns child process)
│   │   │   ├── types.ts            #   ScrapeProgress, shared scraper types
│   │   │   └── strategies/         #   Per-tool CLI argument builders
│   │   │       ├── base.ts         #     BaseScraperStrategy interface
│   │   │       ├── gallery-dl.ts   #     gallery-dl CLI strategy
│   │   │       └── yt-dlp.ts       #     yt-dlp CLI strategy (stub)
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

Next.js calls `register()` once at server startup (Node.js runtime only, not during Edge builds). It performs two critical tasks before any request is served:

1. **`initDb()`** — initializes the SQLite connection and applies pending migrations via the custom `applyMigrations()` runner (see §3.2).
2. **`cleanupStaleScans()`** — finds any `scan_history` rows left as `"running"` from a previous crash/restart and marks them `"stopped"`. This makes the DB the source of truth for scan state.

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

The scanner (`syncLibrary()`) walks the `downloads/` directory, groups files by parent directory, matches media files to their co-located JSON metadata files, and upserts everything into the database.

```
syncLibrary()
  ├── Walk DOWNLOAD_DIR → dirGroups (media + JSON per directory)
  ├── Load in-memory caches (existing media paths, users, posts, tags)
  ├── Match media files → JSON files (exact, prefix, or contains)
  ├── Build ProcessTask list
  └── Batched DB transactions (BATCH_SIZE = 100)
        └── For each task:
              ├── prepareTask() — read JSON + stat the file
              ├── MetadataProcessorFactory.getProcessor(extractorType)
              │     └── processor.process(meta, task, context)
              │           ├── Upsert platform user (twitterUsers / pixivUsers)
              │           ├── Upsert post + platform detail table
              │           └── Upsert tags → postTags
              └── Insert/update mediaItems row
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
│   └── BulkActionBar.tsx
└── page.module.css       # Shared CSS for this page and all sub-components
```

Sub-components import the parent page's `page.module.css` to keep class name hashing consistent.

### 3.6 Avatar Proxy & Request Queue

**Location**: [`src/app/api/avatar/`](./src/app/api/avatar/), [`src/lib/request-queue.ts`](./src/lib/request-queue.ts)

External avatar URLs are proxied through the Next.js server to avoid CORS issues and to enable local caching. Requests are serialized through `RequestQueue`, a rate-limiting FIFO queue that fires at most 5 requests per second (200 ms interval). The queue is a singleton attached to `globalThis` to survive HMR.

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
syncLibrary() triggered automatically
        │
        ├── Walks DOWNLOAD_DIR
        ├── Matches media ↔ JSON
        ├── MetadataProcessorFactory → processor.process()
        │       └── Upserts: users, posts, post_details_*, tags, mediaItems
        └── Finalizes scan_history (status: "completed")
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
                                    └──< collection_items
                                              │
                                              └──> collections

tags ──< post_tags >──< posts

twitter_users  (profile, stats — standalone, linked via posts.userId)
pixiv_users    (profile — standalone, linked via posts.userId)

scan_history   (standalone: run log for library syncs)
scraper_download_logs  (sourceId → filePath mapping for source attribution)
```

**Key relationships**:
- `posts.internalSourceId → sources.id` (which Source URL produced this post)
- `media_items.postId → posts.id` (`SET NULL` on delete — media survives post deletion)
- `collection_items` is the many-to-many join between `media_items` and `collections`
- `post_tags` is the many-to-many join between `posts` and `tags`
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
└── scrapers/
    └── gallery-dl/
        ├── gallery-dl.conf     # Isolated scraper config
        ├── archives/           # gallery-dl URL archives (skip-already-downloaded)
        └── logs/               # Per-scrape log files (scrape_<historyId>.log)

MEDIA_DIR/
├── downloads/                  # Downloaded media + JSON metadata
│   └── <platform>/<user>/
│       ├── <id>.jpg
│       └── <id>.json
└── avatars/                    # Cached avatar images
```

**Docker serving**: In the Docker image, `docker-entrypoint.sh` creates symlinks:
- `public/downloads → $MEDIA_DIR/downloads`
- `public/avatars → $MEDIA_DIR/avatars`

This lets Next.js's static file serving work unchanged while media lives on a separate volume.

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
