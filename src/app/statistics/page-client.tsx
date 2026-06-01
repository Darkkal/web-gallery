"use client";

import {
  BarChart3,
  HardDrive,
  Image,
  Sparkles,
  Tag,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import { formatBytes } from "@/lib/utils/format";
import type { AppSettings } from "@/types/settings";
import type {
  HistoryDateType,
  HistoryGranularity,
  LibraryStatistics,
  StatisticsHistoryPoint,
} from "@/types/statistics";
import ChartControls from "./components/ChartControls";
import HistoryChart from "./components/HistoryChart";
import RankingSection from "./components/RankingSection";
import StatCard from "./components/StatCard";
import styles from "./page.module.css";

interface StatisticsPageClientProps {
  initialStats: LibraryStatistics;
  appSettings: AppSettings;
}

export default function StatisticsPageClient({
  initialStats,
  appSettings,
}: StatisticsPageClientProps) {
  const [stats, setStats] = useState<LibraryStatistics>(initialStats);
  const [historyData, setHistoryData] = useState<StatisticsHistoryPoint[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  // Chart States
  const [metric, setMetric] = useState<string>("posts");
  const [dateType, setDateType] = useState<HistoryDateType>("import");
  const [granularity, setGranularity] = useState<HistoryGranularity>("month");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [autoScaleY, setAutoScaleY] = useState<boolean>(true);

  // Poll current statistics once on load to get the freshest data
  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch("/api/statistics?section=summary");
        if (res.ok) {
          const json = await res.json();
          setStats(json);
        }
      } catch (err) {
        console.error("[Statistics] Failed to refresh summary stats:", err);
      }
    }
    fetchStats();
  }, []);

  // Fetch history data on control changes
  useEffect(() => {
    async function fetchHistory() {
      setLoadingHistory(true);
      try {
        let url = `/api/statistics?section=history&dateType=${dateType}&granularity=${granularity}`;
        if (startDate) url += `&startDate=${startDate}`;
        if (endDate) url += `&endDate=${endDate}`;

        const res = await fetch(url);
        if (res.ok) {
          const json = await res.json();
          setHistoryData(json);
        }
      } catch (err) {
        console.error("[Statistics] Failed to fetch history:", err);
      } finally {
        setLoadingHistory(false);
      }
    }
    fetchHistory();
  }, [dateType, granularity, startDate, endDate]);

  const showStorage = appSettings.computeStorageStatistics ?? true;
  const rankingLimit = appSettings.statisticsRankingLimit ?? 10;

  return (
    <div className={styles.container}>
      {/* Page Header */}
      <div className={styles.header}>
        <h1 className={styles.title}>Library Statistics</h1>
        <p className={styles.subtitle}>
          Insights and analytics for posts, media, tags, and extractors
        </p>
      </div>

      {/* Summary Cards */}
      <div className={styles.summaryGrid}>
        <StatCard
          label="Total Posts"
          value={stats.totalPosts}
          icon={Sparkles}
        />
        <StatCard
          label="Media Items"
          value={stats.totalMediaItems}
          icon={Image}
        />
        <StatCard label="Total Tags" value={stats.totalTags} icon={Tag} />
        <StatCard label="Active Users" value={stats.totalUsers} icon={Users} />
        <StatCard
          label="Extractors"
          value={stats.totalExtractors}
          icon={BarChart3}
        />
        {showStorage && (
          <StatCard
            label="Storage Used"
            value={stats.storageBytes}
            icon={HardDrive}
            format={formatBytes}
          />
        )}
      </div>

      {/* Cumulative Growth Chart */}
      <div className={styles.chartSection}>
        <div className={styles.chartHeader}>
          <h2 className={styles.chartTitle}>Cumulative Library Growth</h2>
        </div>

        <ChartControls
          metric={metric}
          setMetric={setMetric}
          dateType={dateType}
          setDateType={setDateType}
          granularity={granularity}
          setGranularity={setGranularity}
          startDate={startDate}
          setStartDate={setStartDate}
          endDate={endDate}
          setEndDate={setEndDate}
          showStorage={showStorage}
          autoScaleY={autoScaleY}
          setAutoScaleY={setAutoScaleY}
        />

        {loadingHistory ? (
          <div className={styles.chartPlaceholder}>
            <div
              className={`${styles.shimmerEffect}`}
              style={{
                height: "100%",
                width: "100%",
                borderRadius: "var(--radius)",
              }}
            ></div>
          </div>
        ) : (
          <HistoryChart
            data={historyData}
            metric={metric}
            autoScaleY={autoScaleY}
          />
        )}
      </div>

      {/* Top Rankings Section */}
      <RankingSection
        title="Top Tags"
        type="tag"
        apiSection="topTags"
        limit={rankingLimit}
      />

      <RankingSection
        title="Top Users"
        type="user"
        apiSection="topUsers"
        limit={rankingLimit}
      />

      <RankingSection
        title="Top Extractors"
        type="extractor"
        apiSection="topExtractors"
        limit={rankingLimit}
      />
    </div>
  );
}
