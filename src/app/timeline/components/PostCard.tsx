"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import styles from "@/app/timeline/page.module.css";
import FormattedContent from "@/components/FormattedContent";
import { useAutoplayVideo } from "@/hooks/useAutoplayVideo";
import { handleKeyActivate } from "@/lib/utils/a11y";
import { encodeFilePath } from "@/lib/utils/format";
import type { TimelinePost } from "@/types/posts";

interface PostCardProps {
  post: TimelinePost;
  postIndex: number;
  onMediaClick: (
    postIndex: number,
    mediaIndex: number,
    e: React.MouseEvent,
  ) => void;
  onUserClick?: (userName: string) => void;
  loopVideos?: boolean;
  autoplayVideos?: boolean;
  muteAutoplayVideos?: boolean;
  condensePostText?: boolean;
  condensePostLines?: number;
  id?: string;
}

export default function PostCard({
  post,
  postIndex,
  onMediaClick,
  onUserClick,
  loopVideos,
  autoplayVideos = false,
  muteAutoplayVideos = true,
  condensePostText = true,
  condensePostLines = 2,
  id,
}: PostCardProps) {
  const router = useRouter();
  const [isExpanded, setIsExpanded] = useState(false);
  const [hasOverflow, setHasOverflow] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const authorName = post.author?.name || post.author?.handle || "";
  const hasAuthor = authorName.length > 0;

  const handleUserClick = (e?: React.SyntheticEvent) => {
    if (e) e.stopPropagation();
    if (!hasAuthor) return;
    if (onUserClick) {
      onUserClick(authorName);
    } else {
      router.push(
        `/gallery?search=${encodeURIComponent(`user:${authorName} `)}`,
      );
    }
  };

  useEffect(() => {
    if (!condensePostText) {
      setHasOverflow(false);
      return;
    }

    const checkOverflow = () => {
      if (contentRef.current) {
        const { scrollHeight, clientHeight } = contentRef.current;
        setHasOverflow(scrollHeight > clientHeight);
      }
    };

    // Run initial check
    checkOverflow();

    const element = contentRef.current;
    if (!element) return;

    const observer = new ResizeObserver(checkOverflow);
    observer.observe(element);
    return () => observer.disconnect();
  }, [condensePostText]);

  return (
    <article id={id} className={styles.postCard}>
      {/* Header: Avatar, Name, Date */}
      <div className={styles.postHeader}>
        {hasAuthor ? (
          <button
            type="button"
            className={`${styles.avatarWrapper} ${styles.authorClickable}`}
            onClick={handleUserClick}
            title={`Search posts by ${authorName}`}
          >
            {post.author?.avatar ? (
              <Image
                src={post.author.avatar}
                alt={post.author.name || "User"}
                width={40}
                height={40}
                className={styles.avatar}
              />
            ) : (
              <div className={styles.avatarPlaceholder} />
            )}
          </button>
        ) : post.author?.avatar ? (
          <Image
            src={post.author.avatar}
            alt={post.author.name || "User"}
            width={40}
            height={40}
            className={styles.avatar}
          />
        ) : (
          <div className={styles.avatarPlaceholder} />
        )}
        <div className={styles.postMeta}>
          {hasAuthor ? (
            <button
              type="button"
              className={`${styles.authorRow} ${styles.authorClickable}`}
              onClick={handleUserClick}
              title={`Search posts by ${authorName}`}
            >
              <span className={styles.authorName}>
                {post.author?.name || "Unknown"}
              </span>
              {post.author?.handle && (
                <span className={styles.authorHandle}>
                  @{post.author.handle}
                </span>
              )}
            </button>
          ) : (
            <div className={styles.authorRow}>
              <span className={styles.authorName}>
                {post.author?.name || "Unknown"}
              </span>
              {post.author?.handle && (
                <span className={styles.authorHandle}>
                  @{post.author.handle}
                </span>
              )}
            </div>
          )}
          <div className={styles.dateRow}>
            <span className={styles.date}>
              {new Date(post.date).toLocaleString()}
            </span>
            {post.type !== "other" && (
              <span className={`${styles.badge} ${styles[post.type]}`}>
                {post.type}
              </span>
            )}
          </div>
        </div>
        {post.sourceUrl && (
          <a
            href={post.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.sourceLink}
          >
            ↗
          </a>
        )}
      </div>

      {/* Content: Text */}
      {post.content && (
        <>
          {/* biome-ignore lint/a11y/noStaticElementInteractions: Click handler is conditional and handled via key listener when active */}
          <div
            ref={contentRef}
            className={`${styles.postContent} ${
              condensePostText && !isExpanded ? styles.postContentClamped : ""
            }`}
            onClick={
              post.mediaItems.some((m) => m.type === "text")
                ? (e) => {
                    // Don't trigger media click if we're clicking a link in the HTML
                    if ((e.target as HTMLElement).tagName === "A") return;

                    const textMediaIndex = post.mediaItems.findIndex(
                      (m) => m.type === "text",
                    );
                    if (textMediaIndex !== -1) {
                      onMediaClick(postIndex, textMediaIndex, e);
                    }
                  }
                : undefined
            }
            onKeyDown={handleKeyActivate(() => {
              const textMediaIndex = post.mediaItems.findIndex(
                (m) => m.type === "text",
              );
              if (textMediaIndex !== -1) {
                // Note: passing null for event as we're just triggering the action
                onMediaClick(
                  postIndex,
                  textMediaIndex,
                  null as unknown as React.MouseEvent,
                );
              }
            })}
            role={
              post.mediaItems.some((m) => m.type === "text")
                ? "button"
                : undefined
            }
            tabIndex={
              post.mediaItems.some((m) => m.type === "text") ? 0 : undefined
            }
            style={{
              WebkitLineClamp:
                condensePostText && !isExpanded ? condensePostLines : undefined,
              cursor: post.mediaItems.some((m) => m.type === "text")
                ? "pointer"
                : "default",
            }}
          >
            <FormattedContent content={post.content} />
          </div>
          {(isExpanded || hasOverflow) && (
            <button
              type="button"
              className={styles.toggleTextButton}
              onClick={(e) => {
                e.stopPropagation();
                setIsExpanded((prev) => !prev);
              }}
            >
              {isExpanded ? "Show Less" : "Show More"}
            </button>
          )}
        </>
      )}

      {/* Media Grid */}
      {post.mediaItems.filter((m) => m.type !== "text").length > 0 && (
        <div
          className={`${styles.mediaGrid} ${styles[`grid-${Math.min(post.mediaItems.filter((m) => m.type !== "text").length, 4)}`]}`}
        >
          {post.mediaItems.map((media, originalIndex) => {
            if (media.type === "text") return null;
            return (
              // biome-ignore lint/a11y/useSemanticElements: Maintains current styling structure
              <div
                key={media.id}
                className={styles.mediaItem}
                onClick={(e) => onMediaClick(postIndex, originalIndex, e)}
                onKeyDown={handleKeyActivate(() =>
                  onMediaClick(
                    postIndex,
                    originalIndex,
                    null as unknown as React.MouseEvent,
                  ),
                )}
                role="button"
                tabIndex={0}
              >
                {media.type === "video" ? (
                  <PostVideo
                    src={encodeFilePath(media.url)}
                    loop={!!loopVideos}
                    autoplayEnabled={!!autoplayVideos}
                    muteEnabled={!!muteAutoplayVideos}
                  />
                ) : (
                  <Image
                    src={encodeFilePath(media.url)}
                    alt=""
                    className={styles.media}
                    width={300}
                    height={300}
                    unoptimized
                  />
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Stats Footer */}
      {post.stats && (
        <div className={styles.postFooter}>
          {post.stats.likes !== undefined && <span>♥ {post.stats.likes}</span>}
          {post.stats.retweets !== undefined && (
            <span>RP {post.stats.retweets}</span>
          )}
        </div>
      )}
    </article>
  );
}

interface PostVideoProps {
  src: string;
  loop: boolean;
  autoplayEnabled: boolean;
  muteEnabled: boolean;
}

function PostVideo({
  src,
  loop,
  autoplayEnabled,
  muteEnabled,
}: PostVideoProps) {
  const videoRef = useAutoplayVideo(autoplayEnabled, muteEnabled);

  return (
    // biome-ignore lint/a11y/useMediaCaption: User generated content does not have captions
    <video
      ref={videoRef}
      src={src}
      controls
      loop={loop}
      className={styles.media}
    />
  );
}
