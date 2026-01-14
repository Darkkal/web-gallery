import styles from './page.module.css';

export default function Home() {
  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <h1 className={styles.title}>Personal Web Gallery</h1>
        <p className={styles.description}>
          Your local archive for social media and creative content.
        </p>
      </header>

      <div className={styles.grid}>
        <div className={styles.card}>
          <h2>Gallery &rarr;</h2>
          <p>Browse your collected images and videos.</p>
        </div>
        <div className={styles.card}>
          <h2>Timeline &rarr;</h2>
          <p>View content in chronological order.</p>
        </div>
        <div className={styles.card}>
          <h2>Playlists &rarr;</h2>
          <p>Organize your favorites.</p>
        </div>
        <div className={styles.card}>
          <h2>Sources &rarr;</h2>
          <p>Manage scraped URLs and creators.</p>
        </div>
      </div>
    </main>
  );
}
