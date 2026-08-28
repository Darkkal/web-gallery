export type ScrapeHistoryStatus =
  | "running"
  | "completed"
  | "stopped"
  | "failed";

export interface ScrapeHistoryRecord {
  id: number;
  startTime: Date;
  endTime: Date | null;
  status: ScrapeHistoryStatus;
  filesDownloaded: number | null;
  skippedCount: number | null;
  postsProcessed: number | null;
  bytesDownloaded: number | null;
  errorCount: number | null;
  cursor: string | null;
  sourceId: number;
  taskId: number | null;
}

export interface ActiveScrapeStatus {
  historyId: number;
  downloadedCount: number;
  skippedCount: number;
  postsProcessed: number;
  errorCount: number;
  isFinished: boolean;
  status?: ScrapeHistoryStatus;
}

export function mergeHistoryWithActiveStatuses(
  history: ScrapeHistoryRecord[],
  activeStatuses: ActiveScrapeStatus[],
  now = new Date(),
): ScrapeHistoryRecord[] {
  return history.map((item) => {
    const active = activeStatuses.find(
      (status) => status.historyId === item.id,
    );
    if (!active) return item;

    const liveValues: ScrapeHistoryRecord = {
      ...item,
      filesDownloaded: active.downloadedCount,
      skippedCount: active.skippedCount,
      postsProcessed: active.postsProcessed,
      errorCount: active.errorCount,
    };

    // A terminal database row is authoritative. The in-memory status can
    // linger briefly after stop/completion while its child process exits.
    if (item.status === "running" && active.isFinished) {
      liveValues.status = active.status ?? "completed";
      liveValues.endTime = item.endTime ?? now;
    }

    return liveValues;
  });
}
