import { NextResponse } from "next/server";
import { getTagsPaginated } from "@/lib/db/repositories/tags";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") || "";
  const category = searchParams.get("category") || "all";
  const sortBy = (searchParams.get("sortBy") as any) || "count";
  const limit = parseInt(searchParams.get("limit") || "50", 10);
  const cursor = searchParams.get("cursor") || undefined;

  const result = await getTagsPaginated({
    search,
    category,
    sortBy,
    limit: isNaN(limit) ? 50 : limit,
    cursor,
  });

  return NextResponse.json(result);
}
