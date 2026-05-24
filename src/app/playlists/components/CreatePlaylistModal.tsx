"use client";

import { X } from "lucide-react";
import type React from "react";
import { useEffect, useState } from "react";
import styles from "@/app/playlists/page.module.css";

interface CreatePlaylistModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (name: string, description?: string) => Promise<void>;
  initialName?: string;
  initialDescription?: string;
  title?: string;
}

export default function CreatePlaylistModal({
  isOpen,
  onClose,
  onSubmit,
  initialName = "",
  initialDescription = "",
  title = "Create Playlist",
}: CreatePlaylistModalProps) {
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setName(initialName);
      setDescription(initialDescription);
    }
  }, [isOpen, initialName, initialDescription]);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    try {
      await onSubmit(name.trim(), description.trim() || undefined);
      onClose();
    } catch (error) {
      console.error("Failed to submit playlist form:", error);
    } finally {
      setLoading(false);
    }
  }

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: Modal backdrop click
    <div
      className={styles.modalOverlay}
      onClick={onClose}
      onKeyDown={(e) => e.key === "Escape" && onClose()}
    >
      {/* biome-ignore lint/a11y/noStaticElementInteractions: Modal content box */}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: Stop click propagation */}
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>{title}</h2>
          <button
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Close modal"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className={styles.formGroup}>
            <label htmlFor="playlist-name" className={styles.label}>
              Name
            </label>
            <input
              id="playlist-name"
              type="text"
              className={styles.inputField}
              placeholder="e.g., Summer Vibes"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              // biome-ignore lint/a11y/noAutofocus: Focus input when modal opens
              autoFocus
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="playlist-desc" className={styles.label}>
              Description (Optional)
            </label>
            <textarea
              id="playlist-desc"
              className={styles.textareaField}
              placeholder="Give your playlist a short description..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className={styles.modalFooter}>
            <button
              type="button"
              className={styles.cancelBtn}
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={styles.submitBtn}
              disabled={loading || !name.trim()}
            >
              {loading ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
