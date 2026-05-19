import { ArrowLeft, Home, SearchX } from "lucide-react";
import Link from "next/link";
import styles from "@/app/status.module.css";

export default function NotFound() {
  return (
    <div className={styles.container}>
      <div className={styles.glassCard}>
        {/* Icon */}
        <div className={styles.iconPrimary}>
          <SearchX size={36} />
        </div>

        {/* 404 number */}
        <h1 className={styles.gradientText}>404</h1>

        {/* Description */}
        <div>
          <h2 className={styles.title}>Page not found</h2>
          <p className={styles.description}>
            The page you&apos;re looking for doesn&apos;t exist or has been
            moved.
          </p>
        </div>

        {/* Navigation links */}
        <div className={styles.buttonGroup}>
          <Link href="/timeline" className={styles.button}>
            <Home size={18} />
            Go to Timeline
          </Link>
          <Link href="/gallery" className={styles.buttonSecondary}>
            <ArrowLeft size={18} />
            Go to Gallery
          </Link>
        </div>
      </div>
    </div>
  );
}
