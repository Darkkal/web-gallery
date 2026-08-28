import { describe, expect, it } from "vitest";
import { getScrapeHistoryMetrics } from "@/lib/scrapers/status";

describe("getScrapeHistoryMetrics", () => {
  it("serializes the latest live counters when a run is stopped", () => {
    const endTime = new Date("2026-08-28T18:02:00Z");

    const result = getScrapeHistoryMetrics(
      {
        downloadedCount: 8,
        totalSize: "16MiB",
        errorCount: 1,
        skippedCount: 4,
        postsProcessed: 12,
        startTime: new Date("2026-08-28T18:00:00Z"),
      },
      endTime,
    );

    expect(result).toMatchObject({
      endTime,
      filesDownloaded: 8,
      bytesDownloaded: 16 * 1024 * 1024,
      errorCount: 1,
      skippedCount: 4,
      postsProcessed: 12,
    });
    expect(result.averageSpeed).toBe(Math.floor((16 * 1024 * 1024) / 120));
  });
});
