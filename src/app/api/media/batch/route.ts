import { NextResponse } from "next/server";
import { getMediaItemsByIds } from "@/lib/db/repositories/media";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const idsParam = searchParams.get("ids") || "";

  if (!idsParam) {
    return NextResponse.json({ items: {} });
  }

  const ids = idsParam
    .split(",")
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => !Number.isNaN(n));

  const itemsMap = await getMediaItemsByIds(ids);
  return NextResponse.json({ items: itemsMap });
}
