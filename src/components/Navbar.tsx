"use client";

import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Database,
  Download,
  Filter,
  Image,
  LayoutGrid,
  Library,
  ListMusic,
  Moon,
  Settings,
  Sun,
  Tag,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import styles from "@/components/Navbar.module.css";
import { useTheme } from "@/components/ThemeProvider";

const NAV_ITEMS = [
  {
    label: "Timeline",
    href: "/timeline",
    icon: Clock,
  },
  {
    label: "Gallery",
    href: "/gallery",
    icon: Image,
  },
  {
    label: "Playlists",
    href: "/playlists",
    icon: ListMusic,
  },
  {
    label: "Sources",
    href: "/sources",
    icon: Database,
  },
  {
    label: "Scrape",
    href: "/scrape",
    icon: Download,
  },
  {
    label: "Library",
    href: "/library",
    icon: Library,
  },
  {
    label: "Tags",
    href: "/tags",
    icon: Tag,
  },
];

const MOBILE_GROUPS = [
  {
    id: "display",
    label: "Display",
    href: "/timeline",
    icon: LayoutGrid,
    items: [
      { label: "Timeline", href: "/timeline", icon: Clock },
      { label: "Gallery", href: "/gallery", icon: Image },
    ],
  },
  {
    id: "download",
    label: "Download",
    href: "/sources",
    icon: Download,
    items: [
      { label: "Sources", href: "/sources", icon: Database },
      { label: "Scrape", href: "/scrape", icon: Download },
    ],
  },
  {
    id: "filter",
    label: "Filter",
    href: "/tags",
    icon: Filter,
    items: [
      { label: "Tags", href: "/tags", icon: Tag },
      { label: "Playlists", href: "/playlists", icon: ListMusic },
    ],
  },
  {
    id: "config",
    label: "Config",
    href: "/library",
    icon: Settings,
    items: [{ label: "Library", href: "/library", icon: Library }],
  },
];

export function Navbar() {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [activeGroupSheet, setActiveGroupSheet] = useState<string | null>(null);
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    const saved = localStorage.getItem("navbar-collapsed");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reading client-only state after hydration
    if (saved) setIsCollapsed(saved === "true");
  }, []);

  const toggleCollapse = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    localStorage.setItem("navbar-collapsed", String(newState));
  };

  return (
    <>
      {activeGroupSheet && (
        // biome-ignore lint/a11y/noStaticElementInteractions: Backdrop click-to-dismiss is standard
        // biome-ignore lint/a11y/useKeyWithClickEvents: Backdrop does not need separate key events
        <div
          className={styles.sheetOverlay}
          onClick={() => setActiveGroupSheet(null)}
        />
      )}

      {MOBILE_GROUPS.map((group) => {
        if (group.items.length <= 1) return null;
        const isOpen = activeGroupSheet === group.id;
        return (
          <div key={group.id} className={styles.groupSheet} data-open={isOpen}>
            <div className={styles.sheetHeader}>
              <span className={styles.sheetTitle}>{group.label}</span>
            </div>
            <div className={styles.sheetItems}>
              {group.items.map((subItem) => {
                const isSubActive = pathname === subItem.href;
                const SubIcon = subItem.icon;
                return (
                  <Link
                    key={subItem.href}
                    href={subItem.href}
                    className={styles.sheetLink}
                    data-active={isSubActive}
                    onClick={() => setActiveGroupSheet(null)}
                  >
                    <SubIcon className={styles.sheetIcon} />
                    <span>{subItem.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        );
      })}

      <nav className={styles.navbar} data-collapsed={isCollapsed}>
        {/* Desktop navigation list */}
        <div className={styles.desktopItems}>
          {NAV_ITEMS.map((item) => {
            const isActive = pathname.startsWith(item.href);
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={styles.link}
                data-active={isActive}
                title={isCollapsed ? item.label : undefined}
              >
                <Icon className={styles.icon} />
                <span className={styles.label}>{item.label}</span>
              </Link>
            );
          })}
        </div>

        {/* Mobile navigation list */}
        <div className={styles.mobileItems}>
          {MOBILE_GROUPS.map((group) => {
            const isActive = group.items.some((item) =>
              pathname.startsWith(item.href),
            );
            const Icon = group.icon;
            const hasMultiple = group.items.length > 1;

            if (hasMultiple) {
              return (
                <button
                  key={group.id}
                  type="button"
                  className={styles.mobileLink}
                  data-active={isActive}
                  onClick={() =>
                    setActiveGroupSheet(
                      activeGroupSheet === group.id ? null : group.id,
                    )
                  }
                >
                  <Icon className={styles.icon} />
                  <span className={styles.label}>{group.label}</span>
                </button>
              );
            }

            return (
              <Link
                key={group.id}
                href={group.href}
                className={styles.mobileLink}
                data-active={isActive}
                onClick={() => setActiveGroupSheet(null)}
              >
                <Icon className={styles.icon} />
                <span className={styles.label}>{group.label}</span>
              </Link>
            );
          })}
        </div>

        <div className={styles.footer}>
          <button
            type="button"
            className={`${styles.collapseButton} ${styles.themeToggle}`}
            onClick={toggleTheme}
            aria-label="Toggle theme"
          >
            {theme === "dark" ? <Sun size={20} /> : <Moon size={20} />}
            {!isCollapsed && <span className={styles.label}>Theme</span>}
          </button>

          <button
            type="button"
            className={styles.collapseButton}
            onClick={toggleCollapse}
            aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isCollapsed ? (
              <ChevronRight size={20} />
            ) : (
              <ChevronLeft size={20} />
            )}
          </button>
        </div>
      </nav>
    </>
  );
}
