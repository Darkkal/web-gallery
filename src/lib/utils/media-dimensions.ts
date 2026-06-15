import { execFile } from "node:child_process";
import fsSync from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

function getCommandPath(command: string): string {
  const localBin = path.join(
    process.cwd(),
    "bin",
    process.platform === "win32" ? `${command}.exe` : command,
  );
  return fsSync.existsSync(localBin) ? localBin : command;
}

async function getVideoDimensions(
  filePath: string,
): Promise<{ width: number; height: number } | null> {
  try {
    const { stdout } = await execFileAsync(getCommandPath("ffprobe"), [
      "-v",
      "error",
      "-select_streams",
      "v:0",
      "-show_entries",
      "stream=width,height",
      "-of",
      "csv=s=x:p=0",
      filePath,
    ]);
    const [wStr, hStr] = stdout.trim().split("x");
    const width = parseInt(wStr, 10);
    const height = parseInt(hStr, 10);
    if (
      !Number.isNaN(width) &&
      !Number.isNaN(height) &&
      width > 0 &&
      height > 0
    ) {
      return { width, height };
    }
  } catch (err) {
    console.error(`[media-dimensions] ffprobe failed for ${filePath}:`, err);
  }
  return null;
}

/**
 * Extracts dimensions (width and height) for standard image and video files
 * by reading image headers or using ffprobe for videos. Returns null if unsupported.
 */
export async function getMediaDimensions(
  filePath: string,
): Promise<{ width: number; height: number } | null> {
  const ext = filePath.substring(filePath.lastIndexOf(".")).toLowerCase();
  if ([".mp4", ".webm", ".mkv", ".avi", ".mov", ".flv", ".wmv"].includes(ext)) {
    return getVideoDimensions(filePath);
  }

  let fileHandle: fs.FileHandle | null = null;
  try {
    fileHandle = await fs.open(filePath, "r");
    // JPEG SOF segments can theoretically be deep in the file (e.g. after massive APP2/EXIF blocks),
    // but 128KB is more than enough for almost all valid image headers.
    const buffer = Buffer.alloc(128 * 1024);
    const { bytesRead } = await fileHandle.read(buffer, 0, buffer.length, 0);
    if (bytesRead < 16) return null;

    // 1. PNG Signature check: 89 50 4E 47 0D 0A 1A 0A
    if (
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a
    ) {
      // PNG width is at offset 16 (4 bytes BE), height at offset 20 (4 bytes BE)
      if (bytesRead >= 24) {
        const width = buffer.readUInt32BE(16);
        const height = buffer.readUInt32BE(20);
        if (width > 0 && height > 0) {
          return { width, height };
        }
      }
    }

    // 2. GIF Signature check: GIF87a or GIF89a
    if (
      buffer[0] === 0x47 &&
      buffer[1] === 0x49 &&
      buffer[2] === 0x46 &&
      buffer[3] === 0x38 &&
      (buffer[4] === 0x37 || buffer[4] === 0x39) &&
      buffer[5] === 0x61
    ) {
      // GIF width is at offset 6 (2 bytes LE), height at offset 8 (2 bytes LE)
      if (bytesRead >= 10) {
        const width = buffer.readUInt16LE(6);
        const height = buffer.readUInt16LE(8);
        if (width > 0 && height > 0) {
          return { width, height };
        }
      }
    }

    // 3. WebP Signature check (RIFF .... WEBP)
    if (
      buffer[0] === 0x52 && // R
      buffer[1] === 0x49 && // I
      buffer[2] === 0x46 && // F
      buffer[3] === 0x46 && // F
      buffer[8] === 0x57 && // W
      buffer[9] === 0x45 && // E
      buffer[10] === 0x42 && // B
      buffer[11] === 0x50 // P
    ) {
      const chunkType = buffer.toString("ascii", 12, 16);
      if (chunkType === "VP8X") {
        // Extended WebP: width is 24-bit LE at 24, height is 24-bit LE at 27
        if (bytesRead >= 30) {
          const width = buffer.readUIntLE(24, 3) + 1;
          const height = buffer.readUIntLE(27, 3) + 1;
          return { width, height };
        }
      } else if (chunkType === "VP8 ") {
        // Lossy WebP: check signature 9d 01 2a at offset 23
        if (
          bytesRead >= 30 &&
          buffer[23] === 0x9d &&
          buffer[24] === 0x01 &&
          buffer[25] === 0x2a
        ) {
          const wVal = buffer.readUInt16LE(26);
          const hVal = buffer.readUInt16LE(28);
          const width = wVal & 0x3fff;
          const height = hVal & 0x3fff;
          return { width, height };
        }
      } else if (chunkType === "VP8L") {
        // Lossless WebP: check signature 2f at offset 20
        if (bytesRead >= 25 && buffer[20] === 0x2f) {
          const val = buffer.readUInt32LE(21);
          const width = (val & 0x3fff) + 1;
          const height = ((val >> 14) & 0x3fff) + 1;
          return { width, height };
        }
      }
    }

    // 4. JPEG Signature check: FF D8
    if (buffer[0] === 0xff && buffer[1] === 0xd8) {
      let offset = 2;
      while (offset < bytesRead - 8) {
        if (buffer[offset] !== 0xff) {
          offset++;
          continue;
        }

        const marker = buffer[offset + 1];
        if (marker === 0xff) {
          offset++;
          continue;
        }

        // Start Of Frame markers: C0-C3, C5-C7, C9-CB, CD-CF
        const isSOF =
          (marker >= 0xc0 && marker <= 0xc3) ||
          (marker >= 0xc5 && marker <= 0xc7) ||
          (marker >= 0xc9 && marker <= 0xcb) ||
          (marker >= 0xcd && marker <= 0xcf);

        if (isSOF) {
          // Height is 2 bytes at offset + 5 (BE), Width is 2 bytes at offset + 7 (BE)
          const height = buffer.readUInt16BE(offset + 5);
          const width = buffer.readUInt16BE(offset + 7);
          if (width > 0 && height > 0) {
            return { width, height };
          }
        }

        // Skip marker segment using segment length at offset + 2 (2 bytes BE)
        const segmentLength = buffer.readUInt16BE(offset + 2);
        offset += 2 + segmentLength;
      }
    }
  } catch (err) {
    console.error(`[media-dimensions] Error parsing ${filePath}:`, err);
  } finally {
    if (fileHandle) {
      await fileHandle.close();
    }
  }
  return null;
}
