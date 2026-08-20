"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import FormattedContent from "@/components/FormattedContent";
import Lightbox from "@/components/Lightbox";
import { useLightbox } from "@/hooks/useLightbox";
import { getPlatformDetails } from "@/lib/metadata";
import { encodeFilePath } from "@/lib/utils/format";
import type {
  GalleryRow,
  GelbooruDetails,
  PixivDetails,
  TwitterDetails,
} from "@/types/media";
import styles from "./page.module.css";

type TagWithCategory = {
  name: string;
  id: number;
  categoryId: number | null;
  category: {
    id: number;
    name: string;
    colorHue: number;
    colorSaturation: number;
    colorLightness: number;
    isBuiltin: boolean;
  } | null;
  aliasOfTagId: number | null;
  parentTagId: number | null;
};

interface PostHeaderData {
  id: number;
  extractorType: string;
  jsonSourceId: string | null;
  userId: string | null;
  date: string | null;
  title: string | null;
  content: string | null;
  url: string | null;
  isSourceDeleted: boolean | null;
  createdAt: string | null;
}

interface PostPageClientProps {
  postId: number;
  post: PostHeaderData;
  tags: TagWithCategory[];
  mediaItems: GalleryRow[];
  playlists: { id: number; name: string }[];
  pageSize: number;
  loopVideos: boolean;
  autoHideControls: boolean;
  autoHideDelay: number;
  lightboxFitMode: "fitBoth" | "fitWidth" | "fitHeight";
  lightboxZoomMin: number;
  lightboxZoomMax: number;
  lightboxZoomStep: number;
}

function formatDate(value: string | Date | null): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

export default function PostPageClient(props: PostPageClientProps) {
  const {
    postId,
    post,
    tags,
    mediaItems,
    playlists,
    pageSize,
    loopVideos,
    autoHideControls,
    autoHideDelay,
    lightboxFitMode,
    lightboxZoomMin,
    lightboxZoomMax,
    lightboxZoomStep,
  } = props;

  const [layout, setLayout] = useState<"grid" | "masonry">("grid");
  const [pageIndex, setPageIndex] = useState(0);

  const pageCount = Math.max(
    1,
    Math.ceil(mediaItems.length / Math.max(1, pageSize)),
  );
  const safePage = Math.min(pageIndex, pageCount - 1);
  const offset = safePage * pageSize;

  const pageItems = useMemo(
    () => mediaItems.slice(offset, offset + pageSize),
    [mediaItems, offset, pageSize],
  );

  const lightbox = useLightbox(mediaItems.length, () => 1);

  const first = mediaItems[0];
  const platformUser = first?.platformUser ?? null;
  const twitterDetails = first
    ? getPlatformDetails<TwitterDetails>(first, "twitter")
    : null;
  const pixivDetails = first
    ? getPlatformDetails<PixivDetails>(first, "pixiv")
    : null;
  const gelbooruDetails = first
    ? getPlatformDetails<GelbooruDetails>(first, "gelbooruv02")
    : null;

  const platformLabel =
    post.extractorType === "twitter"
      ? "Twitter"
      : post.extractorType === "pixiv"
        ? "Pixiv"
        : post.extractorType === "gelbooruv02"
          ? "Gelbooru"
          : post.extractorType === "ehentai" ||
              post.extractorType === "exhentai"
            ? "E-Hentai"
            : "Post";

  const handleMediaClick = (indexInPage: number) => {
    lightbox.open(offset + indexInPage, 0);
  };

  return (
    <main className={styles.container}>
      <header className={styles.header}>
        <div className={styles.titleRow}>
          <h1 className={styles.title}>{post.title || platformLabel}</h1>
          <span className={styles.platformBadge}>{platformLabel}</span>
        </div>

        {platformUser && (
          <div className={styles.authorRow}>
            {platformUser.profileImage ? (
              <Image
                src={platformUser.profileImage}
                alt={platformUser.name || platformUser.username || ""}
                className={styles.avatar}
                width={40}
                height={40}
                unoptimized
              />
            ) : (
              <div className={styles.avatarPlaceholder} />
            )}
            <div className={styles.authorMeta}>
              <span className={styles.authorName}>
                {platformUser.name || "Unknown"}
              </span>
              {platformUser.username && (
                <span className={styles.authorHandle}>
                  @{platformUser.username}
                </span>
              )}
            </div>
            {post.url && (
              <a
                href={post.url}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.sourceLink}
              >
                Open Original ↗
              </a>
            )}
          </div>
        )}
      </header>

      {(post.content || post.title) && (
        <section className={styles.section}>
          <FormattedContent content={post.content || post.title} />
        </section>
      )}

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Details</h2>
        {post.isSourceDeleted && (
          <div className={styles.deletedBanner}>
            🚫 This post has been deleted from its source.
          </div>
        )}
        <dl className={styles.metaGrid}>
          <div className={styles.metaItem}>
            <dt>Posted</dt>
            <dd>{formatDate(post.date)}</dd>
          </div>
          <div className={styles.metaItem}>
            <dt>Imported</dt>
            <dd>{formatDate(post.createdAt)}</dd>
          </div>
          {twitterDetails && (
            <>
              <Meta label="Likes" value={twitterDetails.favoriteCount} />
              <Meta label="Retweets" value={twitterDetails.retweetCount} />
              <Meta label="Views" value={twitterDetails.viewCount} />
              <Meta label="Bookmarks" value={twitterDetails.bookmarkCount} />
              <Meta label="Replies" value={twitterDetails.replyCount} />
              <Meta label="Quotes" value={twitterDetails.quoteCount} />
            </>
          )}
          {pixivDetails && (
            <>
              <Meta label="Views" value={pixivDetails.totalView} />
              <Meta label="Bookmarks" value={pixivDetails.totalBookmarks} />
              <Meta label="Pages" value={pixivDetails.pageCount} />
            </>
          )}
          {gelbooruDetails && (
            <>
              <Meta label="Score" value={gelbooruDetails.score} />
              <Meta label="Rating" value={gelbooruDetails.rating} />
            </>
          )}
        </dl>
      </section>

      {tags.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Tags</h2>
          <div className={styles.tagList}>
            {tags.map((tag) => (
              <span
                key={tag.id}
                className={`${styles.tagChip} ${tag.category ? styles.hasCategory : ""}`}
                style={
                  tag.category
                    ? ({
                        "--tag-hue": tag.category.colorHue,
                        "--tag-sat": `${tag.category.colorSaturation}%`,
                        "--tag-lgt": `${tag.category.colorLightness}%`,
                      } as React.CSSProperties)
                    : undefined
                }
              >
                #{tag.name}
              </span>
            ))}
          </div>
        </section>
      )}

      {playlists.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Playlists</h2>
          <div className={styles.playlistList}>
            {playlists.map((p) => (
              <Link
                key={p.id}
                href={`/playlists/${p.id}`}
                className={styles.playlistLink}
              >
                {p.name}
              </Link>
            ))}
          </div>
        </section>
      )}

      {mediaItems.length > 0 && (
        <section className={styles.section}>
          <div className={styles.gridToolbar}>
            <h2 className={styles.sectionTitle}>
              Media{" "}
              <span className={styles.mediaCount}>
                ({mediaItems.length} item{mediaItems.length === 1 ? "" : "s"})
              </span>
            </h2>
            <div className={styles.layoutToggle}>
              <button
                type="button"
                className={layout === "grid" ? styles.toggleActive : ""}
                onClick={() => setLayout("grid")}
              >
                Grid
              </button>
              <button
                type="button"
                className={layout === "masonry" ? styles.toggleActive : ""}
                onClick={() => setLayout("masonry")}
              >
                Masonry
              </button>
            </div>
          </div>

          <div
            className={
              layout === "grid" ? styles.mediaGrid : styles.mediaMasonry
            }
          >
            {pageItems.map((row, i) => (
              <button
                type="button"
                key={row.item.id}
                className={styles.mediaTile}
                onClick={() => handleMediaClick(i)}
                title={`${offset + i + 1} / ${mediaItems.length}`}
              >
                <span className={styles.pageIndex}>{offset + i + 1}</span>
                {row.item.mediaType === "video" ? (
                  <video
                    src={encodeFilePath(row.item.filePath)}
                    muted
                    loop
                    preload="metadata"
                    className={styles.mediaPreview}
                    tabIndex={-1}
                  />
                ) : (
                  <Image
                    src={encodeFilePath(row.item.filePath)}
                    alt={row.post?.title || `Page ${offset + i + 1}`}
                    width={400}
                    height={400}
                    style={{ width: "100%", height: "auto" }}
                    unoptimized
                    className={styles.mediaPreview}
                  />
                )}
              </button>
            ))}
          </div>

          {pageCount > 1 && (
            <div className={styles.pagination}>
              <button
                type="button"
                disabled={safePage === 0}
                onClick={() => setPageIndex(safePage - 1)}
              >
                ← Prev
              </button>
              <span className={styles.paginationInfo}>
                Page {safePage + 1} / {pageCount}
              </span>
              <button
                type="button"
                disabled={safePage >= pageCount - 1}
                onClick={() => setPageIndex(safePage + 1)}
              >
                Next →
              </button>
            </div>
          )}
        </section>
      )}

      {lightbox.selectedIndex !== null && (
        <Lightbox
          row={mediaItems[lightbox.selectedIndex]}
          groupItems={mediaItems}
          onClose={lightbox.close}
          onNext={lightbox.next}
          onPrev={lightbox.prev}
          loopVideos={loopVideos}
          autoHideControls={autoHideControls}
          autoHideDelay={autoHideDelay}
          fitMode={lightboxFitMode}
          zoomMin={lightboxZoomMin}
          zoomMax={lightboxZoomMax}
          zoomStep={lightboxZoomStep}
        />
      )}
    </main>
  );
}

function Meta({
  label,
  value,
}: {
  label: string;
  value: number | string | null | undefined;
}) {
  if (value == null) return null;
  return (
    <div className={styles.metaItem}>
      <dt>{label}</dt>
      <dd>{value.toLocaleString()}</dd>
    </div>
  );
}
