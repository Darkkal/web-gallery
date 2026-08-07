import type { InferSelectModel } from "drizzle-orm";
import type {
  mediaItems,
  pixivUsers,
  postDetailsEHentai,
  postDetailsGelbooruV02,
  postDetailsPixiv,
  postDetailsTwitter,
  posts,
  sources,
  tagCategories,
  tags,
  twitterUsers,
} from "@/lib/db/schema";

export interface MediaItem extends InferSelectModel<typeof mediaItems> {}

export interface TagCategory extends InferSelectModel<typeof tagCategories> {}

export interface TagWithCategory extends InferSelectModel<typeof tags> {
  category: TagCategory | null;
}

export interface TagManageItem {
  id: number;
  name: string;
  category: TagCategory | null;
  postCount: number;
  aliasOfTagId: number | null;
  aliasName: string | null;
  parentTagId: number | null;
  parentName: string | null;
}

export type TwitterDetails = InferSelectModel<typeof postDetailsTwitter>;
export type PixivDetails = InferSelectModel<typeof postDetailsPixiv>;
export type GelbooruDetails = InferSelectModel<typeof postDetailsGelbooruV02>;
export type EHentaiDetails = InferSelectModel<typeof postDetailsEHentai>;

export interface PlatformDetails {
  extractorType: string;
  data: Record<string, unknown>;
}

export interface PlatformUser {
  extractorType: string;
  id: string | null;
  name: string | null;
  username: string | null;
  profileImage: string | null;
  data: Record<string, unknown>;
}

export interface GalleryRow {
  item: MediaItem;
  post?: InferSelectModel<typeof posts> | null;
  platformDetails?: PlatformDetails | null;
  platformUser?: PlatformUser | null;
  source?: InferSelectModel<typeof sources> | null;
}

export interface GalleryGroup extends GalleryRow {
  groupItems: GalleryRow[];
  groupCount: number;
}
