import { useState } from 'react';

export type ScrollMode = 'infinite' | 'button';

const STORAGE_KEY = 'scroll-mode';
const DEFAULT: ScrollMode = 'infinite';

/**
 * Persists the user's preferred pagination mode (infinite scroll vs. load-more button)
 * in localStorage, following the same pattern as ThemeProvider and Navbar collapse.
 */
export function useScrollMode() {
    const [scrollMode, setScrollModeState] = useState<ScrollMode>(() => {
        if (typeof window === 'undefined') return DEFAULT;
        const saved = localStorage.getItem(STORAGE_KEY) as ScrollMode | null;
        if (saved === 'infinite' || saved === 'button') return saved;
        return DEFAULT;
    });

    const setScrollMode = (mode: ScrollMode) => {
        setScrollModeState(mode);
        localStorage.setItem(STORAGE_KEY, mode);
    };

    return { scrollMode, setScrollMode };
}
