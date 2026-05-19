"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";
import { useEffect } from "react";
import styles from "@/app/status.module.css";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.iconDestructive}>
          <AlertTriangle size={32} />
        </div>

        <div>
          <h2 className={styles.title}>Something went wrong!</h2>
          <p className={styles.description}>
            An unexpected error occurred while loading this page.
          </p>
        </div>

        <button type="button" onClick={() => reset()} className={styles.button}>
          <RefreshCw size={18} />
          Try again
        </button>
      </div>
    </div>
  );
}
