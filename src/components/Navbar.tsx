"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Image, Clock, ListMusic, Database } from "lucide-react";
import styles from "./Navbar.module.css";

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
];

export function Navbar() {
    const pathname = usePathname();

    return (
        <nav className={styles.navbar}>
            {NAV_ITEMS.map((item) => {
                const isActive = pathname.startsWith(item.href);
                const Icon = item.icon;

                return (
                    <Link
                        key={item.href}
                        href={item.href}
                        className={styles.link}
                        data-active={isActive}
                    >
                        <Icon className={styles.icon} />
                        <span className={styles.label}>{item.label}</span>
                    </Link>
                );
            })}
        </nav>
    );
}
