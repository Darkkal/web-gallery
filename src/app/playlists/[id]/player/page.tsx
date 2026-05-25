import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPlaylist } from "@/lib/db/repositories/playlists";
import PlaylistPlayerPageClient from "./page-client";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { id } = await params;
  const numericId = parseInt(id, 10);
  if (Number.isNaN(numericId)) return { title: "Player" };

  const playlist = await getPlaylist(numericId);
  return { title: playlist ? `${playlist.name} - Player` : "Player Not Found" };
}

export default async function PlaylistPlayerPage({ params }: PageProps) {
  const { id } = await params;
  const numericId = parseInt(id, 10);
  if (Number.isNaN(numericId)) notFound();

  const playlist = await getPlaylist(numericId);
  if (!playlist || playlist.items.length === 0) notFound();

  const serializablePlaylist = JSON.parse(JSON.stringify(playlist));

  return <PlaylistPlayerPageClient initialPlaylist={serializablePlaylist} />;
}
