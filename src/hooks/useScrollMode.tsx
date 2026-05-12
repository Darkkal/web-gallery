'use client';

import { createContext, useContext, useState, useCallback } from 'react';

export type ScrollMode = 'infinite' | 'button';

const STORAGE_KEY = 'scroll-mode';
const DEFAULT: ScrollMode = 'infinite';

interface ScrollModeContextValue {
    scrollMode: ScrollMode;
    setScrollMode: (mode: ScrollMode) => void;
}

const ScrollModeContext = createContext<ScrollModeContextValue>({
    scrollMode: DEFAULT,
    setScrollMode: () => { },
});

function getInitialScrollMode(): ScrollMode {
    if (typeof window === 'undefined') return DEFAULT;
    const saved = localStorage.getItem(STORAGE_KEY) as ScrollMode | null;
    if (saved === 'infinite' || saved === 'button') return saved;
    return DEFAULT;
}

export function ScrollModeProvider({ children }: { children: React.ReactNode }) {
    const [scrollMode, setScrollModeState] = useState<ScrollMode>(getInitialScrollMode);

    const setScrollMode = useCallback((mode: ScrollMode) => {
        setScrollModeState(mode);
        localStorage.setItem(STORAGE_KEY, mode);
    }, []);

    return (
        <ScrollModeContext.Provider value={{ scrollMode, setScrollMode }}>
            {children}
        </ScrollModeContext.Provider>
    );
}

export function useScrollMode() {
    return useContext(ScrollModeContext);
}
