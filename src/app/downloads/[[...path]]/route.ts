import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { type NextRequest, NextResponse } from "next/server";
import { paths } from "@/lib/config";

const DOWNLOADS_DIR = paths.downloads;

const MIME_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mkv": "video/x-matroska",
  ".avi": "video/x-msvideo",
  ".json": "application/json",
};

/**
 * Serves downloaded media files from the downloads directory.
 * Catches all paths under /downloads/* and serves the corresponding file.
 *
 * This route is needed because the media files live outside the Next.js
 * `public/` directory (on a separate mount), and symlinks aren't reliably
 * followed by the standalone server.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> },
) {
  const { path: pathSegments } = await params;

  if (!pathSegments || pathSegments.length === 0) {
    return NextResponse.rewrite(new URL("/not-found", request.url));
  }

  // Prevent path traversal — reject segments containing .. or absolute paths
  for (const segment of pathSegments) {
    if (segment === ".." || segment.startsWith("/") || segment.includes("\\")) {
      return NextResponse.rewrite(new URL("/not-found", request.url));
    }
  }

  const filePath = path.join(DOWNLOADS_DIR, ...pathSegments);

  // Verify the resolved path is still within downloads dir
  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(path.resolve(DOWNLOADS_DIR))) {
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
