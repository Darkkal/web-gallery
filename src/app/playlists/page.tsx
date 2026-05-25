import type { Metadata } from "next";
import PlaylistsPageClient from "@/app/playlists/page-client";
import { getPlaylists } from "@/lib/db/repositories/playlists";

export const metadata: Metadata = { title: "Playlists" };

export default async function PlaylistsPage() {
  const playlists = await getPlaylists();

  // Cast to simple serializable objects for React Client Component props
  const initialPlaylists = JSON.parse(JSON.stringify(playlists));

  return <PlaylistsPageClient initialPlaylists={initialPlaylists} />;
}
