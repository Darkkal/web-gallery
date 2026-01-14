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
}
