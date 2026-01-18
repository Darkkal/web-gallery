export interface ScrapeProgress {
    downloadedCount: number;
    speed: string; // e.g., "5.2MiB/s"
    totalSize: string; // e.g., "120MiB"
    errorCount: number;
    isRateLimited: boolean;
    isFinished: boolean;
}

export interface ScrapeResult {
    success: boolean;
    output: string; // JSON or raw output
    error?: string;
    items: ScrapedMediaItem[];
}

export interface ScrapedMediaItem {
    url: string;
    filename: string;
    sourceUrl: string;
    capturedAt: Date;
    metadata: any;
    type: 'image' | 'video';
}

export interface ScraperOptions {
    url: string;
    downloadPath?: string;
    mode?: 'full' | 'quick';
    onProgress?: (progress: ScrapeProgress) => void;
}
