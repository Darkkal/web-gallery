import { parseSizeToBytes } from "@/lib/utils/format";

export interface ScrapeStatusForMetrics {
  downloadedCount: number;
  totalSize: string;
  errorCount: number;
  skippedCount: number;
  postsProcessed: number;
  startTime: Date;
}

export function getScrapeHistoryMetrics(
  status: ScrapeStatusForMetrics,
  endTime: Date,
) {
  const bytesDownloaded = parseSizeToBytes(status.totalSize);
  const durationSeconds =
    (endTime.getTime() - status.startTime.getTime()) / 1000;

  return {
    endTime,
    filesDownloaded: status.downloadedCount,
    bytesDownloaded,
    errorCount: status.errorCount,
    skippedCount: status.skippedCount,
    postsProcessed: status.postsProcessed,
    averageSpeed:
      durationSeconds > 0 ? Math.floor(bytesDownloaded / durationSeconds) : 0,
  };
}
