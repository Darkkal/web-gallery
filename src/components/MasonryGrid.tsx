"use client";

import React, { useEffect, useMemo, useState } from "react";
import styles from "@/components/MasonryGrid.module.css";

interface MasonryGridProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  columnCount?: number;
}

function getColumnCount(width: number): number {
  if (width < 640) return 1;
  if (width < 1024) return 2;
  if (width < 1500) return 3;
  return 4;
}

export default function MasonryGrid<T>({
  items,
  renderItem,
  columnCount: userColumnCount,
}: MasonryGridProps<T>) {
  const [windowWidth, setWindowWidth] = useState<number | null>(null);

  useEffect(() => {
    setWindowWidth(window.innerWidth);

    if (userColumnCount) return;

    const handleResize = () => {
      setWindowWidth(window.innerWidth);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [userColumnCount]);

  const currentColumnCount =
    userColumnCount ?? (windowWidth !== null ? getColumnCount(windowWidth) : 3);

  const columns = useMemo(() => {
    const newColumns: { item: T; originalIndex: number }[][] = Array.from(
      { length: currentColumnCount },
      () => [],
    );
    const columnHeights = new Array(currentColumnCount).fill(0);

    items.forEach((item, index) => {
      let minColIndex = 0;
      let minColHeight = columnHeights[0];
      for (let i = 1; i < currentColumnCount; i++) {
        if (columnHeights[i] < minColHeight) {
          minColHeight = columnHeights[i];
          minColIndex = i;
        }
      }
      newColumns[minColIndex].push({ item, originalIndex: index });
      columnHeights[minColIndex] += getItemHeightFactor(item);
    });

    return newColumns;
  }, [items, currentColumnCount]);

  return (
    <div className={styles.container} data-testid="masonry-grid">
      {columns.map((col, colIndex) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: Stable columns
          key={colIndex}
          className={styles.column}
        >
          {col.map(({ item, originalIndex }, itemIndex) => {
            return (
              <React.Fragment
                // biome-ignore lint/suspicious/noArrayIndexKey: Computed grid position
                key={`${colIndex}-${itemIndex}`}
              >
                {renderItem(item, originalIndex)}
              </React.Fragment>
            );
          })}
        </div>
      ))}
    </div>
  );
}

interface HasDimensions {
  item?: {
    width?: number | null;
    height?: number | null;
    mediaType?: string | null;
  } | null;
  pixiv?: {
    width?: number | null;
    height?: number | null;
  } | null;
  gelbooru?: {
    width?: number | null;
    height?: number | null;
  } | null;
}

function getItemHeightFactor(item: unknown): number {
  if (!item || typeof item !== "object") return 1.0;
  const obj = item as HasDimensions;

  // 1. Direct preprocessed dimensions from DB
  if (obj.item?.width && obj.item.height) {
    const factor = obj.item.height / obj.item.width;
    if (factor > 0) return factor;
  }

  // 2. Fallbacks for platform-specific details (in case they are not scanned/backfilled yet)
  if (obj.pixiv?.width && obj.pixiv?.height) {
    const factor = obj.pixiv.height / obj.pixiv.width;
    if (factor > 0) return factor;
  }
  if (obj.gelbooru?.width && obj.gelbooru?.height) {
    const factor = obj.gelbooru.height / obj.gelbooru.width;
    if (factor > 0) return factor;
  }

  // 3. Fallback for video files
  if (obj.item?.mediaType === "video") {
    return 0.75;
  }

  // 4. Default square fallback
  return 1.0;
}
