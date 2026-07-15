import type { Metadata } from "next";
import { getCategories } from "@/app/actions/tags";
import TagsManageClient from "./page-client";

export const metadata: Metadata = {
  title: "Manage Tags",
};

export default async function TagsManagePage() {
  const categories = await getCategories();
  // Ensure data is fully serializable
  const initialCategories = JSON.parse(JSON.stringify(categories));

  return <TagsManageClient initialCategories={initialCategories} />;
}
