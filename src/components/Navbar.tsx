"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Image, Clock, ListMusic, Database, ChevronLeft, ChevronRight, Sun, Moon, Library, Tag } from "lucide-react";
import styles from "./Navbar.module.css";
import { useTheme } from "./ThemeProvider";

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

export function Navbar() {
    const pathname = usePathname();
    const [isCollapsed, setIsCollapsed] = useState(false);
    const { theme, toggleTheme } = useTheme();

    useEffect(() => {
        const saved = localStorage.getItem("navbar-collapsed");
        if (saved) setIsCollapsed(saved === "true");
    }, []);

    const toggleCollapse = () => {
        const newState = !isCollapsed;
        setIsCollapsed(newState);
        localStorage.setItem("navbar-collapsed", String(newState));
    };

    return (
        <nav className={styles.navbar} data-collapsed={isCollapsed}>
            <div className={styles.navItems}>
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

            <div className={styles.footer}>
                <button
                    className={`${styles.collapseButton} ${styles.themeToggle}`}
                    onClick={toggleTheme}
                    aria-label="Toggle theme"
                >
                    {theme === "dark" ? <Sun size={20} /> : <Moon size={20} />}
                    {!isCollapsed && <span className={styles.label}>Theme</span>}
                </button>

                <button
                    className={styles.collapseButton}
                    onClick={toggleCollapse}
                    aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                >
                    {isCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
                </button>
            </div>
        </nav>
    );
}
