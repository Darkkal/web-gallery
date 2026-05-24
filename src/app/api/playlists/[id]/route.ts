import { NextResponse } from "next/server";
import * as playlistRepo from "@/lib/db/repositories/playlists";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const numericId = parseInt(id, 10);

  if (Number.isNaN(numericId)) {
    return NextResponse.json({ error: "Invalid playlist ID" }, { status: 400 });
  }

  const playlist = await playlistRepo.getPlaylist(numericId);

  if (!playlist) {
    return NextResponse.json({ error: "Playlist not found" }, { status: 404 });
  }

  return NextResponse.json(playlist);
}
