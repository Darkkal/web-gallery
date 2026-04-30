import { useState } from 'react';

export function useLightbox(itemsLength: number, getGroupLength?: (index: number) => number) {
    const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
    const [mediaIndex, setMediaIndex] = useState(0);

    const open = (index: number, mIndex: number = 0) => {
        setSelectedIndex(index);
        setMediaIndex(mIndex);
    };

    const close = () => {
        setSelectedIndex(null);
    };

    const next = () => {
        if (selectedIndex === null) return;
        
        const groupLength = getGroupLength ? getGroupLength(selectedIndex) : 1;
        
        if (mediaIndex < groupLength - 1) {
            setMediaIndex(mediaIndex + 1);
        } else if (selectedIndex < itemsLength - 1) {
            setSelectedIndex(selectedIndex + 1);
            setMediaIndex(0);
        }
    };

    const prev = () => {
        if (selectedIndex === null) return;
        
        if (mediaIndex > 0) {
            setMediaIndex(mediaIndex - 1);
        } else if (selectedIndex > 0) {
            const prevIndex = selectedIndex - 1;
            setSelectedIndex(prevIndex);
            const prevGroupLength = getGroupLength ? getGroupLength(prevIndex) : 1;
            setMediaIndex(prevGroupLength - 1);
        }
    };

    return {
        selectedIndex,
        mediaIndex,
        isOpen: selectedIndex !== null,
        open,
        close,
        next,
        prev,
        setSelectedIndex,
        setMediaIndex
    };
}
