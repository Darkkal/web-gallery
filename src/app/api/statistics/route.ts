import { NextResponse } from "next/server";
import * as statsRepo from "@/lib/db/repositories/statistics";
import { getAppSettings } from "@/lib/settings";
import type {
  HistoryDateType,
  HistoryGranularity,
  RankingSortBy,
  SortOrder,
} from "@/types/statistics";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const section = searchParams.get("section") || "summary";

    if (section === "summary") {
      const data = await statsRepo.getStatistics();
      return NextResponse.json(data);
    }

    if (section === "history") {
      const dateType = (searchParams.get("dateType") ||
        "import") as HistoryDateType;
      const granularity = (searchParams.get("granularity") ||
        "month") as HistoryGranularity;
      const startDate = searchParams.get("startDate") || undefined;
      const endDate = searchParams.get("endDate") || undefined;

      const data = await statsRepo.getHistory(
        dateType,
        granularity,
        startDate,
        endDate,
      );
      return NextResponse.json(data);
    }

    // Top-N Ranked sections
    const sortBy = (searchParams.get("sortBy") || "count") as RankingSortBy;
    const sortOrder = (searchParams.get("sortOrder") || "desc") as SortOrder;

    const settings = await getAppSettings();
    const defaultLimit = settings.statisticsRankingLimit ?? 10;
    const limitParam = searchParams.get("limit");
    const limit = limitParam ? parseInt(limitParam, 10) : defaultLimit;

    if (section === "topTags") {
      const data = await statsRepo.getTopTags(sortBy, sortOrder, limit);
      return NextResponse.json(data);
    }

    if (section === "topUsers") {
      const data = await statsRepo.getTopUsers(sortBy, sortOrder, limit);
      return NextResponse.json(data);
    }

    if (section === "topExtractors") {
      const data = await statsRepo.getTopExtractors(sortBy, sortOrder, limit);
      return NextResponse.json(data);
    }

    return NextResponse.json(
      { error: "Invalid section parameter" },
      { status: 400 },
    );
  } catch (error: any) {
    console.error("[Statistics API] Error fetching stats:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal Server Error",
      },
      { status: 500 },
    );
  }
}
