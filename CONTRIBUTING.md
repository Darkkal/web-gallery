# Contributing Guidelines

This document outlines the architectural decisions, established patterns, and future technical direction for the Web-Gallery project. Whether you are a human developer or an AI agent, please adhere to these guidelines to ensure consistency and alignment with the project's evolution.

## 1. Core Technology Stack

- **Framework**: Next.js 16.1 (App Router)
- **UI Library**: React 19
- **Language**: TypeScript 5
- **Database**: SQLite (via `better-sqlite3`)
- **ORM**: Drizzle ORM (`drizzle-kit` for schema management)
- **Styling**: Vanilla CSS Modules (with HSL variables and CSS Custom Properties)
- **Icons**: Lucide React
- **Testing**: Playwright (E2E)

---

## 2. Established Patterns (What we currently do)

### Data Access (Repository Pattern)

We use a Repository Pattern to abstract Drizzle ORM calls away from the rest of the application.

- **Location**: `src/lib/db/repositories/`
- **Rule**: Direct database access (`db.select()`, `db.insert()`) should ideally be localized to these repository files or dedicated backend services. Do not leak ORM logic into UI components.

### Scraping & Processing (Strategy & Factory Patterns)

- **Scraping**: `ScraperManager` acts as a singleton to control scraping tasks. The underlying implementation uses a Strategy Pattern (`BaseScraperStrategy` -> `GalleryDlStrategy`, `YtDlpStrategy`).
- **Library Scanning**: We use a Factory Pattern (`MetadataProcessorFactory`) to handle metadata extraction for different platforms (Twitter, Pixiv, Gelbooru).
- **Rule**: When adding support for a new platform, implement a new strategy/processor rather than adding `if/else` logic to the base classes.

### Styling System

- We use **CSS Modules** (`[name].module.css`) co-located with components.
- Global variables (colors, spacing, glassmorphism tokens) are defined in `src/app/globals.css` using HSL (`--background: 240 10% 3.9%`).
- **Rule**: NEVER use Tailwind utility classes (e.g., `text-green-500`) as Tailwind is not installed. Always use CSS Modules and reference the global CSS variables for colors (e.g., `hsl(var(--muted))`).

---

## 3. The Future Direction (What we should utilize moving forward)

Our current architecture has some anti-patterns (largely around data-fetching and monolithic files) that we are actively migrating away from.

### Next.js Data Fetching (High Priority)

- **Anti-pattern**: Currently, pages like Gallery and Timeline are `'use client'` components that fetch data by calling Server Actions (`getMediaItems`) inside a `useEffect`.
- **Target Pattern**:
  - Prefer **Server Components** for read-only pages (or the data-fetching boundaries of those pages).
  - Pass the fetched data down to client components as props.
  - For client-side data fetching (e.g., infinite scroll or dynamic filtering), use standard REST API endpoints (Route Handlers in `src/app/api/...`) and `fetch()`, rather than using Server Actions.
  - **Rule**: Server Actions should be strictly reserved for **mutations** (form submissions, triggering scrapes, deleting items).

### Database Query Optimization (High Priority)

- **Anti-pattern**: Fetching all rows from the database and filtering/sorting them in memory (JavaScript).
- **Target Pattern**: Push all filtering, sorting, and pagination down to the database using SQL (`WHERE`, `ORDER BY`, `LIMIT`, `OFFSET` in Drizzle).

### Component Refactoring (Medium Priority)

- **Anti-pattern**: Large monolithic page files (e.g., `src/app/gallery/page.tsx`).
- **Target Pattern**: Extract UI elements (Filter Bars, Media Cards, Settings panels) into smaller, reusable components.
- **Target Pattern**: Extract complex client-side state logic (selection handling, debounced searching) into custom React hooks (e.g., `useSelection()`).

### Security & Destructive Actions

- **Rule**: Any server action that performs destructive operations (e.g., purging the database or deleting files) MUST include appropriate authorization checks or environment guards (`process.env.NODE_ENV !== 'production'`).

---

## 4. General Coding Guidelines

1. **Keep it typed**: Ensure TypeScript interfaces are used consistently. Extract shared types (like `MediaItem`, `Post`) into a common `types.ts` file rather than defining them inline.
2. **Path Aliases**: Always use the `@/` path alias for absolute imports from the `src` directory (e.g., `import { db } from '@/lib/db'`) instead of relative paths (`../../lib/db`).
3. **No magic strings/colors**: Do not hardcode hex or RGB colors in CSS or inline styles. Use the defined CSS variables.
4. **Graceful degradation**: When building UI features, ensure they fail gracefully (e.g., a broken image URL should show a fallback icon, not an ugly broken image link).

*Note: When building new features or refactoring existing code, please consult this document to ensure the implementation aligns with the agreed-upon architecture.*
