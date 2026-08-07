import { NextResponse } from "next/server";
import { getMediaItemIds } from "@/lib/db/repositories/media";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") || "";
  const sortBy = searchParams.get("sortBy") || "created-desc";
  const playlistParam =
    searchParams.get("playlist") || searchParams.get("playlistId");
  const playlistId = playlistParam ? parseInt(playlistParam, 10) : undefined;

  const result = await getMediaItemIds({
    search,
    sortBy,
    playlistId:
      playlistId && !Number.isNaN(playlistId) ? playlistId : undefined,
  });

  return NextResponse.json(result);
}
