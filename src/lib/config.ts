import path from "node:path";

/**
 * Centralized application path configuration.
 *
 * Persistent data is split across two configurable roots:
 *
 *   DATA_DIR  — fast storage (SSD): database, scraper state (small files, frequent I/O)
 *   MEDIA_DIR — bulk storage (HDD): downloaded media, cached avatars (large files)
 *
 * When unset (typical in dev), both fall back to CWD, preserving the old layout:
 *
 *   ./sqlite.db
 *   ./public/downloads/
 *   ./public/avatars/
 *   ./scrapers/gallery-dl/...
 *
 * In production/test, set both to absolute paths:
 *
 *   DATA_DIR=/data   (fast drive)  →  /data/sqlite.db, /data/scrapers/...
 *   MEDIA_DIR=/media (large drive) →  /media/downloads/, /media/avatars/
 *
 * Static file serving: downloads and avatars are still served from
 * `public/downloads` and `public/avatars`. The Docker entrypoint creates
 * symlinks from those public dirs to the MEDIA_DIR locations.
 */

const DATA_DIR = process.env.DATA_DIR || process.cwd();
const MEDIA_DIR = process.env.MEDIA_DIR || process.cwd();
const hasMediaDir = !!process.env.MEDIA_DIR;

export const paths = {
  /** Root data directory (fast storage — DB, scraper state) */
  dataDir: DATA_DIR,

  /** Root media directory (bulk storage — downloads, avatars) */
  mediaDir: MEDIA_DIR,

  /** SQLite database file (fast storage) */
  db: path.join(DATA_DIR, "sqlite.db"),

  /**
   * Downloaded media files (bulk storage, served at /downloads/).
   *
   * When MEDIA_DIR is set (Docker): files live directly under $MEDIA_DIR/downloads/
   * When MEDIA_DIR is unset (dev):  files live under ./public/downloads/ (Next.js static serving)
   */
  downloads: hasMediaDir
    ? path.join(MEDIA_DIR, "downloads")
    : path.join(MEDIA_DIR, "public", "downloads"),

  /**
   * Cached avatar images (bulk storage, served at /avatars/).
   * Same MEDIA_DIR logic as downloads.
   */
  avatars: hasMediaDir
    ? path.join(MEDIA_DIR, "avatars")
    : path.join(MEDIA_DIR, "public", "avatars"),

  /** Root directory for scraper-related data (fast storage) */
  scraperData: path.join(DATA_DIR, "scrapers"),

  /** Gallery-dl specific data root (fast storage — archives are small, frequently accessed) */
  galleryDl: {
    root: path.join(DATA_DIR, "scrapers", "gallery-dl"),
    config: path.join(DATA_DIR, "scrapers", "gallery-dl", "gallery-dl.conf"),
    archives: path.join(DATA_DIR, "scrapers", "gallery-dl", "archives"),
    logs: path.join(DATA_DIR, "scrapers", "gallery-dl", "logs"),
  },
} as const;
