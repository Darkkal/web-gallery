/**
 * Parses a human-readable size string (e.g. "120MiB", "3.5GB") into bytes.
 */
export function parseSizeToBytes(sizeStr: string): number {
  if (!sizeStr) return 0;
  const match = sizeStr.trim().match(/^([\d.]+)\s*([A-Za-z]*)$/);
  if (!match) return 0;

  const value = parseFloat(match[1]);
  const unit = match[2].toLowerCase();

  if (!unit) return Math.floor(value);

  const multipliers: Record<string, number> = {
    b: 1,
    k: 1024,
    kb: 1024,
    kib: 1024,
    m: 1024 * 1024,
    mb: 1024 * 1024,
    mib: 1024 * 1024,
    g: 1024 * 1024 * 1024,
    gb: 1024 * 1024 * 1024,
    gib: 1024 * 1024 * 1024,
    t: 1024 * 1024 * 1024 * 1024,
    tb: 1024 * 1024 * 1024 * 1024,
    tib: 1024 * 1024 * 1024 * 1024,
  };

  return Math.floor(value * (multipliers[unit] || 0));
}

/**
 * Formats a byte count into a human-readable string (e.g. "1.5GB").
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0B";
  if (bytes < 1024) return `${bytes}B`;
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / k ** i).toFixed(2)) + sizes[i];
}

/**
 * Formats a duration in seconds into HH:MM:SS format.
 */
export function formatDuration(seconds: number): string {
  const totalSeconds = Math.max(0, Math.round(seconds));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;

  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

/**
 * Safely encodes a file path, ensuring each segment is URI-encoded
 * to preserve valid URL syntax while escaping spaces and special characters like '?'.
 */
export function encodeFilePath(filePath: string): string {
  if (!filePath) return "";
  // Split by '/' to encode each path segment individually
  return filePath.split("/").map(encodeURIComponent).join("/");
}
