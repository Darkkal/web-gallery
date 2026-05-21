"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

export type ScrollMode = "infinite" | "button";

const STORAGE_KEY = "scroll-mode";
const DEFAULT: ScrollMode = "infinite";

interface ScrollModeContextValue {
  scrollMode: ScrollMode;
  setScrollMode: (mode: ScrollMode) => void;
}

const ScrollModeContext = createContext<ScrollModeContextValue>({
  scrollMode: DEFAULT,
  setScrollMode: () => {},
});

export function ScrollModeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [scrollMode, setScrollModeState] = useState<ScrollMode>(DEFAULT);

  const setScrollMode = useCallback((mode: ScrollMode) => {
    setScrollModeState(mode);
    localStorage.setItem(STORAGE_KEY, mode);
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as ScrollMode | null;
    if (saved === "infinite" || saved === "button") {
      setScrollModeState(saved);
    }
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
