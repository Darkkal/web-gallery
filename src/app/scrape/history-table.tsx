"use client";

import { formatDistanceToNow } from "date-fns";
import { RotateCcw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import {
  getActiveScrapeStatuses,
  getScrapeHistory,
  resumeFromHistory,
} from "@/app/scrape/actions";
import styles from "@/app/scrape/page.module.css";
import { formatDuration } from "@/lib/utils/format";

interface HistoryItem {
  id: number;
  startTime: Date;
  endTime: Date | null;
  status: "running" | "completed" | "stopped" | "failed";
  filesDownloaded: number | null;
  skippedCount: number | null;
  postsProcessed: number | null;
  bytesDownloaded: number | null;
  errorCount: number | null;
  cursor: string | null;
  sourceId: number;
  taskId: number | null;
}

function DurationTimer({
  startTime,
  endTime,
  status,
}: {
  startTime: Date | string;
  endTime: Date | string | null;
  status: "running" | "completed" | "stopped" | "failed";
}) {
  const [currentDuration, setCurrentDuration] = useState<number>(0);

  useEffect(() => {
    const calculateDuration = () => {
      const start = new Date(startTime).getTime();
      const end = endTime ? new Date(endTime).getTime() : Date.now();
      return Math.max(0, (end - start) / 1000);
    };

    setCurrentDuration(calculateDuration());

    if (status !== "running" || endTime) return;

    const interval = setInterval(() => {
      setCurrentDuration(calculateDuration());
    }, 1000);

    return () => clearInterval(interval);
  }, [startTime, endTime, status]);

  if (status === "running") {
    return (
      <span className={styles.runningPulse}>
        {formatDuration(currentDuration)}
      </span>
    );
  }

  if (endTime) {
    return <span>{formatDuration(currentDuration)}</span>;
  }

  return <span>-</span>;
}

export default function ScrapeHistoryTable({
  initialHistory,
}: {
  initialHistory: HistoryItem[];
}) {
  const [historyItems, setHistoryItems] =
    useState<HistoryItem[]>(initialHistory);

  useEffect(() => {
    setHistoryItems(initialHistory);
  }, [initialHistory]);

  const refreshHistory = useCallback(async () => {
    try {
      const freshHistory = await getScrapeHistory();
      const mapped: HistoryItem[] = freshHistory.map(
        (h: Record<string, unknown>) => ({
          id: h.id as number,
          startTime: h.startTime as Date,
          endTime: h.endTime as Date | null,
          status: h.status as "running" | "completed" | "stopped" | "failed",
          filesDownloaded: h.filesDownloaded as number | null,
          skippedCount: h.skippedCount as number | null,
          postsProcessed: h.postsProcessed as number | null,
          bytesDownloaded: h.bytesDownloaded as number | null,
          errorCount: h.errorCount as number | null,
          cursor: (h.cursor as string) || null,
          sourceId: h.sourceId as number,
          taskId: (h.taskId as number) || null,
        }),
      );
      setHistoryItems(mapped);
    } catch (err) {
      console.error("Failed to refresh history:", err);
    }
  }, []);

  useEffect(() => {
    const hasRunning = historyItems.some((i) => i.status === "running");
    if (!hasRunning) return;

    const interval = setInterval(async () => {
      try {
        const active = await getActiveScrapeStatuses();
        const runningItemIds = historyItems
          .filter((i) => i.status === "running")
          .map((i) => i.id);

        // Check if any running items are no longer in the active list
        const missingIds = runningItemIds.filter(
          (id) => !active.some((a) => a.historyId === id),
        );

        if (missingIds.length > 0) {
          // At least one previously-running task is no longer active.
          // The DB has the final status, so re-fetch history from DB.
          await refreshHistory();
          return;
        }

        setHistoryItems((prev) =>
          prev.map((item) => {
            const activeStatus = active.find((a) => a.historyId === item.id);
            if (activeStatus) {
              // If the scraper reports finished, update the item's status and endTime
              const updates: Partial<HistoryItem> = {
                filesDownloaded: activeStatus.downloadedCount,
                skippedCount: activeStatus.skippedCount,
                postsProcessed: activeStatus.postsProcessed,
                errorCount: activeStatus.errorCount,
              };
              if (activeStatus.isFinished && item.status === "running") {
                updates.status = activeStatus.status || "completed";
                updates.endTime = new Date();
              }
              return { ...item, ...updates };
            }
            return item;
          }),
        );
      } catch (err) {
        console.error("Failed to poll status:", err);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [historyItems, refreshHistory]);

  // Helper for bytes formatting
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`;
  };

  const handleResume = async (historyId: number) => {
    try {
      await resumeFromHistory(historyId);
    } catch (error) {
      console.error("Failed to resume scrape:", error);
      alert("Failed to resume scrape");
    }
  };

  return (
    <div className={styles.listContainer}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Time</th>
            <th>Duration</th>
            <th>Status</th>
            <th className={styles.thRight}>Downloaded</th>
            <th className={styles.thRight}>Posts</th>
            <th className={styles.thRight}>Skipped</th>
            <th className={styles.thRight}>Size</th>
            <th className={styles.thRight}>Errors</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {historyItems.map((item) => (
            <tr key={item.id} className={styles.tableRow}>
              <td>
                {formatDistanceToNow(new Date(item.startTime), {
                  addSuffix: true,
                })}
              </td>
              <td>
                <DurationTimer
                  startTime={item.startTime}
                  endTime={item.endTime}
                  status={item.status}
                />
              </td>
              <td>
                <span className={styles.badge} data-status={item.status}>
                  {item.status}
                </span>
              </td>
              <td className={styles.tdRight}>{item.filesDownloaded}</td>
              <td className={styles.tdRight}>{item.postsProcessed ?? 0}</td>
              <td className={styles.tdRight}>{item.skippedCount ?? 0}</td>
              <td className={styles.tdRight}>
                {formatBytes(item.bytesDownloaded || 0)}
              </td>
              <td
                className={`${styles.tdRight} ${item.errorCount ? styles.errorText : ""}`}
              >
                {item.errorCount}
              </td>
              <td>
                {(item.status === "failed" || item.status === "stopped") && (
                  <button
                    type="button"
                    onClick={() => handleResume(item.id)}
                    className={styles.iconButton}
                    title={
                      item.cursor
                        ? `Resume from cursor: ${item.cursor}`
                        : "Try to resume from log file"
                    }
                  >
                    <RotateCcw size={14} />
                  </button>
                )}
              </td>
            </tr>
          ))}
          {historyItems.length === 0 && (
            <tr>
              <td colSpan={9} className={styles.emptyCell}>
                No history available.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
