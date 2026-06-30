import type { InferSelectModel } from "drizzle-orm";
import type {
  mediaItems,
  pixivUsers,
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

export interface GalleryRow {
  item: MediaItem;
  post?: InferSelectModel<typeof posts> | null;
  twitter?: InferSelectModel<typeof postDetailsTwitter> | null;
  pixiv?: InferSelectModel<typeof postDetailsPixiv> | null;
  gelbooru?: InferSelectModel<typeof postDetailsGelbooruV02> | null;
  user?: InferSelectModel<typeof twitterUsers> | null;
  pixivUser?: InferSelectModel<typeof pixivUsers> | null;
  source?: InferSelectModel<typeof sources> | null;
}

export interface GalleryGroup extends GalleryRow {
  groupItems: GalleryRow[];
  groupCount: number;
}
