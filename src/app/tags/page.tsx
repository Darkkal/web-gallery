import type { Metadata } from "next";
import { getCategories, getTopTags } from "@/app/actions/tags";
import TagsPageClient from "./page-client";

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
    <TagsPageClient
      initialTags={tags}
      categories={categories}
      initialSort={sort}
      initialCategory={categoryFilter}
    />
  );
}
