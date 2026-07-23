# Contributing Guidelines

This document outlines the established coding patterns, conventions, and rules for the Web-Gallery project. Whether you are a human developer or an AI agent, please adhere to these guidelines to ensure consistency.

For a high-level overview of the system architecture, subsystems, and key design decisions, see [ARCHITECTURE.md](./ARCHITECTURE.md).


---

## 1. Established Patterns

### 1.1 Data Fetching — Server Component + Route Handler Split

Every data-fetching page follows the same two-layer pattern:

1. **`page.tsx`** — An `async` Server Component that fetches initial data and passes it as props.
2. **`page-client.tsx`** — A `'use client'` component that handles interactivity (selection, search, infinite scroll).

```tsx
// page.tsx (Server Component)
export default async function GalleryPage({ searchParams }) {
    const params = await searchParams;
    const { items, nextCursor } = await getMediaItems({ search, sortBy, limit: 50 });
    return <GalleryPageClient initialItems={items} initialNextCursor={nextCursor} />;
}
```

For client-side data fetching (infinite scroll, dynamic filtering), use **Route Handlers** (`src/app/api/...`) with `fetch()`.

- **Rule**: Server Actions (`'use server'`) are strictly for **mutations** (form submissions, triggering scrapes, deleting items). Never use them for data reads.
- **Reference**: `/tags/page.tsx` and `/scrape/page.tsx` demonstrate the pure Server Component pattern (no client component needed).

### 1.2 Database — Drizzle with Relations, Async Everywhere

- **Driver**: `@libsql/client` (async). All DB calls use `await`.
- **Initialization**: `instrumentation.ts` calls `initDb()` at boot, which applies migrations with tolerance for databases previously managed with `drizzle-kit push`.
- **Schema**: `relations()` definitions exist in `schema.ts` — prefer `db.query` relational queries with `with:` for eager-loading over manual `leftJoin` calls.
- **Repositories**: `src/lib/db/repositories/` — `media.ts`, `posts.ts`, `sources.ts`. All filtering, sorting, and pagination is pushed to the database via SQL (`WHERE`, `ORDER BY`, `LIMIT`).

- **Rule**: Never fetch all rows and filter/sort in JavaScript. Always use Drizzle's query builder for filtering and pagination.
- **Rule**: Use async/await consistently. Never use synchronous `.run()` calls.

### 1.3 Cursor-Based Pagination

List endpoints use cursor-based pagination, not offset-based:

```ts
// Repository returns items + nextCursor
const { items, nextCursor } = await getMediaItems({ limit: 50, cursor });
```

Client pages consume this with a "Load More" button that calls the Route Handler with the cursor.

- **Exception**: Tree-structured endpoints that sort by computed aggregates (e.g., `/api/tags/children` sorted by child count) may use offset-based pagination when cursor stability cannot be guaranteed.

### 1.4 Scraping & Processing (Strategy & Factory Patterns)

- **Scraping**: `ScraperManager` singleton controls scraping tasks. Strategies implement `BaseScraperStrategy` → `GalleryDlStrategy`, `YtDlpStrategy`.
- **Library Scanning**: `MetadataProcessorFactory` handles metadata extraction per platform (Twitter, Pixiv, Gelbooru).
- **Rule**: When adding support for a new platform, implement a new strategy/processor. Never add `if/else` platform logic to base classes.
- **Rule**: Post-scrape scans must be incremental (file-level targeted via `queueIncrementalScan`) and go through the scan queue. The manual "Scan Library" button triggers a full scan via `queueScan({ scanType: "full" })`. Never call `syncLibrary()` directly — always use the queue functions to ensure serialization.
- **Rule**: If a new extractor introduces new searchable metadata columns that are added to the FTS5 virtual table, you MUST update the `ftsColumnAliases` dictionary in `src/lib/utils/search-parser.ts` to map any friendly search prefixes to the new FTS5 column. This dictionary doubles as the allowlist for valid column filters.
- **Rule**: Tag categories are resolved using query-time relationships. Metadata processors (like Gelbooru or E-Hentai) must strip category prefixes (e.g. `character:`, `artist:`, `copyright:`) from the tag name and map them to their corresponding `categoryId` from the preloaded `categoryMap` cache. Do not store prefixed tags in the database.
- **Rule**: Tag aliases must be flat. Do not chain aliases (e.g., Tag A → Tag B → Tag C). Instead, point all alias tags directly to the canonical tag (Tag A → Tag C, Tag B → Tag C).
- **Rule**: Tag hierarchies must prevent circular dependencies (e.g., a tag cannot be its own ancestor). A tag cannot have a parent tag if it is currently set as an alias of another tag, and circularity checks must be executed before applying parent relationships.
- **Rule**: Tag relations must be symmetric and are stored in the database with the constraint `tag_id < related_tag_id` to prevent duplicate pairs (e.g., storing both A-B and B-A). The application layer must enforce this constraint when inserting or querying relations.
- **Rule**: If the `implicitHierarchyFiltering` setting is active, search queries must dynamically expand query tags to include their child tags recursively using a recursive CTE (`expandSearchTags` in the repository layer).


### 1.5 Styling System — CSS Modules + Design Tokens

- **CSS Modules** (`[name].module.css`) are co-located with components.
- **Global tokens** are in `src/app/globals.css` using HSL format (`--background: 240 10% 3.9%`).
- **Semantic status colors** are defined as design tokens:
  - `--color-success`, `--color-info`, `--color-danger`, `--color-warning`, `--color-muted-label`
  - Both dark (`:root`) and light (`[data-theme='light']`) themes have overrides.

- **Rule**: NEVER use Tailwind utility classes — Tailwind is not installed.
- **Rule**: NEVER hardcode hex colors (`#4ade80`, `#888`) or inline `style={{ color: ... }}`. Use CSS Module classes referencing `hsl(var(--token))`.
- **Rule**: Only use inline `style={{}}` for truly dynamic runtime values (e.g., `backgroundImage` with a URL, conditional cursor styles). All static styling belongs in CSS Modules.
- **Rule**: Category badges and chip highlights must use inline styles to pass dynamic HSL color variables (`--tag-hue`, `--tag-sat`, `--tag-lgt`) populated from the category database values. These custom variables are then referenced using `hsl(var(--tag-hue) var(--tag-sat) var(--tag-lgt))` in the co-located CSS modules.
- **Rule**: For status indicators, use `data-attribute` selectors in CSS rather than conditional inline styles:

  ```tsx
  <span data-status={item.status}>{item.status}</span>
  ```

  ```css
  .badge[data-status="completed"] { color: hsl(var(--color-success)); }
  .badge[data-status="failed"]    { color: hsl(var(--color-danger)); }
  ```

### 1.6 Shared Hooks

Common UI logic is extracted into `src/hooks/`:

| Hook | Purpose | Used By |
|------|---------|---------|
| `useAutoplayVideo` | IntersectionObserver-based video autoplay with mute controls | Gallery, Timeline |
| `useDebouncedValue` | Debounced search/sort input | Gallery, Timeline |
| `useInfiniteScroll` | Manages IntersectionObserver sentinel for paginated feeds | Gallery, Timeline |
| `useLightbox` | Lightbox open/close/navigate state | Gallery, Timeline |
| `usePaginatedData` | Generic cursor-based pagination + fetch | Gallery, Timeline, Playlists |
| `useSearchAutocomplete` | Manages search query autocomplete dropdown state and keys | Gallery, Timeline |
| `useSelection` | Selection state (toggle, select-all, clear, group selection) | Gallery, Sources |

- **Rule**: When building a new page with selection, search, or lightbox behavior, consume these hooks rather than reimplementing the logic inline.

### 1.7 Shared Types

Frontend types are in `src/types/`:

| File | Contains |
|------|----------|
| `media.ts` | `MediaItem`, `GalleryGroup`, `GalleryRow` |
| `autocomplete.ts` | `AutocompleteSuggestion`, `AutocompleteResponse` definitions |
| `playlist.ts` | `Playlist`, playlist-related types |
| `posts.ts` | `TimelinePost`, post-related types |
| `settings.ts` | `SystemSettings`, `AppSettings` (including Lightbox fit, zoom, and auto-hide config) definitions |
| `source.ts` | `Source`, source-related types |
| `statistics.ts` | `LibraryStatistics`, `StatisticsHistoryPoint`, etc. |
| `users.ts` | `TwitterUser`, `PixivUser` |

- **Rule**: Import shared types from `@/types/`. Do not define inline interfaces in page components.

### 1.8 Component Extraction

Large pages are decomposed into sub-components under a `components/` directory co-located with the page:

```text
src/app/gallery/
├── page.tsx              # Server Component
├── page-client.tsx       # Client Component (orchestration)
├── components/
│   ├── FilterBar.tsx
│   ├── GalleryItem.tsx
│   └── BulkActionBar.tsx
└── page.module.css       # Shared styles for the page + sub-components
```

- **Rule**: Sub-components import the parent page's `page.module.css` (not their own CSS file) to keep class name hashing consistent.
- **Rule**: Keep data-fetching orchestration, mutation handlers, and state management in `page-client.tsx`. Extract pure UI rendering into `components/`.

### 1.9 Server Actions — Split by Domain

Server Actions are organized into `src/app/actions/` by domain:

```text
src/app/actions/
├── debug.ts      # Destructive debug actions (guarded)
├── gallery.ts    # Gallery mutations
├── playlists.ts  # Playlist CRUD mutations
├── scanning.ts   # Library scan control
├── settings.ts   # Settings updates & config sync
├── sources.ts    # Source CRUD
├── tags.ts       # Tag queries and mutations
└── timeline.ts   # Timeline mutations
```

- **Rule**: Do not create a monolithic `actions.ts` file. Co-locate actions with their domain page, or place them in `src/app/actions/` if shared.

### 1.10 Loading & Error Boundaries

Every route segment should have:

- **`loading.tsx`** — A skeleton/loading state component. Use `data-testid="loading-skeleton"` on skeleton elements for deterministic E2E testing.
- **`error.tsx`** — An error boundary that catches unexpected errors and provides a recovery path.

The root layout metadata uses a template pattern:

```ts
export const metadata: Metadata = {
  title: { default: "Web Gallery", template: "%s | Web Gallery" },
  description: "A personal media gallery for organizing and browsing downloaded content",
};
```

Individual pages export their own `metadata` for custom titles (e.g., `export const metadata: Metadata = { title: "Gallery" }`).

### 1.11 Security and Guidelines

- **Rule**: Any server action that performs destructive operations MUST call `assertNonProduction()` before proceeding. The guard checks both the Node environment and the settings bypass state:

  ```ts
  async function assertNonProduction() {
    const { getAppSettings } = await import("@/lib/settings");
    const settings = await getAppSettings();
    if (
      process.env.NODE_ENV === "production" &&
      !settings.enableProductionDestructiveOps
    ) {
      throw new Error("Debug actions are disabled in production");
    }
  }
  ```

- **Rule**: Never use `sql.raw()` with interpolated values. Use Drizzle's query builder or parameterized queries.
- **Security headers** are configured in `next.config.ts` (X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy).
- **Note**: Content Security Policy is intentionally not configured. This application scrapes arbitrary external content and renders it client-side, making a meaningful CSP infeasible for the current architecture.

- `next.config.ts` has wildcard `remotePatterns` for scraper-sourced content from arbitrary domains.
- Only use `unoptimized` on `next/image` for truly local file paths that bypass Next.js optimization. Images served through API routes (e.g., avatar proxy) should leverage Next.js image optimization.
- **Rule**: When passing local file paths (e.g., scraped media from `item.filePath`) to `<Image>` or `<video>` tags, you MUST wrap the path with `encodeFilePath()` from `@/lib/utils/format`. This ensures filenames containing characters like `?` or `#` are not truncated or misinterpreted by the browser as query parameters.

### 1.13 Task Scheduling (FIFO Queue and Croner)

- **Timers**: Scheduled scraping tasks use `Croner` for high-precision, in-memory timers.
- **Queue**: To prevent write contention and locks on the SQLite database, all scheduled runs are serialized sequentially through a module-level FIFO queue (`taskScheduler.enqueue()`).
- **Manual vs Scheduled**: Manual scraper runs (`runTaskNow` / "Run Now") bypass the scheduler queue to run immediately. Scheduled runs always go through the queue.
- **State Persistence**: The database columns `scheduleInterval` (seconds) and `scheduleCron` (cron pattern) are the sources of truth. On trigger, `nextRunAt` is immediately recalculated and written to the database.

### 1.14 Statistics Counters

- **Rule**: When implementing features that create or delete posts, media items, tags, users, or affect extractor coverage, you MUST update the pre-computed statistics. Use `incrementStatistics(delta)` for targeted counter adjustments (additions/deletions) or `recomputeStatistics()` for full accuracy after bulk operations. See `src/lib/db/repositories/statistics.ts`.

### 1.15 Standalone Release Packaging

This project supports compiling a dependency-free standalone binary using `@yao-pkg/pkg` in **SEA (Single Executable Application)** mode.

- **Build Script**: Developers can run `npm run build:release` which triggers `scripts/build-release.js`. This script compiles Next.js in standalone mode, copies static assets/drizzle migrations, patches `server.js` to run in the VFS snapshot, and packages the binary.
- **Rule**: When adding new static files, templates, or folders that must be bundled with the binary, you MUST update the `assets` list in the `"pkg"` config within `package.json` to ensure they are captured by the compiler.
- **Rule**: Avoid hardcoded references to `process.cwd() + "/public"` or assuming system binaries are globally available. Always check for local binaries in `./bin` using the `getCommandPath` helper and use `path.dirname(paths.downloads)` to resolve public assets correctly.

---

## 2. General Coding Guidelines

1. **Keep it typed**: Use strict TypeScript interfaces. Import shared types from `@/types/`. Avoid `any` — if a type is unknown, use `unknown` and narrow it.
2. **Path Aliases**: Always use `@/` for imports from `src/` (e.g., `import { db } from '@/lib/db'`). Never use relative paths (`../../`).
3. **No magic strings/colors**: Do not hardcode hex or RGB colors. Use the CSS variable design tokens.
4. **Graceful degradation**: Build UI features that fail gracefully (e.g., broken image URLs show a fallback icon, not a broken image).
5. **Async by default**: All database operations are async. The `@libsql/client` driver does not support synchronous calls.
6. **Utility deduplication**: Shared utility functions (e.g., `parseSizeToBytes`, `formatBytes`) live in `src/lib/utils/`. Do not duplicate them across files.
7. **Per-page metadata**: Each route should export its own `metadata` object for proper tab titles.
8. **Conventional Commit Messages**: This project uses `release-please` to manage version releases and auto-populate `CHANGELOG.md` in CI/CD. All commit messages must follow the [Conventional Commits specification](https://www.conventionalcommits.org/) (e.g., `feat(playlists): ...`, `fix(config): ...`, `chore(biome): ...`).
9. **Keep Documentation in Sync**: When implementing new features, modifications to subsystems, or introducing new architectural patterns, you MUST update both `ARCHITECTURE.md` and `CONTRIBUTING.md` to reflect these changes. Keeping documentation co-located and synchronized with code changes ensures future contributors (both human and AI) maintain complete context.

---

## 3. Lessons Learned from the Analysis Project (Issues #10–#23)

These lessons emerged from resolving the 14 issues in the repo analysis project. They inform how we should approach future work:

### 3.1 Phased Refactoring: Plan per Page, Not per Layer

When refactoring across multiple concerns (data fetching, pagination, component extraction, hooks), phased plans organized by **layer** (Phase 1: hooks, Phase 2: gallery, Phase 3: timeline) don't work well because pages have tightly coupled server/client components. Instead, **plan per page** and complete all layer changes for one page before moving to the next. Validate after each page.

### 3.2 Loading Skeletons and E2E Test Determinism

Adding `loading.tsx` boundaries introduces a race condition: Playwright tests may see both the skeleton and the loaded content simultaneously. The fix is to use `data-testid="loading-skeleton"` on skeleton elements and wait for them to disappear before asserting content. All existing E2E tests were updated to handle this.

### 3.3 CSS Module Sub-component Import Strategy

When extracting sub-components from a monolithic page, sub-components should import the parent page's `page.module.css` (e.g., `import styles from '../page.module.css'`) rather than creating per-component CSS files. This keeps class name hashing consistent and avoids duplication for page-specific (not globally reusable) styles.

### 3.4 Inline Styles: Static vs Dynamic

Not all inline `style={{}}` usage is equally bad. The migration priority is:

1. **Hardcoded colors** (`style={{ color: '#4ade80' }}`) → highest priority, must use design tokens
2. **Static layout styles** (`style={{ display: 'flex', gap: '4px' }}`) → medium priority, migrate to CSS classes
3. **Dynamic runtime values** (`style={{ backgroundImage: url }}`) → keep as inline, they depend on data

### 3.5 Sequential E2E Playwright Runs for Shared State

Playwright E2E tests for settings, scrapers, and purging interact with a single instance of the database and shared file config (`settings.json`). Running these tests in parallel leads to file lock and database write race conditions.

- **Rule**: E2E tests modifying system state must run sequentially. This is handled by the custom project structure in [playwright.config.ts](./playwright.config.ts), which partitions tests based on the developer-defined `SERIAL_TESTS` glob array. If you add a new state-modifying test (e.g. settings, scrapers, purging records), you MUST append its path pattern to `SERIAL_TESTS` in [playwright.config.ts](./playwright.config.ts) to ensure it is executed in the sequential serial projects using a single worker, rather than having to manually force `--workers=1` on the command line.

### 3.6 Docker Compose for Playwright E2E Tests

When running E2E tests locally, Playwright targets the server hosted by the Docker test compose stack on port 3001 (configured in `compose.test.yaml`). Because Playwright connects to this pre-built production container, any changes made to the source code will not be reflected in E2E tests until the test container is rebuilt and restarted.

- **Rule**: Before executing E2E tests to verify new or modified code, you MUST recompose the test stack:
  ```bash
  docker compose -f compose.test.yaml up --build -d
  ```
  Wait for the build to complete and the container to be healthy before running the E2E tests.

---

## 4. Testing Guidelines

This project uses Vitest for unit and integration testing of the database repositories and server actions.

### 4.1 Test Commands

- **Run all unit tests**: `npm run test:unit`
- **Run in watch mode**: `npm run test:unit:watch`
- **Generate coverage report**: `npm run test:unit:coverage`

### 4.2 Test File Location Strategy (Hybrid Approach)

To maintain a clean codebase and avoid Next.js route conflicts:
- **Database Repositories**: Co-located in `src/lib/db/repositories/*.test.ts`.
- **Server Actions**: Centralized in `tests/unit/actions/*.test.ts`. This ensures Next.js does not treat test files as route handlers or server-rendered pages.

### 4.3 Database Mocking in Tests

We use a lightweight, in-memory SQLite database (`:memory:`) to run tests quickly and isolated from the production environment:
1. **Dynamic Migration Playback**: The test helper (`tests/unit/helpers/db.ts`) reads the migration schema files under `drizzle/` at startup and applies them dynamically to construct the database schema in memory.
2. **Database Singleton Interception**: We mock `@/lib/db` using a live getter:
   ```ts
   let activeDb: any;
   vi.mock("@/lib/db", () => ({
     get db() { return activeDb; },
     initDb: vi.fn(),
   }));
   ```
   At test startup, we set `activeDb = testDbHelper.db`, redirecting all application DB calls to the test database.
3. **Database Truncation**: We call `await testDbHelper.clearDb()` in `beforeEach` to truncate all tables between tests.

### 4.4 Seed Factories

Avoid manually constructing Drizzle insert statements for every test. Instead, use seed factories in `tests/unit/helpers/seed.ts` (e.g. `seedPost`, `seedMediaItem`, `seedTag`, `seedSource`) to quickly create records with consistent and sensible defaults.

### 4.5 Intercepting the Filesystem

Do NOT mock `node:fs` globally as this will break Drizzle's migration loader. Instead, use localized mock factories with `vi.importActual` fallbacks to intercept specific directories (like the downloads directory):
```ts
vi.mock("node:fs", async () => {
  const actual = await vi.importActual<typeof import("node:fs")>("node:fs");
  return {
    ...actual,
    existsSync: (path: any) => {
      if (typeof path === "string" && path.includes("downloads")) return true;
      return actual.existsSync(path);
    },
  };
});
```

