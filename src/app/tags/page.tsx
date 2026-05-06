import type { Metadata } from 'next';
import { getTopTags } from '@/app/actions/tags';
import Link from 'next/link';
import styles from '@/app/tags/page.module.css';

export const metadata: Metadata = { title: "Tag Statistics" };

interface TagsPageProps {
    searchParams: Promise<{
        sort?: string;
    }>;
}

export default async function TagsPage({ searchParams }: TagsPageProps) {
    const sp = await searchParams; // Await searchParams in Next.js 15+
    const sort = (sp.sort as 'count' | 'new' | 'recent') || 'count';

    const tags = await getTopTags(sort);

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h1 className={styles.title}>Tag Statistics</h1>

                <div className={styles.controls}>
                    <Link
                        href="/tags?sort=count"
                        className={styles.sortLink}
                        data-active={sort === 'count'}
                    >
                        Most Popular
                    </Link>
                    <Link
                        href="/tags?sort=new"
                        className={styles.sortLink}
                        data-active={sort === 'new'}
                    >
                        Newly Added
                    </Link>
                    <Link
                        href="/tags?sort=recent"
                        className={styles.sortLink}
                        data-active={sort === 'recent'}
                    >
                        Recently Used
                    </Link>
                </div>
            </div>

            <div className={styles.grid}>
                {tags.map((tag, i) => (
                    <Link
                        key={`${tag.name}-${i}`}
                        href={`/gallery?search=${encodeURIComponent(tag.name)}`}
                        className={styles.tagCard}
                    >
                        <span className={styles.tagName}>{tag.name}</span>
                        <div className={styles.tagMeta}>
                            {tag.count !== undefined && (
                                <span>{tag.count} posts</span>
                            )}
                            {/* "New" sort might not return count, handle gracefully */}
                        </div>
                    </Link>
                ))}
            </div>

            {tags.length === 0 && (
                <div className={styles.emptyState}>
                    No tags found.
                </div>
            )}
        </div>
    );
}
