import type { Metadata } from "next";
import Link from "next/link";
import { getCategories, getTopTags } from "@/app/actions/tags";
import styles from "@/app/tags/page.module.css";

export const metadata: Metadata = { title: "Tag Statistics" };

interface TagsPageProps {
  searchParams: Promise<{
    sort?: string;
    category?: string;
  }>;
}

export default async function TagsPage({ searchParams }: TagsPageProps) {
  const sp = await searchParams; // Await searchParams in Next.js 15+
  const sort = (sp.sort as "count" | "new" | "recent") || "count";
  const categoryFilter = sp.category || "all";

  const [tags, categories] = await Promise.all([
    getTopTags(sort, categoryFilter),
    getCategories(),
  ]);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Tag Statistics</h1>

        <div className={styles.controls}>
          <Link
            href={`/tags?sort=count&category=${categoryFilter}`}
            className={styles.sortLink}
            data-active={sort === "count"}
          >
            Most Popular
          </Link>
          <Link
            href={`/tags?sort=new&category=${categoryFilter}`}
            className={styles.sortLink}
            data-active={sort === "new"}
          >
            Newly Added
          </Link>
          <Link
            href={`/tags?sort=recent&category=${categoryFilter}`}
            className={styles.sortLink}
            data-active={sort === "recent"}
          >
            Recently Used
          </Link>
        </div>
      </div>

      {/* Category Filter Tabs */}
      <div className={styles.categoryTabs}>
        <Link
          href={`/tags?sort=${sort}&category=all`}
          className={styles.tab}
          data-active={categoryFilter === "all"}
        >
          All Categories
        </Link>
        {categories.map((cat) => (
          <Link
            key={cat.id}
            href={`/tags?sort=${sort}&category=${cat.name}`}
            className={styles.tab}
            data-active={categoryFilter === cat.name}
            style={
              {
                "--tab-hue": cat.colorHue,
                "--tab-sat": `${cat.colorSaturation}%`,
                "--tab-lgt": `${cat.colorLightness}%`,
              } as React.CSSProperties
            }
          >
            {cat.name}
          </Link>
        ))}
      </div>

      <div className={styles.grid}>
        {tags.map((tag, i) => (
          <Link
            // biome-ignore lint/suspicious/noArrayIndexKey: Index used for uniqueness
            key={`${tag.name}-${i}`}
            href={`/gallery?search=${encodeURIComponent(tag.name)}`}
            className={styles.tagCard}
          >
            <span className={styles.tagName}>{tag.name}</span>
            <div className={styles.tagMeta}>
              {tag.category && (
                <span
                  className={styles.categoryBadge}
                  style={
                    {
                      "--tag-hue": tag.category.colorHue,
                      "--tag-sat": `${tag.category.colorSaturation}%`,
                      "--tag-lgt": `${tag.category.colorLightness}%`,
                    } as React.CSSProperties
                  }
                >
                  {tag.category.name}
                </span>
              )}
              {tag.count !== undefined && <span>{tag.count} posts</span>}
            </div>
          </Link>
        ))}
      </div>

      {tags.length === 0 && (
        <div className={styles.emptyState}>No tags found.</div>
      )}
    </div>
  );
}
