import type { GalleryRow } from "@/types/media";

export interface UnifiedUserData {
  id?: string | number | null;
  name?: string | null;
  username?: string | null;
  nick?: string | null;
  account?: string | null;
  profileImage?: string | null;
}

/**
 * Accesses platform-specific details from a GalleryRow slot if the extractorType matches.
 */
export function getPlatformDetails<T = Record<string, unknown>>(
  row: GalleryRow,
  extractorType: string,
): T | null {
  if (!row.platformDetails) return null;
  const currentType = row.platformDetails.extractorType;
  if (
    currentType === extractorType ||
    (extractorType === "gelbooru" && currentType === "gelbooruv02") ||
    (extractorType === "gelbooruv02" && currentType === "gelbooru")
  ) {
    return row.platformDetails.data as T;
  }
  return null;
}
