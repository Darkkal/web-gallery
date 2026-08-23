import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPostMediaItems } from "@/app/actions/gallery";
import { getPlaylistsForPost } from "@/app/actions/playlists";
import { getPostById } from "@/lib/db/repositories/posts";
import { getAppSettings } from "@/lib/settings";
import type { PlatformUser } from "@/types/media";
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

  // Post-level platform metadata (PR #155 review finding 2): text-only posts
  // have no media rows, so the client cannot derive author/platform details
  // from mediaItems. Build them from the post itself as a fallback, using the
  // stored platform user when one exists (real name/handle/avatar).
  const p = data.post;
  let postPlatformUser: PlatformUser | null = null;
  if (p.extractorType === "twitter" && data.twitterUser) {
    postPlatformUser = {
      extractorType: "twitter",
      id: data.twitterUser.id,
      name: data.twitterUser.name ?? null,
      username: data.twitterUser.nick ?? null,
      profileImage: data.twitterUser.id
        ? `/api/avatar/twitter/${data.twitterUser.id}`
        : (data.twitterUser.profileImage ?? null),
      data: {},
    };
  } else if (p.extractorType === "pixiv" && data.pixivUser) {
    postPlatformUser = {
      extractorType: "pixiv",
      id: data.pixivUser.id,
      name: data.pixivUser.name ?? null,
      username: data.pixivUser.account ?? null,
      profileImage: data.pixivUser.id
        ? `/api/avatar/pixiv/${data.pixivUser.id}`
        : (data.pixivUser.profileImage ?? null),
      data: {},
    };
  } else if (p.extractorType === "ehentai") {
    const uploader = p.ehentaiDetails?.uploader ?? null;
    if (uploader) {
      postPlatformUser = {
        extractorType: "ehentai",
        id: null,
        name: uploader,
        username: uploader,
        profileImage: null,
        data: {},
      };
    }
  } else if (p.userId) {
    postPlatformUser = {
      extractorType: p.extractorType,
      id: p.userId,
      name: null,
      username: null,
      profileImage: null,
      data: {},
    };
  }
  const postPlatformDetails = {
    twitter: data.post.twitterDetails ?? null,
    pixiv: data.post.pixivDetails ?? null,
    gelbooru: data.post.gelbooruDetails ?? null,
  };

  return (
    <PostPageClient
      postId={postId}
      post={JSON.parse(JSON.stringify(data.post))}
      tags={JSON.parse(JSON.stringify(data.tags))}
      mediaItems={JSON.parse(JSON.stringify(mediaItems))}
      playlists={JSON.parse(JSON.stringify(playlists))}
      postPlatformUser={JSON.parse(JSON.stringify(postPlatformUser))}
      postPlatformDetails={JSON.parse(JSON.stringify(postPlatformDetails))}
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
