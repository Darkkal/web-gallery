import styles from '@/app/loading.module.css';

export default function ScrapeLoading() {
  return (
    <div data-testid="loading-skeleton" className={styles.container} style={{ height: '100vh', overflow: 'hidden' }}>
      <div className={`${styles.skeleton} ${styles.section}`} style={{ height: '200px', flexShrink: 0 }}></div>
      
      <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '1rem' }}>
        {[...Array(3)].map((_, i) => (
          <div key={i} className={`${styles.skeleton}`} style={{ height: '2.5rem', flex: 1 }}></div>
        ))}
      </div>

      <div className={`${styles.skeleton} ${styles.section}`} style={{ flex: 1, padding: 0 }}>
        <div style={{ height: '3rem', borderBottom: '1px solid hsl(var(--border))', padding: '0 1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {[...Array(5)].map((_, i) => (
            <div key={i} className={`${styles.skeleton}`} style={{ height: '1rem', flex: 1 }}></div>
          ))}
        </div>
        {[...Array(10)].map((_, i) => (
          <div key={i} style={{ height: '4rem', borderBottom: '1px solid hsl(var(--border))', padding: '0 1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            {[...Array(5)].map((_, j) => (
              <div key={j} className={`${styles.skeleton}`} style={{ height: '1rem', flex: 1 }}></div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
