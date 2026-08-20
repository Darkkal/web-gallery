import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPostMediaItems } from "@/app/actions/gallery";
import { getPlaylistsForPost } from "@/app/actions/playlists";
import { getPostById } from "@/lib/db/repositories/posts";
import { getAppSettings } from "@/lib/settings";
import PostPageClient from "./page-client";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const postId = parseInt(id, 10);
  if (Number.isNaN(postId)) return { title: "Post" };
  const data = await getPostById(postId);
  return {
    title: data?.post.title ? `${data.post.title} — Post` : "Post",
  };
}

export default async function PostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const postId = parseInt(id, 10);
  if (Number.isNaN(postId)) notFound();

  const data = await getPostById(postId);
  if (!data) notFound();

  const settings = await getAppSettings();
  const [mediaItems, playlists] = await Promise.all([
    getPostMediaItems(postId),
    getPlaylistsForPost(postId),
  ]);

  return (
    <PostPageClient
      postId={postId}
      post={JSON.parse(JSON.stringify(data.post))}
      tags={JSON.parse(JSON.stringify(data.tags))}
      mediaItems={JSON.parse(JSON.stringify(mediaItems))}
      playlists={JSON.parse(JSON.stringify(playlists))}
      pageSize={settings.postViewMediaPageSize ?? 50}
      loopVideos={settings.loopVideos}
      autoHideControls={settings.lightboxAutoHideControls ?? false}
      autoHideDelay={settings.lightboxAutoHideDelay ?? 3}
      lightboxFitMode={settings.lightboxFitMode ?? "fitBoth"}
      lightboxZoomMin={settings.lightboxZoomMin ?? 50}
      lightboxZoomMax={settings.lightboxZoomMax ?? 200}
      lightboxZoomStep={settings.lightboxZoomStep ?? 25}
    />
  );
}
