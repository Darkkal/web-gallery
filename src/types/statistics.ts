export interface LibraryStatistics {
  totalPosts: number;
  totalMediaItems: number;
  totalTags: number;
  totalCanonicalTags: number;
  totalUsers: number;
  totalExtractors: number;
  storageBytes: number;
  updatedAt: number;
}

export interface StatisticsHistoryPoint {
  date: string;
  totalPosts: number;
  totalMediaItems: number;
  totalTags: number;
  totalCanonicalTags: number;
  totalUsers: number;
  totalExtractors: number;
  storageBytes: number;
}

export type HistoryGranularity = "day" | "week" | "month" | "year";
export type HistoryDateType = "import" | "publish";
export type RankingSortBy = "count" | "latest-added" | "latest-used";
export type SortOrder = "desc" | "asc";

export interface TopTagCard {
  id: number;
  name: string;
  value: number; // sorted field value
  topUsers: { id: string; name: string; avatar?: string; postCount: number }[];
  topExtractors: { name: string; postCount: number }[];
  backgroundImage?: string; // first media filePath
}

export interface TopUserCard {
  id: string;
  name: string;
  avatar?: string;
  value: number;
  topTags: { id: number; name: string; postCount: number }[];
  topExtractors: { name: string; postCount: number }[];
  backgroundImage?: string;
}

export interface TopExtractorCard {
  name: string; // "twitter", "pixiv", "gelbooru", etc.
  value: number;
  topTags: { id: number; name: string; postCount: number }[];
  topUsers: { id: string; name: string; avatar?: string; postCount: number }[];
  backgroundImage?: string;
}
