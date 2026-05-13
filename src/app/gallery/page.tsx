import type { Metadata } from "next";
import { getMediaItems } from "@/app/actions/gallery";
import GalleryPageClient from "@/app/gallery/page-client";

export const metadata: Metadata = { title: "Gallery" };

export default async function GalleryPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const search = (params.search as string) || "";
  const sortBy = (params.sortBy as string) || "created-desc";

  // Initial data fetch on the server — reduced from 50 for faster first paint
  const filters = { search, sortBy, limit: 20 };
  const { items, nextCursor } = await getMediaItems(filters);

  // Ensure data is serializable
  const initialItems = JSON.parse(JSON.stringify(items));

  return (
    <GalleryPageClient
      initialItems={initialItems}
      initialSearch={search}
      initialSort={sortBy}
      initialNextCursor={nextCursor}
    />
  );
}
