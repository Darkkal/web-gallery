export interface ScrapeProgress {
  downloadedCount: number;
  speed: string; // e.g., "5.2MiB/s"
  totalSize: string; // e.g., "120MiB"
  errorCount: number;
  skippedCount: number;
  postsProcessed: number;
  isRateLimited: boolean;
  isFinished: boolean;
  cursor?: string; // gallery-dl resume cursor (e.g. pixiv offset)
}

export interface ScrapeResult {
  success: boolean;
  output: string; // JSON or raw output
  error?: string;
  items: string[]; // List of absolute file paths processed/downloaded
  cursor?: string; // Resume cursor from gallery-dl
}

// Legacy, keeping just in case
export interface ScrapedMediaItem {
  url: string;
  filename: string;
  sourceUrl: string;
  capturedAt: Date;
  metadata: unknown;
  type: "image" | "video";
}

export interface ScraperOptions {
  url: string;
  downloadPath?: string;
  logPath?: string;
  mode?: "full" | "quick";
  cursor?: string;
  onProgress?: (progress: ScrapeProgress) => void;
}
