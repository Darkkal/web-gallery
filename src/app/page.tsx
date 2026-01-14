import styles from './page.module.css';
import Link from 'next/link';

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
        <Link href="/gallery" className={styles.card}>
          <h2>Gallery &rarr;</h2>
          <p>Browse your collected images and videos.</p>
        </Link>
        <Link href="/timeline" className={styles.card}>
          <h2>Timeline &rarr;</h2>
          <p>View content in chronological order.</p>
        </Link>
        <div className={styles.card}>
          <h2>Playlists &rarr;</h2>
          <p>Organize your favorites.</p>
        </div>
        <Link href="/sources" className={styles.card}>
          <h2>Sources &rarr;</h2>
          <p>Manage scraped URLs and creators.</p>
        </Link>
      </div>
    </main>
  );
}
