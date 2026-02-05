'use client';

import React, { useEffect, useState } from 'react';
import styles from './MasonryGrid.module.css';

interface MasonryGridProps<T> {
    items: T[];
    renderItem: (item: T, index: number) => React.ReactNode;
    columnCount?: number; // Optional prop to force column count, default is responsive
}

export default function MasonryGrid<T>({ items, renderItem, columnCount: userColumnCount }: MasonryGridProps<T>) {
    const [columns, setColumns] = useState<T[][]>([]);
    const [currentColumnCount, setCurrentColumnCount] = useState(3);

    useEffect(() => {
        if (userColumnCount) {
            setCurrentColumnCount(userColumnCount);
            return;
        }

        const handleResize = () => {
            const width = window.innerWidth;
            if (width < 640) {
                setCurrentColumnCount(1);
            } else if (width < 1024) {
                setCurrentColumnCount(2);
            } else if (width < 1500) {
                setCurrentColumnCount(3);
            } else {
                setCurrentColumnCount(4);
            }
        };

        handleResize(); // Initial check
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [userColumnCount]);

    useEffect(() => {
        // Distribute items into columns
        const newColumns: T[][] = Array.from({ length: currentColumnCount }, () => []);

        items.forEach((item, index) => {
            const columnIndex = index % currentColumnCount;
            newColumns[columnIndex].push(item);
        });

        setColumns(newColumns);
    }, [items, currentColumnCount]);

    return (
        <div className={styles.container} data-testid="masonry-grid">
            {columns.map((col, colIndex) => (
                <div key={colIndex} className={styles.column}>
                    {col.map((item, itemIndex) => {
                        // Calculate original index to pass to renderItem if needed, 
                        // though typically clients might rely on item ID or passed index
                        // Finding the original index in the flat array:
                        // Since we distribute round-robin: 
                        // item is at columns[colIndex][itemIndex]
                        // originalIndex = itemIndex * currentColumnCount + colIndex
                        // Validation:
                        // item 0: col 0, row 0 => 0*3 + 0 = 0
                        // item 1: col 1, row 0 => 0*3 + 1 = 1
                        // item 3: col 0, row 1 => 1*3 + 0 = 3

                        const originalIndex = itemIndex * currentColumnCount + colIndex;
                        // Guard against potential out of bounds if items changed rapidly?
                        // Actually, mapping over 'col' ensures existence.

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
