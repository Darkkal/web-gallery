import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPlaylist } from "@/lib/db/repositories/playlists";
import PlaylistDetailPageClient from "./page-client";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { id } = await params;
  const numericId = parseInt(id, 10);
  if (Number.isNaN(numericId)) return { title: "Playlist" };

  const playlist = await getPlaylist(numericId);
  return {
    title: playlist ? `${playlist.name} - Playlist` : "Playlist Not Found",
  };
}

export default async function PlaylistDetailPage({ params }: PageProps) {
  const { id } = await params;
  const numericId = parseInt(id, 10);
  if (Number.isNaN(numericId)) notFound();

  const playlist = await getPlaylist(numericId);
  if (!playlist) notFound();

  const serializablePlaylist = JSON.parse(JSON.stringify(playlist));

  return <PlaylistDetailPageClient initialPlaylist={serializablePlaylist} />;
}
