import styles from '@/app/loading.module.css';

export default function TimelineLoading() {
  return (
    <div data-testid="loading-skeleton" className={styles.container}>
      <div className={styles.feed}>
        <div className={styles.header} style={{ padding: '1rem', borderBottom: '1px solid hsl(var(--border))', marginBottom: 0 }}>
          <div className={`${styles.skeleton} ${styles.title}`} style={{ width: '120px', height: '2rem' }}></div>
          <div className={`${styles.skeleton} ${styles.controlItem}`} style={{ width: '80px', height: '2rem' }}></div>
        </div>
        
        <div className={`${styles.skeleton}`} style={{ margin: '1rem', height: '3.5rem', borderRadius: 'var(--radius)' }}></div>

        {[...Array(5)].map((_, i) => (
          <div key={i} className={styles.post}>
            <div className={styles.postHeader}>
              <div className={`${styles.skeleton} ${styles.avatar}`}></div>
              <div className={styles.postMeta}>
                <div className={`${styles.skeleton} ${styles.line}`} style={{ width: '30%' }}></div>
                <div className={`${styles.skeleton} ${styles.lineShort}`}></div>
              </div>
            </div>
            <div className={`${styles.skeleton} ${styles.line}`} style={{ marginLeft: '3.25rem', width: 'calc(100% - 3.25rem)' }}></div>
            <div className={`${styles.skeleton} ${styles.line}`} style={{ marginLeft: '3.25rem', width: 'calc(80% - 3.25rem)' }}></div>
            <div className={`${styles.skeleton} ${styles.media}`}></div>
          </div>
        ))}
      </div>
    </div>
  );
}
