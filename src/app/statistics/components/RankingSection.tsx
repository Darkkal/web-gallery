"use client";

import {
  ArrowDownWideNarrow,
  ArrowUpDown,
  ArrowUpWideNarrow,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useEffect, useState } from "react";
import type { RankingSortBy, SortOrder } from "@/types/statistics";
import styles from "../page.module.css";
import RankingCard from "./RankingCard";

interface RankingSectionProps {
  title: string;
  type: "tag" | "user" | "extractor";
  apiSection: "topTags" | "topUsers" | "topExtractors";
  limit: number;
}

export default function RankingSection({
  title,
  type,
  apiSection,
  limit,
}: RankingSectionProps) {
  // biome-ignore lint/suspicious/noExplicitAny: generic ranking data
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<RankingSortBy>("count");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/statistics?section=${apiSection}&sortBy=${sortBy}&sortOrder=${sortOrder}&limit=${limit}`,
        );
        if (res.ok) {
          const json = await res.json();
          setData(json);
        }
      } catch (err) {
        console.error(
          `[RankingSection] Failed to fetch top cards for ${type}:`,
          err,
        );
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [apiSection, sortBy, sortOrder, limit, type]);

  const toggleSortOrder = () => {
    setSortOrder((prev) => (prev === "desc" ? "asc" : "desc"));
  };

  const visibleCards = expanded ? data : data.slice(0, 5);
  const hasMore = data.length > 5;

  return (
    <div className={styles.rankingSection}>
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>{title}</h2>

        <div className={styles.sectionControls}>
          {/* Sort By Dropdown */}
          <div className={styles.sortSelectContainer}>
            <ArrowUpDown className={styles.sortIcon} />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as RankingSortBy)}
              className={styles.sortSelect}
              aria-label={`Sort ${title} by`}
            >
              <option value="count">Post Count</option>
              <option value="latest-added">Latest Imported</option>
              <option value="latest-used">Latest Published</option>
            </select>
          </div>

          {/* Sort Direction Toggle */}
          <button
            type="button"
            onClick={toggleSortOrder}
            className={styles.btnDirection}
            title={
              sortOrder === "desc" ? "Sorted Descending" : "Sorted Ascending"
            }
            aria-label="Toggle sort order"
          >
            {sortOrder === "desc" ? (
              <ArrowDownWideNarrow className={styles.sortDirectionIcon} />
            ) : (
              <ArrowUpWideNarrow className={styles.sortDirectionIcon} />
            )}
          </button>
        </div>
      </div>

      {loading ? (
        <div className={styles.cardsGridSkeleton}>
          {[...Array(expanded ? limit : Math.min(5, limit))].map((_, i) => (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: loading skeleton mock items
              key={i}
              className={`${styles.skeletonCard} ${styles.shimmerEffect}`}
              style={{ height: "180px", borderRadius: "12px" }}
            ></div>
          ))}
        </div>
      ) : data.length === 0 ? (
        <div className={styles.emptySectionState}>
          <span>
            No rankings found for this section. Scan some posts to populate
            data.
          </span>
        </div>
      ) : (
        <>
          <div className={styles.rankingGrid}>
            {visibleCards.map((item) => (
              <RankingCard
                key={item.id || item.name}
                id={item.id}
                type={type}
                name={item.name}
                value={item.value}
                avatar={item.avatar}
                topTags={item.topTags}
                topUsers={item.topUsers}
                topExtractors={item.topExtractors}
                backgroundImage={item.backgroundImage}
              />
            ))}
          </div>

          {hasMore && (
            <div className={styles.expandRow}>
              <button
                type="button"
                className={styles.btnExpand}
                onClick={() => setExpanded(!expanded)}
              >
                {expanded ? (
                  <>
                    <span>Show Less</span>
                    <ChevronUp className={styles.expandChevron} />
                  </>
                ) : (
                  <>
                    <span>Show All ({data.length})</span>
                    <ChevronDown className={styles.expandChevron} />
                  </>
                )}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
