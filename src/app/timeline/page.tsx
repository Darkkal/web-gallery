import type { Metadata } from "next";
import { getTimelinePosts } from "@/app/actions/timeline";
import TimelinePageClient from "@/app/timeline/page-client";
import { getAppSettings } from "@/lib/settings";

export const metadata: Metadata = { title: "Timeline" };

export default async function TimelinePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const search = (params.search as string) || "";
  const sortBy = (params.sortBy as string) || "created-desc";

  // Read app settings
  const settings = await getAppSettings();
  const limit = settings.timelinePageSize || 20;
  const scrollMode = settings.scrollMode || "infinite";
  const autoplayVideos = settings.autoplayVideos ?? false;
  const muteAutoplayVideos = settings.muteAutoplayVideos ?? true;

  // Initial data fetch — respecting configured page size
  const { posts, nextCursor } = await getTimelinePosts({
    search,
    sortBy,
    limit,
  });

  // Ensure data is serializable
  const initialPosts = JSON.parse(JSON.stringify(posts));

  return (
    <TimelinePageClient
      initialPosts={initialPosts}
      initialNextCursor={nextCursor}
      initialSearch={search}
      initialSort={sortBy}
      pageSize={limit}
      scrollMode={scrollMode}
      infiniteScrollBuffer={settings.infiniteScrollBuffer ?? 300}
      loopVideos={settings.loopVideos}
      autoplayVideos={autoplayVideos}
      muteAutoplayVideos={muteAutoplayVideos}
      condensePostText={settings.condensePostText ?? true}
      condensePostLines={settings.condensePostLines ?? 2}
    />
  );
}
