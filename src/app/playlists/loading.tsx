import styles from "@/app/loading.module.css";

export default function PlaylistsLoading() {
  return (
    <div data-testid="loading-skeleton" className={styles.container}>
      <div className={styles.header}>
        <div
          className={`${styles.skeleton} ${styles.title}`}
          style={{ width: "200px", height: "2.5rem" }}
        ></div>
      </div>

      <div className={styles.header}>
        <div className={styles.controls}>
          <div
            className={`${styles.skeleton} ${styles.controlItem}`}
            style={{ width: "300px", height: "2.25rem" }}
          ></div>
        </div>
        <div className={styles.controls}>
          <div
            className={`${styles.skeleton} ${styles.controlItem}`}
            style={{ width: "120px", height: "2.25rem" }}
          ></div>
          <div
            className={`${styles.skeleton} ${styles.controlItem}`}
            style={{ width: "80px", height: "2.25rem" }}
          ></div>
        </div>
      </div>

      <div className={styles.grid}>
        {[...Array(8)].map((_, i) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: Static skeleton
            key={i}
            className={`${styles.skeleton} ${styles.card}`}
            style={{ height: "150px" }}
          ></div>
        ))}
      </div>
    </div>
  );
}
