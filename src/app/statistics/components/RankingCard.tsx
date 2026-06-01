"use client";

import { Image as ImageIcon, Sparkles, Tag, Twitter, User } from "lucide-react";
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
}: RankingCardProps) {
  const isVideo = (pathStr?: string) => {
    if (!pathStr) return false;
    return /\.(mp4|webm|mkv|mov|avi|3gp)$/i.test(pathStr);
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
                <div key={u.name} className={styles.associationItem}>
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
                </div>
              ))}
            </div>
          )}
          {topExtractors.length > 0 && (
            <div className={styles.associationGroup}>
              <span className={styles.associationTitle}>Top Extractors</span>
              {topExtractors.map((e) => (
                <div key={e.name} className={styles.associationItem}>
                  <Sparkles className={styles.miniIcon} />
                  <span className={styles.associationName}>{e.name}</span>
                  <span className={styles.associationCount}>{e.postCount}</span>
                </div>
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
                <div key={t.name} className={styles.associationItem}>
                  <Tag className={styles.miniIcon} />
                  <span className={styles.associationName}>#{t.name}</span>
                  <span className={styles.associationCount}>{t.postCount}</span>
                </div>
              ))}
            </div>
          )}
          {topExtractors.length > 0 && (
            <div className={styles.associationGroup}>
              <span className={styles.associationTitle}>Top Extractors</span>
              {topExtractors.map((e) => (
                <div key={e.name} className={styles.associationItem}>
                  <Sparkles className={styles.miniIcon} />
                  <span className={styles.associationName}>{e.name}</span>
                  <span className={styles.associationCount}>{e.postCount}</span>
                </div>
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
              <div key={t.name} className={styles.associationItem}>
                <Tag className={styles.miniIcon} />
                <span className={styles.associationName}>#{t.name}</span>
                <span className={styles.associationCount}>{t.postCount}</span>
              </div>
            ))}
          </div>
        )}
        {topUsers.length > 0 && (
          <div className={styles.associationGroup}>
            <span className={styles.associationTitle}>Top Users</span>
            {topUsers.map((u) => (
              <div key={u.name} className={styles.associationItem}>
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
              </div>
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
          <div className={styles.entityInfo}>
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
          </div>

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
