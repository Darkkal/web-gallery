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

function getItemHeightFactor(item: any): number {
  if (!item) return 1.0;

  // 1. Direct preprocessed dimensions from DB
  if (item.item && item.item.width && item.item.height) {
    const factor = item.item.height / item.item.width;
    if (factor > 0) return factor;
  }

  // 2. Fallbacks for platform-specific details (in case they are not scanned/backfilled yet)
  if (item.pixiv?.width && item.pixiv?.height) {
    const factor = item.pixiv.height / item.pixiv.width;
    if (factor > 0) return factor;
  }
  if (item.gelbooru?.width && item.gelbooru?.height) {
    const factor = item.gelbooru.height / item.gelbooru.width;
    if (factor > 0) return factor;
  }

  // 3. Fallback for video files
  if (item.item?.mediaType === "video") {
    return 0.75;
  }

  // 4. Default square fallback
  return 1.0;
}
