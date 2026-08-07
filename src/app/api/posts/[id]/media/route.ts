import { NextResponse } from "next/server";
import { getPostMediaItems } from "@/lib/db/repositories/media";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const numericId = parseInt(id, 10);
  if (Number.isNaN(numericId)) {
    return NextResponse.json({ error: "Invalid post ID" }, { status: 400 });
  }

  const items = await getPostMediaItems(numericId);
  const mediaItems = items.map((row) => row.item);

  return NextResponse.json({ postId: numericId, mediaItems });
}
