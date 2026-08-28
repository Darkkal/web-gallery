import { describe, expect, it } from "vitest";
import {
  mergeHistoryWithActiveStatuses,
  type ScrapeHistoryRecord,
} from "@/app/scrape/history-state";

function historyRecord(
  id: number,
  status: ScrapeHistoryRecord["status"],
): ScrapeHistoryRecord {
  return {
    id,
    startTime: new Date("2026-08-28T18:00:00Z"),
    endTime: status === "running" ? null : new Date("2026-08-28T18:01:00Z"),
    status,
    filesDownloaded: 0,
    skippedCount: 0,
    postsProcessed: 0,
    bytesDownloaded: 0,
    errorCount: 0,
    cursor: null,
    sourceId: 2,
    taskId: 5,
  };
}

describe("mergeHistoryWithActiveStatuses", () => {
  it("discovers a new database row even when the previous list had no running row", () => {
    const freshHistory = [historyRecord(2, "running")];

    const result = mergeHistoryWithActiveStatuses(freshHistory, []);

    expect(result.map((item) => item.id)).toEqual([2]);
    expect(result[0].status).toBe("running");
  });

  it("overlays live counters without overwriting a newer terminal database state", () => {
    const freshHistory = [historyRecord(2, "stopped")];

    const result = mergeHistoryWithActiveStatuses(freshHistory, [
      {
        historyId: 2,
        downloadedCount: 8,
        skippedCount: 4,
        postsProcessed: 12,
        errorCount: 1,
        isFinished: false,
        status: "running",
      },
    ]);

    expect(result[0]).toMatchObject({
      id: 2,
      status: "stopped",
      filesDownloaded: 8,
      skippedCount: 4,
      postsProcessed: 12,
      errorCount: 1,
    });
  });
});
