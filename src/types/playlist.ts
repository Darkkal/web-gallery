import type { InferSelectModel } from "drizzle-orm";
import type { mediaItems, playlistItems, playlists } from "@/lib/db/schema";

export interface Playlist extends InferSelectModel<typeof playlists> {
  itemCount?: number;
  thumbnailPath?: string;
}

export interface PlaylistItem extends InferSelectModel<typeof playlistItems> {
  mediaItem?: InferSelectModel<typeof mediaItems>;
}

export interface PlaylistWithItems extends Playlist {
  items: PlaylistItem[];
}
