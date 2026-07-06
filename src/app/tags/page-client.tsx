"use client";

import { ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ActionTagResult } from "@/app/actions/tags";
import InfiniteScrollSentinel from "@/components/InfiniteScrollSentinel";
import type { TagCategory } from "@/types/media";
import styles from "./page.module.css";

interface TreeNode {
  id: number;
  name: string;
  parentTagId: number | null;
  categoryId: number | null;
  category: TagCategory | null;
  postCount: number;
  hasChildren: boolean;
  children: TreeNode[];
  isExpanded: boolean;
  isLoading: boolean;
}

interface TagsPageClientProps {
  initialTags: ActionTagResult[];
  categories: TagCategory[];
  initialSort: "count" | "new" | "recent";
  initialCategory: string;
}

export default function TagsPageClient({
  initialTags,
  categories,
  initialSort,
  initialCategory,
}: TagsPageClientProps) {
  const [viewMode, setViewMode] = useState<"flat" | "tree">("flat");
  const [treeNodes, setTreeNodes] = useState<TreeNode[]>([]);
  const [treeCursor, setTreeCursor] = useState<string | undefined>(undefined);
  const [treeHasMore, setTreeHasMore] = useState(true);
  const [treeLoading, setTreeLoading] = useState(false);

  const treeCursorRef = useRef(treeCursor);
  treeCursorRef.current = treeCursor;

  const treeLoadingRef = useRef(treeLoading);
  treeLoadingRef.current = treeLoading;

  const fetchTopLevelTreeNodes = useCallback(
    async (reset = false) => {
      if (treeLoadingRef.current) return;
      setTreeLoading(true);
      try {
        const currentCursor = reset ? "" : treeCursorRef.current || "";
        const res = await fetch(
          `/api/tags/children?category=${initialCategory}&limit=50&cursor=${encodeURIComponent(currentCursor)}`,
        );
        if (res.ok) {
          const data = await res.json();
          const mapped: TreeNode[] = data.items.map(
            (
              item: Omit<TreeNode, "children" | "isExpanded" | "isLoading">,
            ) => ({
              ...item,
              isExpanded: false,
              isLoading: false,
              children: [],
            }),
          );
          setTreeNodes((prev) => (reset ? mapped : [...prev, ...mapped]));
          setTreeCursor(data.nextCursor || undefined);
          setTreeHasMore(data.nextCursor !== null);
        }
      } catch (err) {
        console.error("Error loading top-level tree nodes", err);
      } finally {
        setTreeLoading(false);
      }
    },
    [initialCategory],
  );

  // Sync settings when tree is first loaded or category changes
  useEffect(() => {
    if (viewMode === "tree") {
      fetchTopLevelTreeNodes(true);
    }
  }, [viewMode, fetchTopLevelTreeNodes]);

  const handleToggleExpand = async (nodeId: number) => {
    setTreeNodes((prev) => {
      const updateNodes = (list: TreeNode[]): TreeNode[] => {
        return list.map((node) => {
          if (node.id === nodeId) {
            const nextExpanded = !node.isExpanded;
            if (
              nextExpanded &&
              node.hasChildren &&
              (!node.children || node.children.length === 0)
            ) {
              lazyLoadChildren(nodeId);
              return { ...node, isExpanded: nextExpanded, isLoading: true };
            }
            return { ...node, isExpanded: nextExpanded };
          }
          if (node.children && node.children.length > 0) {
            return { ...node, children: updateNodes(node.children) };
          }
          return node;
        });
      };
      return updateNodes(prev);
    });
  };

  const lazyLoadChildren = async (parentId: number) => {
    try {
      const res = await fetch(`/api/tags/children?parentTagId=${parentId}`);
      if (res.ok) {
        const data = await res.json();
        const childNodes: TreeNode[] = data.items.map(
          (item: Omit<TreeNode, "children" | "isExpanded" | "isLoading">) => ({
            ...item,
            isExpanded: false,
            isLoading: false,
            children: [],
          }),
        );
        setTreeNodes((prev) => {
          const updateNodes = (list: TreeNode[]): TreeNode[] => {
            return list.map((node) => {
              if (node.id === parentId) {
                return { ...node, children: childNodes, isLoading: false };
              }
              if (node.children && node.children.length > 0) {
                return { ...node, children: updateNodes(node.children) };
              }
              return node;
            });
          };
          return updateNodes(prev);
        });
      }
    } catch (err) {
      console.error("Error lazy loading children", err);
      // Reset loading state
      setTreeNodes((prev) => {
        const updateNodes = (list: TreeNode[]): TreeNode[] => {
          return list.map((node) => {
            if (node.id === parentId) {
              return { ...node, isLoading: false };
            }
            if (node.children && node.children.length > 0) {
              return { ...node, children: updateNodes(node.children) };
            }
            return node;
          });
        };
        return updateNodes(prev);
      });
    }
  };

  const renderTreeNode = (node: TreeNode, depth = 0) => {
    return (
      <div key={node.id} className={styles.treeNodeWrapper}>
        <div
          className={styles.treeNodeRow}
          style={{ paddingLeft: `${depth * 20 + 8}px` }}
        >
          <div className={styles.treeExpanderCol}>
            {node.hasChildren ? (
              <button
                type="button"
                className={styles.treeExpanderButton}
                onClick={() => handleToggleExpand(node.id)}
              >
                {node.isLoading ? (
                  <Loader2 className={styles.spin} size={14} />
                ) : node.isExpanded ? (
                  <ChevronDown size={14} />
                ) : (
                  <ChevronRight size={14} />
                )}
              </button>
            ) : (
              <span className={styles.treeLeafBullet} />
            )}
          </div>

          <div className={styles.treeContentCol}>
            <Link
              href={`/gallery?search=${encodeURIComponent(node.name)}`}
              className={styles.treeNodeLink}
            >
              {node.name}
            </Link>
            <div className={styles.treeMeta}>
              {node.category && (
                <span
                  className={styles.categoryBadge}
                  style={
                    {
                      "--tag-hue": node.category.colorHue,
                      "--tag-sat": `${node.category.colorSaturation}%`,
                      "--tag-lgt": `${node.category.colorLightness}%`,
                    } as React.CSSProperties
                  }
                >
                  {node.category.name}
                </span>
              )}
              {node.postCount !== undefined && (
                <span className={styles.treePostCount}>
                  {node.postCount} posts
                </span>
              )}
            </div>
          </div>
        </div>

        {node.isExpanded && node.children && node.children.length > 0 && (
          <div className={styles.treeChildren}>
            {node.children.map((child) => renderTreeNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.titleWrapper}>
          <h1 className={styles.title}>Tag Statistics</h1>
          <Link href="/tags/manage" className={styles.manageLink}>
            Manage Tags
          </Link>
        </div>

        <div className={styles.rightHeaderControls}>
          {/* Flat/Tree View Toggle */}
          <div className={styles.viewToggle}>
            <button
              type="button"
              className={styles.toggleBtn}
              data-active={viewMode === "flat"}
              onClick={() => setViewMode("flat")}
            >
              Flat View
            </button>
            <button
              type="button"
              className={styles.toggleBtn}
              data-active={viewMode === "tree"}
              onClick={() => setViewMode("tree")}
            >
              Tree View
            </button>
          </div>

          {viewMode === "flat" && (
            <div className={styles.controls}>
              <Link
                href={`/tags?sort=count&category=${initialCategory}`}
                className={styles.sortLink}
                data-active={initialSort === "count"}
              >
                Most Popular
              </Link>
              <Link
                href={`/tags?sort=new&category=${initialCategory}`}
                className={styles.sortLink}
                data-active={initialSort === "new"}
              >
                Newly Added
              </Link>
              <Link
                href={`/tags?sort=recent&category=${initialCategory}`}
                className={styles.sortLink}
                data-active={initialSort === "recent"}
              >
                Recently Used
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Category Filter Tabs */}
      <div className={styles.categoryTabs}>
        <Link
          href={`/tags?sort=${initialSort}&category=all`}
          className={styles.tab}
          data-active={initialCategory === "all"}
        >
          All Categories
        </Link>
        {categories.map((cat) => (
          <Link
            key={cat.id}
            href={`/tags?sort=${initialSort}&category=${cat.name}`}
            className={styles.tab}
            data-active={initialCategory === cat.name}
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

      {viewMode === "flat" ? (
        <>
          <div className={styles.grid}>
            {initialTags.map((tag, i) => (
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

          {initialTags.length === 0 && (
            <div className={styles.emptyState}>No tags found.</div>
          )}
        </>
      ) : (
        <div className={styles.treeContainer}>
          <div className={styles.treeList}>
            {treeNodes.map((node) => renderTreeNode(node))}
          </div>

          {treeNodes.length === 0 && !treeLoading && (
            <div className={styles.emptyState}>No tags found.</div>
          )}

          <InfiniteScrollSentinel
            loadMore={() => fetchTopLevelTreeNodes(false)}
            hasMore={treeHasMore}
            isLoading={treeLoading}
          />
        </div>
      )}
    </div>
  );
}
