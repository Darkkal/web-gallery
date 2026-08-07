import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getDynamicPlaylistPostIds } from "@/lib/db/repositories/media";
import { playlists } from "@/lib/db/schema";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const numericId = parseInt(id, 10);
  if (Number.isNaN(numericId)) {
    return NextResponse.json({ error: "Invalid playlist ID" }, { status: 400 });
  }

  const playlist = await db.query.playlists.findFirst({
    where: eq(playlists.id, numericId),
  });
  if (!playlist) {
    return NextResponse.json({ error: "Playlist not found" }, { status: 404 });
  }

  if (playlist.type !== "dynamic") {
    return NextResponse.json(
      { error: "Post IDs are only available for dynamic playlists" },
      { status: 400 },
    );
  }

  const result = await getDynamicPlaylistPostIds({
    search: playlist.searchQuery ?? "",
  });

  return NextResponse.json(result);
}
