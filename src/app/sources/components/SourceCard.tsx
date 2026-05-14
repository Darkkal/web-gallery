"use client";

import { Image as ImageIcon } from "lucide-react";
import { handleKeyActivate } from "@/lib/utils/a11y";
import styles from "@/app/sources/page.module.css";
import type { Source } from "@/types/source";

interface SourceCardProps {
  source: Source;
  isSelected: boolean;
  onToggleSelection: () => void;
}

export default function SourceCard({
  source,
  isSelected,
  onToggleSelection,
}: SourceCardProps) {
  const displayTitle = source.name || source.url.replace(/^https?:\/\//, "");

  return (
    // biome-ignore lint/a11y/useSemanticElements: Maintains current styling structure
    <div
      className={`${styles.card} ${isSelected ? styles.selected : ""}`}
      onClick={onToggleSelection}
      onKeyDown={handleKeyActivate(onToggleSelection)}
      role="button"
      tabIndex={0}
      aria-pressed={isSelected}
    >
      <div
        className={styles.cardBg}
        style={{
          backgroundImage: source.previewImage
            ? `url(${source.previewImage})`
            : "none",
        }}
      />
      {!source.previewImage && (
        <div className={styles.placeholderIcon}>
          <ImageIcon size={48} opacity={0.2} />
        </div>
      )}

      <div className={styles.cardOverlay}>
        <div className={styles.cardContent}>
          <div className={styles.cardTitle} title={source.url}>
            {displayTitle}
          </div>
          <div className={styles.cardMeta}>
            <span className={styles.badge}>{source.extractorType}</span>
          </div>
        </div>
      </div>

      <div className={styles.checkboxOverlay}>
        <input
          type="checkbox"
          checked={isSelected}
          readOnly
          className={styles.checkbox}
        />
      </div>
    </div>
  );
}
