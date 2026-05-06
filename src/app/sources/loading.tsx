import styles from '@/app/loading.module.css';

export default function SourcesLoading() {
  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={`${styles.skeleton} ${styles.title}`}></div>
      </div>
      
      <div className={`${styles.skeleton} ${styles.section}`} style={{ height: '5rem' }}></div>
      
      <div className={styles.header}>
        <div className={styles.controls}>
          <div className={`${styles.skeleton} ${styles.controlItem}`} style={{ width: '200px' }}></div>
        </div>
        <div className={styles.controls}>
          <div className={`${styles.skeleton} ${styles.controlItem}`} style={{ width: '40px' }}></div>
          <div className={`${styles.skeleton} ${styles.controlItem}`} style={{ width: '150px' }}></div>
        </div>
      </div>

      <div className={styles.grid}>
        {[...Array(8)].map((_, i) => (
          <div key={i} className={`${styles.skeleton} ${styles.card}`}></div>
        ))}
      </div>
    </div>
  );
}
