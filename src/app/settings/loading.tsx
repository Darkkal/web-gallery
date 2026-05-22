import styles from "@/app/loading.module.css";

export default function SettingsLoading() {
  return (
    <div data-testid="loading-skeleton" className={styles.container}>
      <div className={styles.header}>
        <div
          className={`${styles.skeleton} ${styles.title}`}
          style={{ width: "300px", height: "2.5rem" }}
        />
      </div>

      <div
        className={styles.skeleton}
        style={{
          width: "100%",
          height: "400px",
          borderRadius: "var(--radius)",
          marginTop: "2rem",
        }}
      />
    </div>
  );
}
