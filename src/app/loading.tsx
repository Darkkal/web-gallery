import styles from '@/app/loading.module.css';

export default function RootLoading() {
  return (
    <div data-testid="loading-skeleton" className={styles.container} style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
      <div className={`${styles.skeleton}`} style={{ width: '40px', height: '40px', borderRadius: '50%' }}></div>
    </div>
  );
}
