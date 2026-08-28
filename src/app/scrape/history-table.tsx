"use client";

import { formatDistanceToNow } from "date-fns";
import { FileText, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  getActiveScrapeStatuses,
  getScrapeHistory,
  resumeFromHistory,
} from "@/app/scrape/actions";
import LogViewerModal from "@/app/scrape/components/log-viewer-modal";
import {
  mergeHistoryWithActiveStatuses,
  type ScrapeHistoryRecord,
} from "@/app/scrape/history-state";
import styles from "@/app/scrape/page.module.css";
import { formatDuration } from "@/lib/utils/format";

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
  initialHistory: ScrapeHistoryRecord[];
}) {
  const [historyItems, setHistoryItems] =
    useState<ScrapeHistoryRecord[]>(initialHistory);
  const [selectedLogItem, setSelectedLogItem] =
    useState<ScrapeHistoryRecord | null>(null);
  const mountedRef = useRef(false);
  const refreshInFlightRef = useRef(false);

  const refreshHistory = useCallback(async () => {
    if (refreshInFlightRef.current) return;
    refreshInFlightRef.current = true;

    try {
      const [freshHistory, activeStatuses] = await Promise.all([
        getScrapeHistory(),
        getActiveScrapeStatuses(),
      ]);
      if (mountedRef.current) {
        setHistoryItems(
          mergeHistoryWithActiveStatuses(freshHistory, activeStatuses),
        );
      }
    } catch (err) {
      console.error("Failed to refresh history:", err);
    } finally {
      refreshInFlightRef.current = false;
    }
  }, []);

  // Poll continuously while the History tab is mounted. This is deliberately
  // independent of the currently displayed rows so a task started elsewhere
  // can be discovered even when the previous snapshot had no running rows.
  useEffect(() => {
    mountedRef.current = true;
    void refreshHistory();
    const interval = setInterval(() => void refreshHistory(), 1000);

    return () => {
      mountedRef.current = false;
      clearInterval(interval);
    };
  }, [refreshHistory]);

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
      await refreshHistory();
    } catch (error) {
      console.error("Failed to resume scrape:", error);
      alert("Failed to resume scrape");
    }
  };

  return (
    <div className={styles.listContainer}>
      {/* Desktop Table View */}
      <div className={styles.desktopTable}>
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
              <th style={{ textAlign: "right" }}>Actions</th>
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
                  <div className={styles.actionGroup}>
                    {(item.status === "failed" ||
                      item.status === "stopped") && (
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
                    <button
                      type="button"
                      onClick={() => setSelectedLogItem(item)}
                      className={styles.iconButton}
                      title="View Log"
                    >
                      <FileText size={14} />
                    </button>
                  </div>
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

      {/* Mobile Card View */}
      <div className={styles.mobileCardsList}>
        {historyItems.map((item) => (
          <div key={item.id} className={styles.taskCard}>
            <div className={styles.taskCardHeader}>
              <div>
                <div
                  className={styles.taskCardTitle}
                  style={{ fontSize: "0.875rem" }}
                >
                  {formatDistanceToNow(new Date(item.startTime), {
                    addSuffix: true,
                  })}
                </div>
                <div className={styles.taskCardSource}>
                  Duration:{" "}
                  <DurationTimer
                    startTime={item.startTime}
                    endTime={item.endTime}
                    status={item.status}
                  />
                </div>
              </div>
              <span className={styles.badge} data-status={item.status}>
                {item.status}
              </span>
            </div>

            <div
              className={styles.taskCardGrid}
              style={{ gridTemplateColumns: "repeat(3, 1fr)" }}
            >
              <div className={styles.taskCardField}>
                <span className={styles.taskCardLabel}>Downloaded</span>
                <span
                  className={styles.taskCardValue}
                  style={{ fontSize: "0.8rem" }}
                >
                  {item.filesDownloaded}
                </span>
              </div>
              <div className={styles.taskCardField}>
                <span className={styles.taskCardLabel}>Posts</span>
                <span
                  className={styles.taskCardValue}
                  style={{ fontSize: "0.8rem" }}
                >
                  {item.postsProcessed ?? 0}
                </span>
              </div>
              <div className={styles.taskCardField}>
                <span className={styles.taskCardLabel}>Skipped</span>
                <span
                  className={styles.taskCardValue}
                  style={{ fontSize: "0.8rem" }}
                >
                  {item.skippedCount ?? 0}
                </span>
              </div>
              <div
                className={styles.taskCardField}
                style={{ marginTop: "0.25rem" }}
              >
                <span className={styles.taskCardLabel}>Size</span>
                <span
                  className={styles.taskCardValue}
                  style={{ fontSize: "0.75rem" }}
                >
                  {formatBytes(item.bytesDownloaded || 0)}
                </span>
              </div>
              <div
                className={styles.taskCardField}
                style={{ marginTop: "0.25rem" }}
              >
                <span className={styles.taskCardLabel}>Errors</span>
                <span
                  className={`${styles.taskCardValue} ${item.errorCount ? styles.errorText : ""}`}
                  style={{ fontSize: "0.75rem" }}
                >
                  {item.errorCount}
                </span>
              </div>
            </div>

            <div className={styles.taskCardActions}>
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
              <button
                type="button"
                onClick={() => setSelectedLogItem(item)}
                className={styles.iconButton}
                title="View Log"
              >
                <FileText size={14} />
              </button>
            </div>
          </div>
        ))}
        {historyItems.length === 0 && (
          <div className={styles.emptyCell} style={{ border: "none" }}>
            No history available.
          </div>
        )}
      </div>

      {selectedLogItem && (
        <LogViewerModal
          historyId={selectedLogItem.id}
          initialStatus={selectedLogItem.status}
          onClose={() => setSelectedLogItem(null)}
        />
      )}
    </div>
  );
}
