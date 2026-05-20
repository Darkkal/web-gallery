import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { type NextRequest, NextResponse } from "next/server";
import { paths } from "@/lib/config";

const AVATARS_DIR = paths.avatars;

const MIME_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
};

/**
 * Serves cached avatar images from the avatars directory.
 * Catches all paths under /avatars/* and serves the corresponding file.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> },
) {
  const { path: pathSegments } = await params;

  if (!pathSegments || pathSegments.length === 0) {
    return NextResponse.rewrite(new URL("/not-found", request.url));
  }

  for (const segment of pathSegments) {
    if (segment === ".." || segment.startsWith("/") || segment.includes("\\")) {
      return NextResponse.rewrite(new URL("/not-found", request.url));
    }
  }

  const filePath = path.join(AVATARS_DIR, ...pathSegments);

  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(path.resolve(AVATARS_DIR))) {
    return NextResponse.rewrite(new URL("/not-found", request.url));
  }

  try {
    const stat = fs.statSync(resolved);
    if (stat.isDirectory()) {
      return NextResponse.rewrite(new URL("/not-found", request.url));
    }

    const ext = path.extname(resolved).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";

    const fileStream = fs.createReadStream(resolved);
    const webStream = Readable.toWeb(fileStream) as ReadableStream;

    return new NextResponse(webStream, {
      headers: {
        "Content-Type": contentType,
        "Content-Length": stat.size.toString(),
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch {
    return NextResponse.rewrite(new URL("/not-found", request.url));
  }
}
