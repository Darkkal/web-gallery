import styles from '@/app/loading.module.css';

export default function GalleryLoading() {
  return (
    <div data-testid="loading-skeleton" className={styles.container}>
      <div className={styles.header}>
        <div className={`${styles.skeleton} ${styles.title}`}></div>
        <div className={styles.controls}>
          <div className={`${styles.skeleton} ${styles.controlItem}`}></div>
          <div className={`${styles.skeleton} ${styles.controlItem}`}></div>
        </div>
      </div>
      
      <div className={`${styles.skeleton} ${styles.filterBar}`} style={{ marginBottom: '1rem', height: '4rem' }}></div>
      
      <div className={styles.grid}>
        {[...Array(12)].map((_, i) => (
          <div 
            key={i} 
            className={`${styles.skeleton} ${styles.card}`}
            style={{ 
              height: `${[250, 320, 200, 400][i % 4]}px`,
              aspectRatio: 'auto'
            }}
          ></div>
        ))}
      </div>
    </div>
  );
}
