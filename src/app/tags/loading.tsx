import styles from '@/app/loading.module.css';

export default function TagsLoading() {
  return (
    <div data-testid="loading-skeleton" className={styles.container}>
      <div className={styles.header}>
        <div className={`${styles.skeleton} ${styles.title}`}></div>
        <div className={styles.controls}>
          <div className={`${styles.skeleton}`} style={{ width: '100px', height: '2.5rem', borderRadius: '20px' }}></div>
          <div className={`${styles.skeleton}`} style={{ width: '100px', height: '2.5rem', borderRadius: '20px' }}></div>
          <div className={`${styles.skeleton}`} style={{ width: '100px', height: '2.5rem', borderRadius: '20px' }}></div>
        </div>
      </div>

      <div className={styles.tagGrid}>
        {[...Array(30)].map((_, i) => (
          <div key={i} className={`${styles.skeleton} ${styles.tagCard}`}></div>
        ))}
      </div>
    </div>
  );
}
