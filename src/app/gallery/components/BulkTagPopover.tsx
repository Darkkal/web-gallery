"use client";

import { useEffect, useRef, useState } from "react";
import { bulkAddTagToPosts } from "@/app/actions/tags";
import TagAutocompleteInput from "@/components/TagAutocompleteInput";
import styles from "../page.module.css";

interface BulkTagPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  postIds: number[];
  onComplete: () => void;
}

export default function BulkTagPopover({
  isOpen,
  onClose,
  postIds,
  onComplete,
}: BulkTagPopoverProps) {
  const [stagedTags, setStagedTags] = useState<string[]>([]);
  const [isApplying, setIsApplying] = useState(false);
  const [progressText, setProgressText] = useState("");
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) {
      setStagedTags([]);
      setIsApplying(false);
      setProgressText("");
    }
  }, [isOpen]);

  // Click outside to close
  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(event: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node)
      ) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, onClose]);

  // Escape key to close
  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleAddStagedTag = (tagName: string) => {
    const trimmed = tagName.trim();
    if (
      trimmed &&
      !stagedTags.some((t) => t.toLowerCase() === trimmed.toLowerCase())
    ) {
      setStagedTags((prev) => [...prev, trimmed]);
    }
  };

  const handleRemoveStagedTag = (tagName: string) => {
    setStagedTags((prev) => prev.filter((t) => t !== tagName));
  };

  const handleApply = async () => {
    if (stagedTags.length === 0 || postIds.length === 0) return;
    setIsApplying(true);

    try {
      for (let i = 0; i < stagedTags.length; i++) {
        const tag = stagedTags[i];
        setProgressText(`Applying "${tag}" (${i + 1}/${stagedTags.length})...`);
        await bulkAddTagToPosts(postIds, tag);
      }
      onComplete();
    } catch (err) {
      alert(`Error applying tags: ${err}`);
    } finally {
      setIsApplying(false);
      setProgressText("");
    }
  };

  return (
    <div className={styles.bulkTagPopoverWrapper}>
      <div ref={popoverRef} className={styles.bulkTagPopover}>
        <h4 className={styles.bulkTagTitle}>Add Tags to Selection</h4>

        {postIds.length === 0 ? (
          <p className={styles.bulkTagWarning}>No posts are selected.</p>
        ) : (
          <>
            <div className={styles.bulkTagInputContainer}>
              <TagAutocompleteInput
                onTagSelected={handleAddStagedTag}
                placeholder="Search or enter tag name..."
                excludeTags={stagedTags}
                disabled={isApplying}
              />
            </div>

            {stagedTags.length > 0 && (
              <div className={styles.stagedTagChips}>
                {stagedTags.map((tag) => (
                  <span key={tag} className={styles.stagedTagChip}>
                    #{tag}
                    <button
                      type="button"
                      onClick={() => handleRemoveStagedTag(tag)}
                      className={styles.stagedTagRemoveBtn}
                      disabled={isApplying}
                      aria-label={`Remove staged tag ${tag}`}
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            )}

            {isApplying && (
              <div className={styles.progressText}>{progressText}</div>
            )}

            <div className={styles.bulkTagPopoverFooter}>
              <button
                type="button"
                className={styles.cancelTagsBtn}
                onClick={onClose}
                disabled={isApplying}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.applyTagsBtn}
                onClick={handleApply}
                disabled={isApplying || stagedTags.length === 0}
              >
                {isApplying
                  ? "Applying..."
                  : `Apply to ${postIds.length} Posts`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
