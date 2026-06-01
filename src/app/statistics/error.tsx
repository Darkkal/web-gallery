"use client";

import { useEffect } from "react";
import styles from "./page.module.css";

interface ErrorProps {
  error: Error;
  reset: () => void;
}

export default function StatisticsError({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error("[Statistics Error Boundary] Encountered error:", error);
  }, [error]);

  return (
    <div className={styles.errorContainer}>
      <h1 className={styles.errorTitle}>Something went wrong!</h1>
      <p className={styles.errorMessage}>
        {error.message ||
          "An unexpected error occurred while loading statistics."}
      </p>
      <button type="button" onClick={reset} className={styles.btnRetry}>
        Try Again
      </button>
    </div>
  );
}
