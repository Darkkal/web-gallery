"use client";

import React, { useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatBytes } from "@/lib/utils/format";
import type { StatisticsHistoryPoint } from "@/types/statistics";
import styles from "../page.module.css";

interface HistoryChartProps {
  data: StatisticsHistoryPoint[];
  metric: string;
  autoScaleY?: boolean;
}

export default function HistoryChart({
  data,
  metric,
  autoScaleY = true,
}: HistoryChartProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className={styles.chartContainer} style={{ height: "400px" }}>
        <div className={styles.chartPlaceholder}>
          <div
            className={styles.shimmerEffect}
            style={{ height: "100%", width: "100%" }}
          ></div>
        </div>
      </div>
    );
  }

  // Format y-axis values
  const formatYAxis = (value: number) => {
    if (metric === "storage") {
      return formatBytes(value);
    }
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(1)}M`;
    }
    if (value >= 1000) {
      return `${(value / 1000).toFixed(1)}k`;
    }
    return value.toString();
  };

  // Map metric keys to chart data fields
  const dataKeyMap: Record<string, keyof Omit<StatisticsHistoryPoint, "date">> =
    {
      posts: "totalPosts",
      media: "totalMediaItems",
      tags: "totalTags",
      users: "totalUsers",
      extractors: "totalExtractors",
      storage: "storageBytes",
    };

  const chartDataKey = dataKeyMap[metric] || "totalPosts";

  // Label mapping for tooltip display
  const labelMap: Record<string, string> = {
    posts: "Total Posts",
    media: "Total Media Items",
    tags: "Total Tags",
    users: "Total Users",
    extractors: "Total Extractors",
    storage: "Storage Used",
  };

  const metricLabel = labelMap[metric] || "Total Posts";

  // Custom tool tip component
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const value = payload[0].value;
      const formattedValue =
        metric === "storage" ? formatBytes(value) : value.toLocaleString();

      return (
        <div className={styles.customTooltip}>
          <p className={styles.tooltipLabel}>{label}</p>
          <p className={styles.tooltipValue}>
            <span className={styles.tooltipIndicator}></span>
            {metricLabel}: <strong>{formattedValue}</strong>
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div
      className={styles.chartContainer}
      style={{ height: "400px", width: "100%" }}
    >
      {data.length === 0 ? (
        <div className={styles.emptyChartState}>
          <span>No historical data available for the selected range.</span>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
            margin={{ top: 10, right: 30, left: 10, bottom: 0 }}
          >
            <defs>
              <linearGradient id="colorMetric" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="hsl(var(--primary))"
                  stopOpacity={0.4}
                />
                <stop
                  offset="95%"
                  stopColor="hsl(var(--primary))"
                  stopOpacity={0.0}
                />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="hsl(var(--border) / 0.3)"
              vertical={false}
            />
            <XAxis
              dataKey="date"
              stroke="hsl(var(--muted-foreground))"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              dy={10}
            />
            <YAxis
              stroke="hsl(var(--muted-foreground))"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              tickFormatter={formatYAxis}
              dx={-10}
              domain={autoScaleY ? ["auto", "auto"] : [0, "auto"]}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey={chartDataKey}
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorMetric)"
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
