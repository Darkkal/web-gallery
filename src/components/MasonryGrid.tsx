'use client';

import React, { useEffect, useMemo, useState } from 'react';
import styles from '@/components/MasonryGrid.module.css';

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

export default function MasonryGrid<T>({ items, renderItem, columnCount: userColumnCount }: MasonryGridProps<T>) {
    const [windowWidth, setWindowWidth] = useState<number | null>(() => {
        if (typeof window === 'undefined') return null;
        return window.innerWidth;
    });

    useEffect(() => {
        if (userColumnCount) return;

        const handleResize = () => {
            setWindowWidth(window.innerWidth);
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [userColumnCount]);

    const currentColumnCount = userColumnCount ?? (windowWidth !== null ? getColumnCount(windowWidth) : 3);

    const columns = useMemo(() => {
        const newColumns: T[][] = Array.from({ length: currentColumnCount }, () => []);
        items.forEach((item, index) => {
            const columnIndex = index % currentColumnCount;
            newColumns[columnIndex].push(item);
        });
        return newColumns;
    }, [items, currentColumnCount]);

    return (
        <div className={styles.container} data-testid="masonry-grid">
            {columns.map((col, colIndex) => (
                <div key={colIndex} className={styles.column}>
                    {col.map((item, itemIndex) => {
                        const originalIndex = itemIndex * currentColumnCount + colIndex;
                        return (
                            <React.Fragment key={colIndex + '-' + itemIndex}>
                                {renderItem(item, originalIndex)}
                            </React.Fragment>
                        );
                    })}
                </div>
            ))}
        </div>
    );
}
