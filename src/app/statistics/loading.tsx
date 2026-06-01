import styles from "./page.module.css";

export default function StatisticsLoading() {
  return (
    <div data-testid="loading-skeleton" className={styles.container}>
      {/* Header Skeleton */}
      <div className={styles.header}>
        <div
          className={`${styles.shimmerEffect}`}
          style={{
            width: "250px",
            height: "2.5rem",
            borderRadius: "8px",
            marginBottom: "0.5rem",
          }}
        ></div>
        <div
          className={`${styles.shimmerEffect}`}
          style={{ width: "400px", height: "1.25rem", borderRadius: "4px" }}
        ></div>
      </div>

      {/* Summary Row Skeleton */}
      <div className={styles.loadingGrid}>
        {[...Array(6)].map((_, i) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: Static skeleton cards
            key={i}
            className={`${styles.statCard}`}
            style={{ height: "120px" }}
          >
            <div className={styles.statCardHeader}>
              <div
                className={`${styles.shimmerEffect}`}
                style={{ width: "80px", height: "1rem", borderRadius: "4px" }}
              ></div>
              <div
                className={`${styles.shimmerEffect}`}
                style={{
                  width: "1.25rem",
                  height: "1.25rem",
                  borderRadius: "50%",
                }}
              ></div>
            </div>
            <div
              className={`${styles.shimmerEffect}`}
              style={{ width: "120px", height: "2.25rem", borderRadius: "6px" }}
            ></div>
          </div>
        ))}
      </div>

      {/* Chart Card Skeleton */}
      <div className={styles.chartSection} style={{ minHeight: "500px" }}>
        <div
          className={`${styles.shimmerEffect}`}
          style={{ width: "200px", height: "1.5rem", borderRadius: "4px" }}
        ></div>
        <div
          className={`${styles.shimmerEffect}`}
          style={{ width: "100%", height: "80px", borderRadius: "6px" }}
        ></div>
        <div
          className={`${styles.shimmerEffect}`}
          style={{ width: "100%", height: "350px", borderRadius: "8px" }}
        ></div>
      </div>
    </div>
  );
}
