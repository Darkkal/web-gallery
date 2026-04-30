import { useState } from 'react';

export function useSelection<T = number>() {
    const [selectionMode, setSelectionMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<T>>(new Set());

    const toggleSelection = (id: T) => {
        const newSelected = new Set(selectedIds);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedIds(newSelected);
    };

    const toggleGroupSelection = (ids: T[], primaryId: T) => {
        const newSelected = new Set(selectedIds);
        const isPrimarySelected = newSelected.has(primaryId);

        if (isPrimarySelected) {
            ids.forEach((id) => newSelected.delete(id));
        } else {
            ids.forEach((id) => newSelected.add(id));
        }
        setSelectedIds(newSelected);
    };

    const selectAll = (allIds: T[]) => {
        if (selectedIds.size === allIds.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(allIds));
        }
    };

    const clearSelection = () => {
        setSelectedIds(new Set());
        setSelectionMode(false);
    };

    return {
        selectionMode,
        setSelectionMode,
        selectedIds,
        setSelectedIds,
        toggleSelection,
        toggleGroupSelection,
        selectAll,
        clearSelection,
        selectedCount: selectedIds.size,
    };
}
