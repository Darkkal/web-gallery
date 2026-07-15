import styles from "@/app/loading.module.css";

export default function TagsManageLoading() {
  return (
    <div data-testid="loading-skeleton" className={styles.container}>
      <div className={styles.header}>
        <div
          className={`${styles.skeleton} ${styles.title}`}
          style={{ width: "250px" }}
        />
        <div className={styles.controls}>
          <div className={`${styles.skeleton} ${styles.controlItem}`} />
          <div className={`${styles.skeleton} ${styles.controlItem}`} />
        </div>
      </div>

      <div
        className={styles.section}
        style={{ height: "100px", marginBottom: "1.5rem" }}
      >
        <div
          className={styles.skeleton}
          style={{ width: "100%", height: "100%" }}
        />
      </div>

      <div className={styles.section}>
        <div
          className={`${styles.skeleton} ${styles.tableRow}`}
          style={{ height: "2.5rem", marginBottom: "1rem" }}
        />
        {[...Array(8)].map((_, i) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: Static skeleton
            key={i}
            className={`${styles.skeleton} ${styles.tableRow}`}
          />
        ))}
      </div>
    </div>
  );
}
