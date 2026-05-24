import styles from "@/app/loading.module.css";

export default function PlaylistDetailLoading() {
  return (
    <div data-testid="loading-skeleton" className={styles.container}>
      <div className={styles.header}>
        <div
          className={styles.controls}
          style={{ flexDirection: "column", gap: "0.5rem" }}
        >
          <div
            className={`${styles.skeleton} ${styles.title}`}
            style={{ width: "250px", height: "2.5rem" }}
          ></div>
          <div
            className={styles.skeleton}
            style={{ width: "400px", height: "1.25rem" }}
          ></div>
        </div>
        <div className={styles.controls}>
          <div
            className={`${styles.skeleton} ${styles.controlItem}`}
            style={{ width: "100px", height: "2.25rem" }}
          ></div>
          <div
            className={`${styles.skeleton} ${styles.controlItem}`}
            style={{ width: "100px", height: "2.25rem" }}
          ></div>
        </div>
      </div>

      <div
        className={styles.tableContainer}
        style={{
          border: "1px solid hsl(var(--border))",
          borderRadius: "var(--radius)",
          overflow: "hidden",
        }}
      >
        {[...Array(6)].map((_, i) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: Static skeleton rows
            key={i}
            className={styles.skeleton}
            style={{
              height: "60px",
              borderBottom: "1px solid hsl(var(--border))",
              width: "100%",
            }}
          ></div>
        ))}
      </div>
    </div>
  );
}
