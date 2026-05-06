import styles from '@/app/loading.module.css';

export default function LibraryLoading() {
  return (
    <div className={styles.container} style={{ padding: '4rem 2rem' }}>
      <div className={`${styles.skeleton} ${styles.title}`} style={{ height: '3.5rem', width: '300px', marginBottom: '2rem' }}></div>
      
      <div className={`${styles.skeleton} ${styles.section}`} style={{ height: '150px' }}></div>
      
      <div className={`${styles.skeleton} ${styles.section} ${styles.dangerZone}`} style={{ height: '180px', background: 'rgba(239, 68, 68, 0.05)', borderColor: 'rgba(239, 68, 68, 0.2)' }}></div>
    </div>
  );
}
