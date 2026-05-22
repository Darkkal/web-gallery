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

### 1.4 Scraping & Processing (Strategy & Factory Patterns)

- **Scraping**: `ScraperManager` singleton controls scraping tasks. Strategies implement `BaseScraperStrategy` → `GalleryDlStrategy`, `YtDlpStrategy`.
- **Library Scanning**: `MetadataProcessorFactory` handles metadata extraction per platform (Twitter, Pixiv, Gelbooru).
- **Rule**: When adding support for a new platform, implement a new strategy/processor. Never add `if/else` platform logic to base classes.
- **Rule**: If a new extractor introduces new searchable metadata columns that are added to the FTS5 virtual table, you MUST update the `ftsColumnAliases` dictionary in `src/lib/utils/search-parser.ts` to map any friendly search prefixes to the new FTS5 column. This dictionary doubles as the allowlist for valid column filters.

### 1.5 Styling System — CSS Modules + Design Tokens

- **CSS Modules** (`[name].module.css`) are co-located with components.
- **Global tokens** are in `src/app/globals.css` using HSL format (`--background: 240 10% 3.9%`).
- **Semantic status colors** are defined as design tokens:
  - `--color-success`, `--color-info`, `--color-danger`, `--color-warning`, `--color-muted-label`
  - Both dark (`:root`) and light (`[data-theme='light']`) themes have overrides.

- **Rule**: NEVER use Tailwind utility classes — Tailwind is not installed.
- **Rule**: NEVER hardcode hex colors (`#4ade80`, `#888`) or inline `style={{ color: ... }}`. Use CSS Module classes referencing `hsl(var(--token))`.
- **Rule**: Only use inline `style={{}}` for truly dynamic runtime values (e.g., `backgroundImage` with a URL, conditional cursor styles). All static styling belongs in CSS Modules.
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
| `useSelection` | Selection state (toggle, select-all, clear, group selection) | Gallery, Sources |
| `useDebouncedValue` | Debounced search/sort input | Gallery, Timeline |
| `useLightbox` | Lightbox open/close/navigate state | Gallery, Timeline |

- **Rule**: When building a new page with selection, search, or lightbox behavior, consume these hooks rather than reimplementing the logic inline.

### 1.7 Shared Types

Frontend types are in `src/types/`:

| File | Contains |
|------|----------|
| `media.ts` | `MediaItem`, `GalleryGroup`, `GalleryRow` |
| `posts.ts` | `TimelinePost`, post-related types |
| `source.ts` | `Source`, source-related types |
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
├── scanning.ts   # Library scan control
├── sources.ts    # Source CRUD
├── tags.ts       # Tag queries
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

### 1.12 Image Configuration

- `next.config.ts` has wildcard `remotePatterns` for scraper-sourced content from arbitrary domains.
- Only use `unoptimized` on `next/image` for truly local file paths that bypass Next.js optimization. Images served through API routes (e.g., avatar proxy) should leverage Next.js image optimization.

---

## 2. General Coding Guidelines

1. **Keep it typed**: Use strict TypeScript interfaces. Import shared types from `@/types/`. Avoid `any` — if a type is unknown, use `unknown` and narrow it.
2. **Path Aliases**: Always use `@/` for imports from `src/` (e.g., `import { db } from '@/lib/db'`). Never use relative paths (`../../`).
3. **No magic strings/colors**: Do not hardcode hex or RGB colors. Use the CSS variable design tokens.
4. **Graceful degradation**: Build UI features that fail gracefully (e.g., broken image URLs show a fallback icon, not a broken image).
5. **Async by default**: All database operations are async. The `@libsql/client` driver does not support synchronous calls.
6. **Utility deduplication**: Shared utility functions (e.g., `parseSizeToBytes`, `formatBytes`) live in `src/lib/utils/`. Do not duplicate them across files.
7. **Per-page metadata**: Each route should export its own `metadata` object for proper tab titles.

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

Playwright E2E tests for settings, scrapers, and purging interact with a single instance of the database and shared file config (`settings.json`). Running tests in parallel leads to severe file lock and database write race conditions (especially on test databases/archives).

- **Rule**: E2E test runs (specifically those modifying system configuration or purging database records) must be executed sequentially. Ensure `--workers=1` or `npx playwright test --workers=1` is specified when running the E2E suites.

---
