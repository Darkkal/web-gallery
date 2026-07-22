import type { Metadata } from "next";
import { getMediaItems } from "@/app/actions/gallery";
import GalleryPageClient from "@/app/gallery/page-client";
import { getAppSettings } from "@/lib/settings";

export const metadata: Metadata = { title: "Gallery" };

export default async function GalleryPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const search = (params.search as string) || "";
  const sortBy = (params.sortBy as string) || "created-desc";
  const playlistParam =
    (params.playlist as string) || (params.playlistId as string) || "";
  const playlistId = playlistParam ? parseInt(playlistParam, 10) : undefined;

  // Read app settings
  const settings = await getAppSettings();
  const limit = settings.galleryPageSize || 50;
  const scrollMode = settings.scrollMode || "infinite";

  // Initial data fetch on the server — respecting configured page size
  const filters = {
    search,
    sortBy,
    limit,
    playlistId:
      playlistId && !Number.isNaN(playlistId) ? playlistId : undefined,
  };
  const { items, nextCursor } = await getMediaItems(filters);

  // Ensure data is serializable
  const initialItems = JSON.parse(JSON.stringify(items));

  return (
    <GalleryPageClient
      initialItems={initialItems}
      initialSearch={search}
      initialSort={sortBy}
      initialNextCursor={nextCursor}
      pageSize={limit}
      scrollMode={scrollMode}
      infiniteScrollBuffer={settings.infiniteScrollBuffer ?? 300}
      loopVideos={settings.loopVideos}
      autoplayVideos={settings.autoplayVideos ?? false}
      muteAutoplayVideos={settings.muteAutoplayVideos ?? true}
      autoHideControls={settings.lightboxAutoHideControls ?? false}
      autoHideDelay={settings.lightboxAutoHideDelay ?? 3}
      playlistId={
        playlistId && !Number.isNaN(playlistId) ? playlistId : undefined
      }
    />
  );
}
