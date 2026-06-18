"use client";

import { Image as ImageIcon, Sparkles, Tag, Twitter, User } from "lucide-react";
import Link from "next/link";
import styles from "../page.module.css";

interface AssociatedItem {
  id?: string | number;
  name: string;
  avatar?: string;
  postCount: number;
}

interface RankingCardProps {
  type: "tag" | "user" | "extractor";
  name: string;
  value: number;
  avatar?: string;
  topTags?: AssociatedItem[];
  topUsers?: AssociatedItem[];
  topExtractors?: AssociatedItem[];
  backgroundImage?: string;
  id?: string | number;
}

export default function RankingCard({
  type,
  name,
  value,
  avatar,
  topTags = [],
  topUsers = [],
  topExtractors = [],
  backgroundImage,
  id,
}: RankingCardProps) {
  const isVideo = (pathStr?: string) => {
    if (!pathStr) return false;
    return /\.(mp4|webm|mkv|mov|avi|3gp)$/i.test(pathStr);
  };

  const getSearchLink = (
    itemType: "tag" | "user" | "extractor",
    itemName: string,
    itemId?: string | number,
  ) => {
    if (itemType === "tag") {
      return `/gallery?search=tag:${encodeURIComponent(`${itemName} `)}`;
    }
    if (itemType === "user") {
      if (itemId) {
        return `/gallery?search=handle:${encodeURIComponent(`${String(itemId)} `)}`;
      }
      return `/gallery?search=user:${encodeURIComponent(`${itemName} `)}`;
    }
    return `/gallery?search=source:${encodeURIComponent(`${itemName} `)}`;
  };

  // Human-readable titles for associations
  const renderAssociations = () => {
    if (type === "tag") {
      return (
        <div className={styles.associationsList}>
          {topUsers.length > 0 && (
            <div className={styles.associationGroup}>
              <span className={styles.associationTitle}>Top Users</span>
              {topUsers.map((u) => (
                <Link
                  key={u.name}
                  href={getSearchLink("user", u.name, u.id)}
                  className={styles.associationLink}
                >
                  {u.avatar ? (
                    <img
                      src={u.avatar}
                      alt={u.name}
                      className={styles.miniAvatar}
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                  ) : (
                    <User className={styles.miniIcon} />
                  )}
                  <span className={styles.associationName}>{u.name}</span>
                  <span className={styles.associationCount}>{u.postCount}</span>
                </Link>
              ))}
            </div>
          )}
          {topExtractors.length > 0 && (
            <div className={styles.associationGroup}>
              <span className={styles.associationTitle}>Top Extractors</span>
              {topExtractors.map((e) => (
                <Link
                  key={e.name}
                  href={getSearchLink("extractor", e.name)}
                  className={styles.associationLink}
                >
                  <Sparkles className={styles.miniIcon} />
                  <span className={styles.associationName}>{e.name}</span>
                  <span className={styles.associationCount}>{e.postCount}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      );
    }

    if (type === "user") {
      return (
        <div className={styles.associationsList}>
          {topTags.length > 0 && (
            <div className={styles.associationGroup}>
              <span className={styles.associationTitle}>Top Tags</span>
              {topTags.map((t) => (
                <Link
                  key={t.name}
                  href={getSearchLink("tag", t.name)}
                  className={styles.associationLink}
                >
                  <Tag className={styles.miniIcon} />
                  <span className={styles.associationName}>#{t.name}</span>
                  <span className={styles.associationCount}>{t.postCount}</span>
                </Link>
              ))}
            </div>
          )}
          {topExtractors.length > 0 && (
            <div className={styles.associationGroup}>
              <span className={styles.associationTitle}>Top Extractors</span>
              {topExtractors.map((e) => (
                <Link
                  key={e.name}
                  href={getSearchLink("extractor", e.name)}
                  className={styles.associationLink}
                >
                  <Sparkles className={styles.miniIcon} />
                  <span className={styles.associationName}>{e.name}</span>
                  <span className={styles.associationCount}>{e.postCount}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      );
    }

    // extractor
    return (
      <div className={styles.associationsList}>
        {topTags.length > 0 && (
          <div className={styles.associationGroup}>
            <span className={styles.associationTitle}>Top Tags</span>
            {topTags.map((t) => (
              <Link
                key={t.name}
                href={getSearchLink("tag", t.name)}
                className={styles.associationLink}
              >
                <Tag className={styles.miniIcon} />
                <span className={styles.associationName}>#{t.name}</span>
                <span className={styles.associationCount}>{t.postCount}</span>
              </Link>
            ))}
          </div>
        )}
        {topUsers.length > 0 && (
          <div className={styles.associationGroup}>
            <span className={styles.associationTitle}>Top Users</span>
            {topUsers.map((u) => (
              <Link
                key={u.name}
                href={getSearchLink("user", u.name, u.id)}
                className={styles.associationLink}
              >
                {u.avatar ? (
                  <img
                    src={u.avatar}
                    alt={u.name}
                    className={styles.miniAvatar}
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                ) : (
                  <User className={styles.miniIcon} />
                )}
                <span className={styles.associationName}>{u.name}</span>
                <span className={styles.associationCount}>{u.postCount}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    );
  };

  const getExtractorIcon = (extName: string) => {
    if (extName === "twitter")
      return <Twitter className={styles.cardHeaderIcon} />;
    return <Sparkles className={styles.cardHeaderIcon} />;
  };

  return (
    <div className={styles.rankingCard}>
      {/* Background Media */}
      {backgroundImage ? (
        isVideo(backgroundImage) ? (
          <video
            src={`${backgroundImage}#t=0.1`}
            className={styles.rankingCardBg}
            preload="metadata"
            muted
            playsInline
          />
        ) : (
          <img
            src={backgroundImage}
            alt=""
            className={styles.rankingCardBg}
            loading="lazy"
          />
        )
      ) : (
        <div className={`${styles.rankingCardBg} ${styles.fallbackBg}`}>
          <ImageIcon className={styles.emptyCardIcon} />
        </div>
      )}

      {/* Dark overlay & blur container */}
      <div className={styles.rankingCardOverlay}></div>

      {/* Card Content */}
      <div className={styles.rankingCardContent}>
        <div className={styles.rankingCardHeader}>
          <Link
            className={styles.entityLink}
            href={getSearchLink(type, name, id)}
          >
            {type === "user" &&
              (avatar ? (
                <img
                  src={avatar}
                  alt={name}
                  className={styles.entityAvatar}
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = "";
                  }}
                />
              ) : (
                <User className={styles.entityIcon} />
              ))}
            {type === "tag" && <Tag className={styles.entityIcon} />}
            {type === "extractor" && getExtractorIcon(name)}

            <span className={styles.entityName} title={name}>
              {type === "tag" ? `#${name}` : name}
            </span>
          </Link>

          <div className={styles.entityBadge}>
            <span className={styles.entityBadgeValue}>
              {value.toLocaleString()}
            </span>
            <span className={styles.entityBadgeLabel}>posts</span>
          </div>
        </div>

        <div className={styles.rankingCardFooter}>{renderAssociations()}</div>
      </div>
    </div>
  );
}
