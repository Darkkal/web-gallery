"use client";

import {
  ArrowDown,
  FileText,
  Loader2,
  RefreshCw,
  WrapText,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { getScrapeLog } from "@/app/scrape/actions";
import styles from "@/app/scrape/page.module.css";

interface LogViewerModalProps {
  historyId: number;
  initialStatus?: "running" | "completed" | "stopped" | "failed";
  onClose: () => void;
}

export default function LogViewerModal({
  historyId,
  initialStatus,
  onClose,
}: LogViewerModalProps) {
  const [log, setLog] = useState<string | null>(null);
  const [status, setStatus] = useState<
    "running" | "completed" | "stopped" | "failed" | undefined
  >(initialStatus);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [wrapText, setWrapText] = useState<boolean>(true);
  const [autoScroll, setAutoScroll] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  const terminalRef = useRef<HTMLDivElement>(null);

  const fetchLog = useCallback(
    async (showRefreshing = false) => {
      if (showRefreshing) setIsRefreshing(true);
      try {
        const result = await getScrapeLog(historyId);
        if (result.success && result.log !== undefined) {
          setLog(result.log);
          setError(null);
        } else {
          setError(result.error || "Failed to load log file.");
        }
        if (result.status) {
          setStatus(result.status);
        }
      } catch (err: unknown) {
        setError(
          err instanceof Error ? err.message : "An unexpected error occurred",
        );
      } finally {
        setLoading(false);
        if (showRefreshing) setIsRefreshing(false);
      }
    },
    [historyId],
  );

  // Initial load
  useEffect(() => {
    fetchLog();
  }, [fetchLog]);

  // Live polling for running tasks
  useEffect(() => {
    if (status !== "running") return;

    const interval = setInterval(() => {
      fetchLog();
    }, 1500);

    return () => clearInterval(interval);
  }, [status, fetchLog]);

  // Auto scroll effect on log update
  // biome-ignore lint/correctness/useExhaustiveDependencies: Scroll triggers when log string content updates
  useEffect(() => {
    if (autoScroll && terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [log, autoScroll]);

  // Keyboard escape handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: Backdrop click dismisses modal, keyboard Escape is handled in useEffect
    <div
      className={styles.modalOverlay}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div className={styles.modalContent}>
        {/* Header */}
        <div className={styles.modalHeader}>
          <div className={styles.modalHeaderTitleGroup}>
            <FileText size={20} className={styles.label} />
            <h3 id="modal-title" className={styles.modalTitle}>
              Scraper Task Log #{historyId}
            </h3>
            {status && (
              <span className={styles.badge} data-status={status}>
                {status}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className={styles.iconButton}
            aria-label="Close modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Toolbar Controls */}
        <div className={styles.modalToolbar}>
          <div className={styles.toggleGroup}>
            <button
              type="button"
              onClick={() => setWrapText((prev) => !prev)}
              className={`${styles.toggleButton} ${wrapText ? styles.toggleButtonActive : ""}`}
              title="Toggle line wrapping"
            >
              <WrapText size={14} />
              Wrap Text
            </button>
            <button
              type="button"
              onClick={() => setAutoScroll((prev) => !prev)}
              className={`${styles.toggleButton} ${autoScroll ? styles.toggleButtonActive : ""}`}
              title="Toggle automatic scroll on log updates"
            >
              <ArrowDown size={14} />
              Auto Scroll
            </button>
          </div>

          <button
            type="button"
            onClick={() => fetchLog(true)}
            disabled={loading || isRefreshing}
            className={styles.toggleButton}
            title="Refresh log"
          >
            <RefreshCw
              size={14}
              className={isRefreshing ? styles.runningPulse : ""}
            />
            Refresh
          </button>
        </div>

        {/* Log Content / Terminal */}
        <div className={styles.logTerminalContainer} ref={terminalRef}>
          {loading ? (
            <div className={styles.logStatusMessage}>
              <Loader2 size={28} className={styles.runningPulse} />
              <span>Loading log file...</span>
            </div>
          ) : error ? (
            <div className={styles.logStatusMessage}>
              <span className={styles.errorText}>{error}</span>
            </div>
          ) : log === null || log.trim() === "" ? (
            <div className={styles.logStatusMessage}>
              <span>No output log content recorded yet.</span>
            </div>
          ) : (
            <pre
              className={`${styles.logTerminal} ${wrapText ? styles.logTerminalWrap : ""}`}
            >
              {log}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}
