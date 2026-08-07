import { NextResponse } from "next/server";
import * as mediaRepo from "@/lib/db/repositories/media";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const postId = parseInt(id, 10);
  if (Number.isNaN(postId)) {
    return NextResponse.json({ error: "Invalid post ID" }, { status: 400 });
  }

  const items = await mediaRepo.getPostMediaItems(postId);
  return NextResponse.json({ items });
}
