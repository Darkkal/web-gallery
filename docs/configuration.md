# Configuration Reference

This document covers every configurable aspect of Web Gallery: environment variables, the gallery-dl configuration file, and Docker volume layout.

---

## Environment Variables

All variables are optional. When unset, the application defaults to a self-contained development layout rooted at the current working directory.

### Storage

| Variable | Default | Description |
|----------|---------|-------------|
| `DATA_DIR` | `process.cwd()` | Path for fast-access data: the SQLite database, scraper archives, and per-scrape log files. Put this on an SSD if possible. |
| `MEDIA_DIR` | `process.cwd()` | Path for bulk media storage: downloaded media files and cached avatar images. Can be a separate, larger (HDD) volume. |

When both are unset (typical in development), all data lands under the project root:

```
./sqlite.db
./public/downloads/   ← media files (served by Next.js static hosting)
./public/avatars/     ← cached avatars
./scrapers/gallery-dl/
```

When set (Docker / production), paths resolve as:

```
$DATA_DIR/
├── sqlite.db
└── scrapers/gallery-dl/
    ├── gallery-dl.conf
    ├── archives/
    └── logs/

$MEDIA_DIR/
├── downloads/
└── avatars/
```

> [!NOTE]
> In Docker, the entrypoint script creates `$MEDIA_DIR/downloads` and
> `$MEDIA_DIR/avatars` automatically. No manual directory creation is needed.

### Runtime

| Variable | Values | Description |
|----------|--------|-------------|
| `NODE_ENV` | `development` \| `production` | Set automatically by Next.js. In `production`, destructive debug Server Actions are disabled. Never set to `development` in a production deployment. |
| `NEXT_PHASE` | (set by Next.js build system) | Used internally to skip database initialization during `next build`. Do not set manually. |

---

## gallery-dl Configuration

gallery-dl is the scraping engine used to download media. The application manages an **isolated** configuration file so it does not interfere with any system-level `gallery-dl` config you may have.

### Config file location

| Mode | Path |
|------|------|
| Development (unset `DATA_DIR`) | `./scrapers/gallery-dl/gallery-dl.conf` |
| Production / Docker | `$DATA_DIR/scrapers/gallery-dl/gallery-dl.conf` |

A template with recommended defaults is included in the repository root as [`gallery-dl-default.conf`](../gallery-dl-default.conf). On first run the application does not automatically copy this — you should copy or symlink it yourself:

```bash
# Development
mkdir -p scrapers/gallery-dl
cp gallery-dl-default.conf scrapers/gallery-dl/gallery-dl.conf
```

### Key settings to configure

**Authentication (cookies)**

gallery-dl supports cookies for sites that require login (e.g. Twitter/X). The recommended approach is to export cookies from your browser using the [cookies.txt extension](https://github.com/kimf/get-cookies.txt-chrome-extension):

```json
{
  "extractor": {
    "twitter": {
      "cookies": "/path/to/twitter-cookies.txt"
    }
  }
}
```

**Rate limiting**

To avoid being rate-limited or banned, set per-extractor delays:

```json
{
  "extractor": {
    "twitter": {
      "sleep-request": 1.5
    },
    "pixiv": {
      "sleep-request": 2.0
    }
  }
}
```

**Output path template**

The application expects media to land inside `downloads/` (or `$MEDIA_DIR/downloads/`). The default output template in `gallery-dl-default.conf` is already configured correctly. If you customize it, ensure all output paths remain under the configured downloads directory, or the library scanner will not find the files.

**Archive file**

gallery-dl uses an archive file to skip URLs it has already downloaded. The application configures this automatically per-source in `$DATA_DIR/scrapers/gallery-dl/archives/`. Do not change the archive path — it is how the scraper knows what to skip on subsequent runs.

---

## Docker Volume Layout

The Docker Compose configuration (`compose.yaml`) uses two named volumes:

```yaml
volumes:
  data:   # Mounted at /data  → set DATA_DIR=/data
  media:  # Mounted at /media → set MEDIA_DIR=/media
```

Full layout inside the container:

```
/data/
├── sqlite.db                        ← database (back this up)
└── scrapers/
    └── gallery-dl/
        ├── gallery-dl.conf          ← your config lives here
        ├── archives/                ← skip-already-downloaded state
        └── logs/                    ← per-scrape log files

/media/
├── downloads/                       ← all downloaded media + JSON metadata
└── avatars/                         ← cached profile avatars
```

### Backup recommendations

The only file you **must** back up is **`$DATA_DIR/sqlite.db`**. It contains all scraped metadata, source definitions, tags, and collections. Media files in `$MEDIA_DIR/downloads/` can always be re-scraped, but the database cannot be reconstructed without the source URLs and metadata JSON files.

Optionally, also back up:
- `$DATA_DIR/scrapers/gallery-dl/archives/` — preserves the "already downloaded" state so re-scraping a source after a restore skips files correctly.
- `$DATA_DIR/scrapers/gallery-dl/gallery-dl.conf` — your authentication and rate-limit settings.

### Using a custom Docker Compose override

If you need to mount a local directory (e.g. a NAS share) instead of Docker volumes, use a Compose override file:

```yaml
# compose.override.yaml
services:
  app:
    volumes:
      - /mnt/ssd/gallery-data:/data
      - /mnt/hdd/gallery-media:/media
```

```bash
docker compose -f compose.yaml -f compose.override.yaml up -d
```

---

## Development Scripts

```bash
npm run dev          # Start the development server (localhost:3000)
npm run build        # Build the production bundle
npm run start        # Start the production server

npm run db:generate  # Generate SQL migrations from schema.ts changes
npm run db:migrate   # Apply pending migrations to sqlite.db

npm run lint         # Run Biome linter
npm run test:e2e     # Run Playwright E2E tests
```
