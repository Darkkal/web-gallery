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
    items: string[]; // List of absolute file paths processed/downloaded
}

// Legacy, keeping just in case
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
    inputFile?: string; // Path to a file containing URLs to download
    noArchive?: boolean; // Disable archive check, process all items fresh (for repair)
    onProgress?: (progress: ScrapeProgress) => void;
}
