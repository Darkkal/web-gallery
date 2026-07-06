"use client";

import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Edit2,
  FolderEdit,
  Link2,
  Loader2,
  Merge as MergeIcon,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Trash,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import {
  bulkSetTagAlias,
  bulkSetTagCategory,
  cleanupOrphanedTags,
  createTagCategory,
  deleteTag,
  deleteTagCategory,
  deleteTags,
  getOrCreateTagByName,
  mergeTags,
  renameTag,
  setTagAlias,
  updateTagCategory,
} from "@/app/actions/tags";
import InfiniteScrollSentinel from "@/components/InfiniteScrollSentinel";
import type { TagCategory, TagManageItem } from "@/types/media";
import styles from "./page.module.css";

interface TagsManageClientProps {
  initialCategories: TagCategory[];
}

export default function TagsManageClient({
  initialCategories,
}: TagsManageClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Categories list state (allowing inline updates)
  const [categoriesList, setCategoriesList] =
    useState<TagCategory[]>(initialCategories);

  // Tags listing states
  const [tags, setTags] = useState<TagManageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [hasMore, setHasMore] = useState(true);

  const cursorRef = useRef(cursor);
  cursorRef.current = cursor;

  // Filters state
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sortBy, setSortBy] = useState<"count" | "name">("count");

  // Selection state
  const [selectedTagIds, setSelectedTagIds] = useState<Set<number>>(new Set());

  // Modals state
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [renameTagItem, setRenameTagItem] = useState<TagManageItem | null>(
    null,
  );
  const [mergeTagItem, setMergeTagItem] = useState<TagManageItem | null>(null);
  const [showBulkMerge, setShowBulkMerge] = useState(false);
  const [showBulkAlias, setShowBulkAlias] = useState(false);
  const [aliasTagItem, setAliasTagItem] = useState<TagManageItem | null>(null);
  const [aliasTargetInput, setAliasTargetInput] = useState("");
  const [aliasSuggestions, setAliasSuggestions] = useState<
    { id: number; name: string }[]
  >([]);
  const [aliasSuggestionsOpen, setAliasSuggestionsOpen] = useState(false);
  const aliasSuggestContainerRef = useRef<HTMLDivElement>(null);

  // Action feedback
  const [notification, setNotification] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Category CRUD form states
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryHue, setNewCategoryHue] = useState(200);
  const [newCategorySat, setNewCategorySat] = useState(70);
  const [newCategoryLgt, setNewCategoryLgt] = useState(50);

  const [editingCategory, setEditingCategory] = useState<TagCategory | null>(
    null,
  );
  const [editCategoryName, setEditCategoryName] = useState("");
  const [editCategoryHue, setEditCategoryHue] = useState(200);
  const [editCategorySat, setEditCategorySat] = useState(70);
  const [editCategoryLgt, setEditCategoryLgt] = useState(50);

  // Rename modal form state
  const [newTagNameInput, setNewTagNameInput] = useState("");

  // Merge modal form state
  const [mergeTargetInput, setMergeTargetInput] = useState("");
  const [mergeSuggestions, setMergeSuggestions] = useState<
    { id: number; name: string }[]
  >([]);
  const [mergeSuggestionsOpen, setMergeSuggestionsOpen] = useState(false);
  const mergeSuggestContainerRef = useRef<HTMLDivElement>(null);

  // Auto-dismiss notifications
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // Fetch Tags function
  const fetchTags = useCallback(
    async (reset = false) => {
      setLoading(true);
      try {
        const currentCursor = reset ? "" : cursorRef.current || "";
        const limit = 50;
        const res = await fetch(
          `/api/tags?search=${encodeURIComponent(searchQuery)}&category=${encodeURIComponent(categoryFilter)}&sortBy=${sortBy}&limit=${limit}&cursor=${currentCursor}`,
        );
        if (!res.ok) throw new Error("Failed to fetch tags");
        const data = await res.json();

        setTags((prev) => (reset ? data.items : [...prev, ...data.items]));
        setCursor(data.nextCursor);
        setHasMore(data.nextCursor !== null);
      } catch (err) {
        setNotification({
          type: "error",
          message: err instanceof Error ? err.message : "Error loading tags",
        });
      } finally {
        setLoading(false);
      }
    },
    [searchQuery, categoryFilter, sortBy],
  );

  useEffect(() => {
    fetchTags(true);
    setSelectedTagIds(new Set());
  }, [fetchTags]);

  // Fetch merge suggestions (autocomplete target tag)
  useEffect(() => {
    if (mergeTargetInput.trim().length < 2) {
      setMergeSuggestions([]);
      setMergeSuggestionsOpen(false);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/autocomplete?column=tag&q=${encodeURIComponent(mergeTargetInput.trim())}`,
        );
        if (res.ok) {
          const data = await res.json();
          // Filter out the tag being merged from target options
          const filterId = mergeTagItem?.id;
          const list = data.suggestions
            .map((s: { value: string; count?: number }) => ({
              id: 0,
              name: s.value,
            }))
            .filter((s: { name: string }) => {
              if (
                mergeTagItem &&
                s.name.toLowerCase() === mergeTagItem.name.toLowerCase()
              )
                return false;
              if (showBulkMerge) {
                const sources = tags.filter((t) => selectedTagIds.has(t.id));
                if (
                  sources.some(
                    (src) => src.name.toLowerCase() === s.name.toLowerCase(),
                  )
                )
                  return false;
              }
              return true;
            });
          setMergeSuggestions(list);
          setMergeSuggestionsOpen(list.length > 0);
        }
      } catch (err) {
        console.error(err);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [mergeTargetInput, mergeTagItem, showBulkMerge, selectedTagIds, tags]);

  // Fetch alias suggestions (autocomplete target tag)
  useEffect(() => {
    if (aliasTargetInput.trim().length < 2) {
      setAliasSuggestions([]);
      setAliasSuggestionsOpen(false);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/autocomplete?column=tag&q=${encodeURIComponent(aliasTargetInput.trim())}`,
        );
        if (res.ok) {
          const data = await res.json();
          const list = data.suggestions
            .map((s: { value: string }) => ({
              id: 0,
              name: s.value,
            }))
            .filter((s: { name: string }) => {
              if (
                aliasTagItem &&
                s.name.toLowerCase() === aliasTagItem.name.toLowerCase()
              )
                return false;
              if (showBulkAlias) {
                const sources = tags.filter((t) => selectedTagIds.has(t.id));
                if (
                  sources.some(
                    (src) => src.name.toLowerCase() === s.name.toLowerCase(),
                  )
                )
                  return false;
              }
              return true;
            });
          setAliasSuggestions(list);
          setAliasSuggestionsOpen(list.length > 0);
        }
      } catch (err) {
        console.error(err);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [aliasTargetInput, aliasTagItem, showBulkAlias, selectedTagIds, tags]);

  // Close suggestions on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        mergeSuggestContainerRef.current &&
        !mergeSuggestContainerRef.current.contains(event.target as Node)
      ) {
        setMergeSuggestionsOpen(false);
      }
      if (
        aliasSuggestContainerRef.current &&
        !aliasSuggestContainerRef.current.contains(event.target as Node)
      ) {
        setAliasSuggestionsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Checkbox handlers
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      const allIds = tags.map((t) => t.id);
      setSelectedTagIds(new Set(allIds));
    } else {
      setSelectedTagIds(new Set());
    }
  };

  const handleSelectTag = (id: number) => {
    setSelectedTagIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Category Manager Handlers
  const handleStartEditCategory = (cat: TagCategory) => {
    setEditingCategory(cat);
    setEditCategoryName(cat.name);
    setEditCategoryHue(cat.colorHue);
    setEditCategorySat(cat.colorSaturation);
    setEditCategoryLgt(cat.colorLightness);
  };

  const handleCancelEditCategory = () => {
    setEditingCategory(null);
    setEditCategoryName("");
  };

  const handleCreateCategory = async () => {
    const trimmed = newCategoryName.trim();
    if (!trimmed) {
      setNotification({
        type: "error",
        message: "Category name cannot be empty.",
      });
      return;
    }

    try {
      const category = await createTagCategory({
        name: trimmed.toLowerCase(),
        colorHue: newCategoryHue,
        colorSaturation: newCategorySat,
        colorLightness: newCategoryLgt,
      });

      setCategoriesList((prev) => [...prev, category]);
      setNewCategoryName("");
      setNotification({
        type: "success",
        message: `Category "${trimmed}" created.`,
      });
    } catch (err) {
      setNotification({
        type: "error",
        message:
          err instanceof Error ? err.message : "Error creating category.",
      });
    }
  };

  const handleSaveEditCategory = async () => {
    if (!editingCategory) return;
    const trimmed = editCategoryName.trim();
    if (!trimmed) {
      setNotification({
        type: "error",
        message: "Category name cannot be empty.",
      });
      return;
    }

    try {
      const category = await updateTagCategory(editingCategory.id, {
        name: trimmed.toLowerCase(),
        colorHue: editCategoryHue,
        colorSaturation: editCategorySat,
        colorLightness: editCategoryLgt,
      });

      setCategoriesList((prev) =>
        prev.map((c) => (c.id === editingCategory.id ? category : c)),
      );
      setEditingCategory(null);
      setNotification({ type: "success", message: "Category updated." });
      fetchTags(true);
    } catch (err) {
      setNotification({
        type: "error",
        message:
          err instanceof Error ? err.message : "Error updating category.",
      });
    }
  };

  const handleDeleteCategory = async (id: number) => {
    if (
      !confirm(
        "Are you sure you want to delete this category? All tags in this category will be uncategorized.",
      )
    ) {
      return;
    }

    try {
      const success = await deleteTagCategory(id);
      if (success) {
        setCategoriesList((prev) => prev.filter((c) => c.id !== id));
        if (editingCategory?.id === id) {
          setEditingCategory(null);
        }
        setNotification({ type: "success", message: "Category deleted." });
        fetchTags(true);
      } else {
        setNotification({
          type: "error",
          message: "Failed to delete category.",
        });
      }
    } catch (err) {
      setNotification({
        type: "error",
        message:
          err instanceof Error ? err.message : "Error deleting category.",
      });
    }
  };

  // Tag Operations
  const handleRenameTag = async () => {
    if (!renameTagItem) return;
    const trimmed = newTagNameInput.trim();
    if (!trimmed) {
      setNotification({
        type: "error",
        message: "Tag name cannot be empty.",
      });
      return;
    }

    startTransition(async () => {
      try {
        const renamed = await renameTag(renameTagItem.id, trimmed);
        setTags((prev) =>
          prev.map((t) =>
            t.id === renameTagItem.id ? { ...t, name: renamed.name } : t,
          ),
        );
        setRenameTagItem(null);
        setNewTagNameInput("");
        setNotification({
          type: "success",
          message: `Tag renamed to "${renamed.name}".`,
        });
        router.refresh();
      } catch (err) {
        setNotification({
          type: "error",
          message: err instanceof Error ? err.message : "Error renaming tag",
        });
      }
    });
  };

  const handleMergeTags = async () => {
    const trimmedTarget = mergeTargetInput.trim();
    if (!trimmedTarget) {
      setNotification({
        type: "error",
        message: "Target tag name cannot be empty.",
      });
      return;
    }

    startTransition(async () => {
      try {
        const sources = showBulkMerge
          ? Array.from(selectedTagIds)
          : mergeTagItem
            ? [mergeTagItem.id]
            : [];

        if (sources.length === 0) return;

        // Resolve or create target tag ID
        const targetTag = await getOrCreateTagByName(trimmedTarget);

        const result = await mergeTags(sources, targetTag.id);
        setNotification({
          type: "success",
          message: `Successfully merged tags. ${result.reassignedCount} post associations reassigned.`,
        });

        // Reset inputs/selection
        setMergeTagItem(null);
        setShowBulkMerge(false);
        setMergeTargetInput("");
        setSelectedTagIds(new Set());
        fetchTags(true);
        router.refresh();
      } catch (err) {
        setNotification({
          type: "error",
          message: err instanceof Error ? err.message : "Error merging tags",
        });
      }
    });
  };

  const handleSetAlias = async () => {
    const trimmedTarget = aliasTargetInput.trim();
    startTransition(async () => {
      try {
        const sources = showBulkAlias
          ? Array.from(selectedTagIds)
          : aliasTagItem
            ? [aliasTagItem.id]
            : [];

        if (sources.length === 0) return;

        let targetTagId: number | null = null;
        if (trimmedTarget) {
          const resolvedTarget = await getOrCreateTagByName(trimmedTarget);
          targetTagId = resolvedTarget.id;
        }

        if (showBulkAlias) {
          await bulkSetTagAlias(sources, targetTagId);
        } else if (aliasTagItem) {
          await setTagAlias(aliasTagItem.id, targetTagId);
        }

        setNotification({
          type: "success",
          message: trimmedTarget
            ? `Successfully set alias to "${trimmedTarget}" for selected tag(s).`
            : "Successfully removed alias (made tag canonical) for selected tag(s).",
        });

        setAliasTagItem(null);
        setShowBulkAlias(false);
        setAliasTargetInput("");
        setSelectedTagIds(new Set());
        fetchTags(true);
        router.refresh();
      } catch (err) {
        setNotification({
          type: "error",
          message: err instanceof Error ? err.message : "Error setting alias",
        });
      }
    });
  };

  const handleDeleteSingleTag = async (tagId: number, name: string) => {
    if (!confirm(`Are you sure you want to delete the tag "${name}"?`)) return;

    startTransition(async () => {
      try {
        const success = await deleteTag(tagId);
        if (success) {
          setTags((prev) => prev.filter((t) => t.id !== tagId));
          setNotification({
            type: "success",
            message: `Tag "${name}" deleted.`,
          });
          router.refresh();
        } else {
          setNotification({ type: "error", message: "Failed to delete tag." });
        }
      } catch (err) {
        setNotification({
          type: "error",
          message: err instanceof Error ? err.message : "Error deleting tag",
        });
      }
    });
  };

  const handleBulkDelete = async () => {
    if (selectedTagIds.size === 0) return;
    if (
      !confirm(
        `Are you sure you want to delete the ${selectedTagIds.size} selected tags?`,
      )
    )
      return;

    startTransition(async () => {
      try {
        const ids = Array.from(selectedTagIds);
        const count = await deleteTags(ids);
        setNotification({
          type: "success",
          message: `Successfully deleted ${count} tags.`,
        });
        setSelectedTagIds(new Set());
        fetchTags(true);
        router.refresh();
      } catch (err) {
        setNotification({
          type: "error",
          message:
            err instanceof Error ? err.message : "Error bulk deleting tags",
        });
      }
    });
  };

  const handleBulkCategoryChange = async (
    e: React.ChangeEvent<HTMLSelectElement>,
  ) => {
    const val = e.target.value;
    if (val === "" || selectedTagIds.size === 0) return;

    const catId = val === "null" ? null : parseInt(val, 10);

    startTransition(async () => {
      try {
        const totalSelected = selectedTagIds.size;
        const ids = Array.from(selectedTagIds).filter((id) => {
          const t = tags.find((tag) => tag.id === id);
          return t ? t.aliasOfTagId === null : true;
        });

        if (ids.length === 0) {
          setNotification({
            type: "error",
            message:
              "Cannot assign category directly to alias tags. Set it on the canonical tag instead.",
          });
          return;
        }

        await bulkSetTagCategory(ids, catId);

        const skippedCount = totalSelected - ids.length;
        setNotification({
          type: "success",
          message:
            skippedCount > 0
              ? `Category updated for canonical tags. Skipped ${skippedCount} alias tags (they inherit category from their canonical tag).`
              : "Category updated successfully for selected tags.",
        });
        setSelectedTagIds(new Set());
        fetchTags(true);
        router.refresh();
      } catch (err) {
        setNotification({
          type: "error",
          message:
            err instanceof Error ? err.message : "Error updating categories",
        });
      }
    });
  };

  const handleCleanupOrphans = async () => {
    if (
      !confirm(
        "Are you sure you want to clean up all orphaned tags with 0 posts?",
      )
    )
      return;

    startTransition(async () => {
      try {
        const count = await cleanupOrphanedTags();
        setNotification({
          type: "success",
          message: `Cleaned up ${count} orphaned tags.`,
        });
        fetchTags(true);
        router.refresh();
      } catch (err) {
        setNotification({
          type: "error",
          message:
            err instanceof Error ? err.message : "Error cleaning up tags",
        });
      }
    });
  };

  return (
    <div className={styles.container}>
      {/* Toast Notification */}
      {notification && (
        <div
          className={`${styles.notification} ${
            notification.type === "success"
              ? styles.successNotification
              : styles.errorNotification
          }`}
          role="alert"
        >
          <span>{notification.message}</span>
        </div>
      )}

      {/* Header */}
      <header className={styles.header}>
        <div className={styles.titleSection}>
          <Link href="/tags" className={styles.backLink}>
            <ArrowLeft size={16} style={{ marginRight: "0.25rem" }} />
            Back
          </Link>
          <h1 className={styles.title}>Manage Tags</h1>
        </div>
        <div className={styles.headerActions}>
          <button
            type="button"
            className={`${styles.button} ${styles.btnOutline}`}
            onClick={handleCleanupOrphans}
            disabled={isPending || loading}
          >
            <Sparkles size={16} />
            Clean Orphans
          </button>
          <button
            type="button"
            className={`${styles.button} ${styles.btnPrimary}`}
            onClick={() => setShowCategoryManager(true)}
            disabled={isPending || loading}
          >
            <FolderEdit size={16} />
            Manage Categories
          </button>
        </div>
      </header>

      {/* Controls & Filter Panel */}
      <section className={styles.controlsPanel}>
        <div className={styles.searchBar}>
          <div className={styles.inputWrapper}>
            <Search className={styles.inputIcon} size={18} />
            <input
              type="text"
              className={styles.input}
              placeholder="Search tags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <select
            className={styles.select}
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="all">All Categories</option>
            <option value="none">Uncategorized</option>
            {categoriesList.map((cat) => (
              <option key={cat.id} value={cat.name}>
                {cat.name}
              </option>
            ))}
          </select>
          <select
            className={styles.select}
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as "count" | "name")}
          >
            <option value="count">Most Popular</option>
            <option value="name">Alphabetical</option>
          </select>
        </div>
      </section>

      {/* Bulk Action Bar */}
      {selectedTagIds.size > 0 && (
        <section className={styles.bulkActionBar}>
          <div className={styles.bulkInfo}>
            <span className={styles.selectedCount}>{selectedTagIds.size}</span>
            <span>tags selected</span>
          </div>
          <div className={styles.bulkActions}>
            <button
              type="button"
              className={`${styles.button} ${styles.btnOutline}`}
              onClick={() => setShowBulkMerge(true)}
              disabled={isPending}
            >
              <MergeIcon size={16} />
              Merge Selected
            </button>

            <button
              type="button"
              className={`${styles.button} ${styles.btnOutline}`}
              onClick={() => setShowBulkAlias(true)}
              disabled={isPending}
            >
              <Link2 size={16} />
              Alias Selected
            </button>

            <select
              className={styles.select}
              style={{ minWidth: "150px", padding: "0.5rem 1rem" }}
              value=""
              onChange={handleBulkCategoryChange}
              disabled={isPending}
            >
              <option value="" disabled>
                Assign Category...
              </option>
              <option value="null">None (Uncategorize)</option>
              {categoriesList.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>

            <button
              type="button"
              className={`${styles.button} ${styles.btnDanger}`}
              onClick={handleBulkDelete}
              disabled={isPending}
            >
              <Trash size={16} />
              Delete Selected
            </button>
          </div>
        </section>
      )}

      {/* Tags Table */}
      <section className={styles.tableContainer}>
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.thCheckbox}>
                  <input
                    type="checkbox"
                    className={styles.checkboxInput}
                    checked={
                      tags.length > 0 && selectedTagIds.size === tags.length
                    }
                    onChange={handleSelectAll}
                  />
                </th>
                <th className={styles.th}>Tag Name</th>
                <th className={styles.th}>Category</th>
                <th className={styles.th}>Post Count</th>
                <th className={styles.th} style={{ textAlign: "right" }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {tags.map((tag) => (
                <tr
                  key={tag.id}
                  className={`${styles.tr} ${selectedTagIds.has(tag.id) ? styles.trSelected : ""}`}
                >
                  <td className={styles.tdCheckbox}>
                    <input
                      type="checkbox"
                      className={styles.checkboxInput}
                      checked={selectedTagIds.has(tag.id)}
                      onChange={() => handleSelectTag(tag.id)}
                    />
                  </td>
                  <td className={`${styles.td} ${styles.tagNameCell}`}>
                    <div className={styles.tagNameContainer}>
                      <Link
                        href={`/gallery?search=${encodeURIComponent(tag.name)}`}
                        className={styles.tagNameLink}
                        style={{ color: "inherit", textDecoration: "none" }}
                      >
                        {tag.name}
                      </Link>
                      {tag.aliasName && (
                        <span
                          className={styles.aliasIndicator}
                          title={`Alias of ${tag.aliasName}`}
                        >
                          <Link2 size={12} style={{ marginRight: "2px" }} />↳{" "}
                          {tag.aliasName}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className={styles.td}>
                    {tag.category ? (
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
                    ) : (
                      <span className={styles.noCategory}>uncategorized</span>
                    )}
                  </td>
                  <td className={styles.td}>{tag.postCount}</td>
                  <td className={`${styles.td} ${styles.actionsCell}`}>
                    <button
                      type="button"
                      className={styles.iconButton}
                      title="Rename"
                      onClick={() => {
                        setRenameTagItem(tag);
                        setNewTagNameInput(tag.name);
                      }}
                      disabled={isPending}
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      type="button"
                      className={styles.iconButton}
                      title="Merge into target"
                      onClick={() => {
                        setMergeTagItem(tag);
                        setMergeTargetInput("");
                      }}
                      disabled={isPending}
                    >
                      <MergeIcon size={16} />
                    </button>
                    <button
                      type="button"
                      className={styles.iconButton}
                      title="Set Alias"
                      onClick={() => {
                        setAliasTagItem(tag);
                        setAliasTargetInput(tag.aliasName || "");
                      }}
                      disabled={isPending}
                    >
                      <Link2 size={16} />
                    </button>
                    <button
                      type="button"
                      className={`${styles.iconButton} ${styles.iconButtonDanger}`}
                      title="Delete"
                      onClick={() => handleDeleteSingleTag(tag.id, tag.name)}
                      disabled={isPending}
                    >
                      <Trash size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {tags.length === 0 && !loading && (
          <div className={styles.emptyState}>
            <span>No tags matched filters.</span>
          </div>
        )}

        {/* Infinite Scroll Pagination */}
        <InfiniteScrollSentinel
          loadMore={() => fetchTags(false)}
          hasMore={hasMore}
          isLoading={loading}
        />
      </section>

      {/* RENAME MODAL */}
      {renameTagItem && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Rename Tag</h2>
              <button
                type="button"
                className={styles.closeButton}
                onClick={() => setRenameTagItem(null)}
              >
                <X size={20} />
              </button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="renameInput">
                  New Tag Name
                </label>
                <input
                  id="renameInput"
                  type="text"
                  className={styles.input}
                  value={newTagNameInput}
                  onChange={(e) => setNewTagNameInput(e.target.value)}
                  placeholder="Enter new tag name..."
                />
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button
                type="button"
                className={`${styles.button} ${styles.btnSecondary}`}
                onClick={() => setRenameTagItem(null)}
                disabled={isPending}
              >
                Cancel
              </button>
              <button
                type="button"
                className={`${styles.button} ${styles.btnPrimary}`}
                onClick={handleRenameTag}
                disabled={isPending}
              >
                Rename
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MERGE MODAL (SINGLE OR BULK) */}
      {(mergeTagItem || showBulkMerge) && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Merge Tags</h2>
              <button
                type="button"
                className={styles.closeButton}
                onClick={() => {
                  setMergeTagItem(null);
                  setShowBulkMerge(false);
                }}
              >
                <X size={20} />
              </button>
            </div>
            <div className={styles.modalBody}>
              <p className={styles.helperText}>
                Merging tags will move all post associations from the source
                tags to the target tag. The source tags will then be deleted.
              </p>
              <div className={styles.formGroup}>
                <span className={styles.label}>Source Tag(s)</span>
                <div
                  style={{
                    maxHeight: "100px",
                    overflowY: "auto",
                    background: "hsl(var(--secondary) / 0.15)",
                    padding: "0.5rem",
                    borderRadius: "6px",
                    fontSize: "0.9rem",
                  }}
                >
                  {showBulkMerge
                    ? tags
                        .filter((t) => selectedTagIds.has(t.id))
                        .map((t) => t.name)
                        .join(", ")
                    : mergeTagItem?.name}
                </div>
              </div>
              <div
                className={styles.formGroup}
                style={{ position: "relative" }}
              >
                <label className={styles.label} htmlFor="mergeTargetInput">
                  Target Tag Name (autocomplete or type new)
                </label>
                <div ref={mergeSuggestContainerRef}>
                  <input
                    id="mergeTargetInput"
                    type="text"
                    className={styles.input}
                    value={mergeTargetInput}
                    onChange={(e) => setMergeTargetInput(e.target.value)}
                    onFocus={() => {
                      if (mergeSuggestions.length > 0)
                        setMergeSuggestionsOpen(true);
                    }}
                    placeholder="Search or enter target tag..."
                    autoComplete="off"
                  />
                  {mergeSuggestionsOpen && mergeSuggestions.length > 0 && (
                    <div className={styles.autocompleteDropdown}>
                      {mergeSuggestions.map((item) => (
                        <button
                          key={item.name}
                          type="button"
                          className={styles.autocompleteItem}
                          style={{
                            width: "100%",
                            textAlign: "left",
                            background: "transparent",
                            border: "none",
                            color: "inherit",
                            font: "inherit",
                          }}
                          onClick={() => {
                            setMergeTargetInput(item.name);
                            setMergeSuggestionsOpen(false);
                          }}
                        >
                          {item.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button
                type="button"
                className={`${styles.button} ${styles.btnSecondary}`}
                onClick={() => {
                  setMergeTagItem(null);
                  setShowBulkMerge(false);
                }}
                disabled={isPending}
              >
                Cancel
              </button>
              <button
                type="button"
                className={`${styles.button} ${styles.btnPrimary}`}
                onClick={handleMergeTags}
                disabled={isPending}
              >
                Merge Tags
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ALIAS MODAL (SINGLE OR BULK) */}
      {(aliasTagItem || showBulkAlias) && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Set Tag Alias</h2>
              <button
                type="button"
                className={styles.closeButton}
                onClick={() => {
                  setAliasTagItem(null);
                  setShowBulkAlias(false);
                }}
              >
                <X size={20} />
              </button>
            </div>
            <div className={styles.modalBody}>
              <p className={styles.helperText}>
                Setting an alias makes tag(s) redirect to a target canonical
                tag. Leave target empty to clear alias and make tag(s)
                canonical.
              </p>
              <div className={styles.formGroup}>
                <span className={styles.label}>Source Tag(s)</span>
                <div
                  style={{
                    maxHeight: "100px",
                    overflowY: "auto",
                    background: "hsl(var(--secondary) / 0.15)",
                    padding: "0.5rem",
                    borderRadius: "6px",
                    fontSize: "0.9rem",
                  }}
                >
                  {showBulkAlias
                    ? tags
                        .filter((t) => selectedTagIds.has(t.id))
                        .map((t) => t.name)
                        .join(", ")
                    : aliasTagItem?.name}
                </div>
              </div>
              <div
                className={styles.formGroup}
                style={{ position: "relative" }}
              >
                <label className={styles.label} htmlFor="aliasTargetInput">
                  Target Canonical Tag (autocomplete or type new)
                </label>
                <div ref={aliasSuggestContainerRef}>
                  <input
                    id="aliasTargetInput"
                    type="text"
                    className={styles.input}
                    value={aliasTargetInput}
                    onChange={(e) => setAliasTargetInput(e.target.value)}
                    onFocus={() => {
                      if (aliasSuggestions.length > 0)
                        setAliasSuggestionsOpen(true);
                    }}
                    placeholder="Search target or leave empty..."
                    autoComplete="off"
                  />
                  {aliasSuggestionsOpen && aliasSuggestions.length > 0 && (
                    <div className={styles.autocompleteDropdown}>
                      {aliasSuggestions.map((item) => (
                        <button
                          key={item.name}
                          type="button"
                          className={styles.autocompleteItem}
                          style={{
                            width: "100%",
                            textAlign: "left",
                            background: "transparent",
                            border: "none",
                            color: "inherit",
                            font: "inherit",
                          }}
                          onClick={() => {
                            setAliasTargetInput(item.name);
                            setAliasSuggestionsOpen(false);
                          }}
                        >
                          {item.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button
                type="button"
                className={`${styles.button} ${styles.btnSecondary}`}
                onClick={() => {
                  setAliasTagItem(null);
                  setShowBulkAlias(false);
                }}
                disabled={isPending}
              >
                Cancel
              </button>
              <button
                type="button"
                className={`${styles.button} ${styles.btnPrimary}`}
                onClick={handleSetAlias}
                disabled={isPending}
              >
                Set Alias
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CATEGORY MANAGER MODAL (RELOCATED FROM SETTINGS) */}
      {showCategoryManager && (
        <div className={styles.modalOverlay}>
          <div className={`${styles.modal} ${styles.modalLarge}`}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Manage Tag Categories</h2>
              <button
                type="button"
                className={styles.closeButton}
                onClick={() => setShowCategoryManager(false)}
              >
                <X size={20} />
              </button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.categoriesGrid}>
                {/* Left: Category list */}
                <div className={styles.categoryList}>
                  {categoriesList.map((cat) => (
                    <div key={cat.id} className={styles.categoryCard}>
                      <div className={styles.categoryCardHeader}>
                        <div className={styles.categoryInfo}>
                          <h3 className={styles.categoryCardName}>
                            {cat.name}
                          </h3>
                          <span
                            className={
                              cat.isBuiltin
                                ? styles.badgeBuiltin
                                : styles.badgeCustom
                            }
                          >
                            {cat.isBuiltin ? "System" : "Custom"}
                          </span>
                        </div>
                        <div className={styles.categoryActions}>
                          <button
                            type="button"
                            className={styles.editBtn}
                            onClick={() => handleStartEditCategory(cat)}
                            title="Edit Color/Name"
                          >
                            <Edit2 size={12} />
                          </button>
                          {!cat.isBuiltin && (
                            <button
                              type="button"
                              className={styles.deleteBtn}
                              onClick={() => handleDeleteCategory(cat.id)}
                              title="Delete Category"
                            >
                              <Trash size={12} />
                            </button>
                          )}
                        </div>
                      </div>
                      <div className={styles.categoryColorDetails}>
                        <div
                          className={styles.colorCircle}
                          style={{
                            backgroundColor: `hsl(${cat.colorHue} ${cat.colorSaturation}% ${cat.colorLightness}%)`,
                          }}
                        />
                        <span className={styles.colorText}>
                          hsl({cat.colorHue}, {cat.colorSaturation}%,{" "}
                          {cat.colorLightness}%)
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Right: Form */}
                <div className={styles.categoryFormPanel}>
                  <h3 className={styles.formPanelTitle}>
                    {editingCategory ? "Edit Category" : "Create New Category"}
                  </h3>
                  <div className={styles.formGroup}>
                    <label htmlFor="catName" className={styles.label}>
                      Category Name
                    </label>
                    <input
                      id="catName"
                      type="text"
                      placeholder="e.g. character, custom"
                      value={
                        editingCategory ? editCategoryName : newCategoryName
                      }
                      disabled={editingCategory?.isBuiltin}
                      onChange={(e) =>
                        editingCategory
                          ? setEditCategoryName(e.target.value)
                          : setNewCategoryName(e.target.value)
                      }
                      className={styles.input}
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <div className={styles.colorSliderHeader}>
                      <span className={styles.label}>
                        Hue (
                        {editingCategory ? editCategoryHue : newCategoryHue}°)
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="360"
                      value={editingCategory ? editCategoryHue : newCategoryHue}
                      onChange={(e) =>
                        editingCategory
                          ? setEditCategoryHue(parseInt(e.target.value, 10))
                          : setNewCategoryHue(parseInt(e.target.value, 10))
                      }
                      className={styles.sliderInput}
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <div className={styles.colorSliderHeader}>
                      <span className={styles.label}>
                        Saturation (
                        {editingCategory ? editCategorySat : newCategorySat}%)
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={editingCategory ? editCategorySat : newCategorySat}
                      onChange={(e) =>
                        editingCategory
                          ? setEditCategorySat(parseInt(e.target.value, 10))
                          : setNewCategorySat(parseInt(e.target.value, 10))
                      }
                      className={styles.sliderInput}
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <div className={styles.colorSliderHeader}>
                      <span className={styles.label}>
                        Lightness (
                        {editingCategory ? editCategoryLgt : newCategoryLgt}%)
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={editingCategory ? editCategoryLgt : newCategoryLgt}
                      onChange={(e) =>
                        editingCategory
                          ? setEditCategoryLgt(parseInt(e.target.value, 10))
                          : setNewCategoryLgt(parseInt(e.target.value, 10))
                      }
                      className={styles.sliderInput}
                    />
                  </div>
                  <div className={styles.colorPreviewSection}>
                    <span className={styles.label}>Color Preview</span>
                    <div className={styles.colorPreviewCard}>
                      <span
                        className={styles.previewBadge}
                        style={{
                          backgroundColor: `hsl(${editingCategory ? editCategoryHue : newCategoryHue} ${editingCategory ? editCategorySat : newCategorySat}% ${editingCategory ? editCategoryLgt : newCategoryLgt}% / 0.15)`,
                          color: `hsl(${editingCategory ? editCategoryHue : newCategoryHue} ${editingCategory ? editCategorySat : newCategorySat}% ${editingCategory ? editCategoryLgt : newCategoryLgt}%)`,
                          borderColor: `hsl(${editingCategory ? editCategoryHue : newCategoryHue} ${editingCategory ? editCategorySat : newCategorySat}% ${editingCategory ? editCategoryLgt : newCategoryLgt}% / 0.3)`,
                          borderWidth: "1px",
                          borderStyle: "solid",
                        }}
                      >
                        {editingCategory
                          ? editCategoryName || "preview"
                          : newCategoryName || "preview"}
                      </span>
                    </div>
                  </div>
                  <div className={styles.formButtons}>
                    {editingCategory && (
                      <button
                        type="button"
                        className={`${styles.button} ${styles.cancelButton}`}
                        onClick={handleCancelEditCategory}
                      >
                        Cancel
                      </button>
                    )}
                    <button
                      type="button"
                      className={`${styles.button} ${styles.saveButton}`}
                      onClick={
                        editingCategory
                          ? handleSaveEditCategory
                          : handleCreateCategory
                      }
                    >
                      {editingCategory ? "Save Changes" : "Create Category"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button
                type="button"
                className={`${styles.button} ${styles.btnSecondary}`}
                onClick={() => setShowCategoryManager(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
