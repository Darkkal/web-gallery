"use client";

import type { HistoryDateType, HistoryGranularity } from "@/types/statistics";
import styles from "../page.module.css";

interface ChartControlsProps {
  metric: string;
  setMetric: (m: string) => void;
  dateType: HistoryDateType;
  setDateType: (d: HistoryDateType) => void;
  granularity: HistoryGranularity;
  setGranularity: (g: HistoryGranularity) => void;
  startDate: string;
  setStartDate: (s: string) => void;
  endDate: string;
  setEndDate: (e: string) => void;
  showStorage: boolean;
  autoScaleY: boolean;
  setAutoScaleY: (val: boolean) => void;
}

const METRICS = [
  { value: "posts", label: "Posts" },
  { value: "media", label: "Media Items" },
  { value: "tags", label: "Tags" },
  { value: "users", label: "Users" },
  { value: "extractors", label: "Extractors" },
];

export default function ChartControls({
  metric,
  setMetric,
  dateType,
  setDateType,
  granularity,
  setGranularity,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  showStorage,
  autoScaleY,
  setAutoScaleY,
}: ChartControlsProps) {
  const activeMetrics = showStorage
    ? [...METRICS, { value: "storage", label: "Storage Used" }]
    : METRICS;

  return (
    <div className={styles.chartControls}>
      <div className={styles.controlGroup}>
        <label className={styles.controlLabel} htmlFor="metric-select">
          Metric
        </label>
        <select
          id="metric-select"
          value={metric}
          onChange={(e) => setMetric(e.target.value)}
          className={styles.selectInput}
        >
          {activeMetrics.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.controlGroup}>
        <span className={styles.controlLabel}>Date Reference</span>
        <div className={styles.buttonGroup}>
          <button
            type="button"
            className={`${styles.btnToggle} ${dateType === "import" ? styles.btnActive : ""}`}
            onClick={() => setDateType("import")}
          >
            Import Date
          </button>
          <button
            type="button"
            className={`${styles.btnToggle} ${dateType === "publish" ? styles.btnActive : ""}`}
            onClick={() => setDateType("publish")}
          >
            Publish Date
          </button>
        </div>
      </div>

      <div className={styles.controlGroup}>
        <span className={styles.controlLabel}>Granularity</span>
        <div className={styles.buttonGroup}>
          {(["day", "week", "month", "year"] as HistoryGranularity[]).map(
            (g) => (
              <button
                key={g}
                type="button"
                className={`${styles.btnToggle} ${granularity === g ? styles.btnActive : ""}`}
                onClick={() => setGranularity(g)}
              >
                {g.charAt(0).toUpperCase() + g.slice(1)}
              </button>
            ),
          )}
        </div>
      </div>

      <div className={styles.controlGroup}>
        <span className={styles.controlLabel}>Date Range</span>
        <div className={styles.dateInputs}>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className={styles.dateInput}
            aria-label="Start Date"
          />
          <span className={styles.dateSeparator}>to</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className={styles.dateInput}
            aria-label="End Date"
          />
        </div>
      </div>

      <div className={styles.controlGroupCheckbox}>
        <span className={styles.controlLabel}>Y-Axis Bounds</span>
        <label className={styles.checkboxLabel}>
          <input
            type="checkbox"
            checked={autoScaleY}
            onChange={(e) => setAutoScaleY(e.target.checked)}
            className={styles.checkboxInput}
          />
          <span>Auto-scale</span>
        </label>
      </div>
    </div>
  );
}
