"use client";

import type React from "react";
import { useEffect, useState } from "react";
import styles from "../page.module.css";

interface StatCardProps {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  format?: (val: number) => string;
  action?: React.ReactNode;
}

export default function StatCard({
  label,
  value,
  icon: Icon,
  format,
  action,
}: StatCardProps) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    // Simple animated counter on mount
    let start = 0;
    const end = value;
    if (end === 0) {
      setDisplayValue(0);
      return;
    }

    const duration = 800; // ms
    const increment = end / (duration / 16); // ~60fps

    const timer = setInterval(() => {
      start += increment;
      if (start >= end) {
        setDisplayValue(end);
        clearInterval(timer);
      } else {
        setDisplayValue(Math.floor(start));
      }
    }, 16);

    return () => clearInterval(timer);
  }, [value]);

  const formatted = format
    ? format(displayValue)
    : displayValue.toLocaleString();

  return (
    <div className={styles.statCard}>
      <div className={styles.statCardHeader}>
        <span className={styles.statCardLabel}>{label}</span>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          {action}
          <Icon className={styles.statCardIcon} />
        </div>
      </div>
      <div className={styles.statCardValue}>{formatted}</div>
    </div>
  );
}
