import { NextResponse } from "next/server";
import * as playlistRepo from "@/lib/db/repositories/playlists";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") || "";
  const sortBy =
    searchParams.get("sort") || searchParams.get("sortBy") || "updated-desc";

  const playlists = await playlistRepo.getPlaylists({ search, sortBy });
  return NextResponse.json(playlists);
}
