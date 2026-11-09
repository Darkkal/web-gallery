import {
  ChevronUp,
  Edit2,
  FolderEdit,
  Link2,
  Merge,
  Network,
  Trash,
} from "lucide-react";
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import type { TagManageItem } from "@/types/media";
import styles from "../page.module.css";

const tagActions = [
  { key: "rename", label: "Rename", Icon: Edit2 },
  { key: "merge", label: "Merge into target", Icon: Merge },
  { key: "alias", label: "Set Alias", Icon: Link2 },
  { key: "parent", label: "Set Parent", Icon: ChevronUp, disallowAlias: true },
  {
    key: "related",
    label: "Manage Related",
    Icon: Network,
    disallowAlias: true,
  },
  {
    key: "category",
    label: "Set Category",
    Icon: FolderEdit,
    disallowAlias: true,
  },
  { key: "delete", label: "Delete", Icon: Trash },
] as const;

interface TagListProps {
  view: "card" | "table";
  tags: TagManageItem[];
  selectedIds: ReadonlySet<number>;
  selectAll: ReactNode;
  onSelect: (id: number) => void;
  actions: Record<
    (typeof tagActions)[number]["key"],
    (tag: TagManageItem) => void
  >;
  pending: boolean;
}

function TagName({ tag }: { tag: TagManageItem }) {
  return (
    <div className={styles.tagNameContainer}>
      <Link
        href={`/gallery?search=${encodeURIComponent(`tag:${tag.name} `)}`}
        className={styles.tagNameLink}
      >
        {tag.name}
      </Link>
      {tag.aliasName && (
        <span
          className={styles.aliasIndicator}
          title={`Alias of ${tag.aliasName}`}
        >
          <Link2 size={12} aria-hidden="true" />
          <span>↳ {tag.aliasName}</span>
        </span>
      )}
      {tag.parentName && (
        <span
          className={styles.aliasIndicator}
          title={`Child of ${tag.parentName}`}
        >
          <ChevronUp size={12} aria-hidden="true" />
          <span>{tag.parentName}</span>
        </span>
      )}
    </div>
  );
}

function CategoryBadge({ category }: { category: TagManageItem["category"] }) {
  if (!category) {
    return <span className={styles.noCategory}>uncategorized</span>;
  }

  return (
    <span
      className={styles.categoryBadge}
      style={
        {
          "--tag-hue": category.colorHue,
          "--tag-sat": `${category.colorSaturation}%`,
          "--tag-lgt": `${category.colorLightness}%`,
        } as CSSProperties
      }
    >
      {category.name}
    </span>
  );
}

function TagActions({
  tag,
  actions,
  pending,
  showLabels,
}: {
  tag: TagManageItem;
  actions: TagListProps["actions"];
  pending: boolean;
  showLabels: boolean;
}) {
  return tagActions.map((action) => (
    <button
      key={action.key}
      type="button"
      className={`${styles.iconButton} ${action.key === "delete" ? styles.iconButtonDanger : ""}`}
      aria-label={action.label}
      title={action.label}
      onClick={() => actions[action.key](tag)}
      disabled={
        pending || ("disallowAlias" in action && tag.aliasOfTagId !== null)
      }
    >
      <action.Icon size={16} aria-hidden="true" />
      {showLabels && action.label}
    </button>
  ));
}

function TagEntry({
  tag,
  cards,
  selected,
  onSelect,
  actions,
  pending,
}: {
  tag: TagManageItem;
  cards: boolean;
  selected: boolean;
  onSelect: TagListProps["onSelect"];
  actions: TagListProps["actions"];
  pending: boolean;
}) {
  const checkbox = (
    <input
      type="checkbox"
      className={styles.checkboxInput}
      aria-label={`Select ${tag.name}`}
      checked={selected}
      onChange={() => onSelect(tag.id)}
    />
  );
  const name = <TagName tag={tag} />;
  const category = <CategoryBadge category={tag.category} />;
  const buttons = (
    <TagActions
      tag={tag}
      actions={actions}
      pending={pending}
      showLabels={cards}
    />
  );

  return cards ? (
    <li className={`${styles.tagCard} ${selected ? styles.trSelected : ""}`}>
      <div className={styles.cardHeading}>
        {checkbox}
        {name}
      </div>
      <div className={styles.cardDetails}>
        {category}
        <span>Post Count: {tag.postCount}</span>
      </div>
      <div className={styles.cardActions}>{buttons}</div>
    </li>
  ) : (
    <tr className={`${styles.tr} ${selected ? styles.trSelected : ""}`}>
      <td className={styles.tdCheckbox}>{checkbox}</td>
      <td className={`${styles.td} ${styles.tagNameCell}`}>{name}</td>
      <td className={styles.td}>{category}</td>
      <td className={styles.td}>{tag.postCount}</td>
      <td className={styles.td}>
        <div className={styles.actionsCell}>{buttons}</div>
      </td>
    </tr>
  );
}

export default function TagList({
  view,
  tags,
  selectedIds,
  selectAll,
  onSelect,
  actions,
  pending,
}: TagListProps) {
  const cards = view === "card";
  const entries = tags.map((tag) => (
    <TagEntry
      key={tag.id}
      tag={tag}
      cards={cards}
      selected={selectedIds.has(tag.id)}
      onSelect={onSelect}
      actions={actions}
      pending={pending}
    />
  ));

  if (cards) {
    return (
      <>
        <div className={styles.cardToolbar}>
          <label htmlFor="select-loaded-tags">
            {selectAll} Select all loaded tags
          </label>
        </div>
        <ul aria-label="Tag cards" className={styles.tagCards}>
          {entries}
        </ul>
      </>
    );
  }

  return (
    <div className={styles.tableWrapper}>
      <table className={styles.table} aria-label="Tag table">
        <thead>
          <tr>
            <th className={styles.thCheckbox} scope="col">
              {selectAll}
            </th>
            <th className={styles.th} scope="col">
              Tag Name
            </th>
            <th className={styles.th} scope="col">
              Category
            </th>
            <th className={styles.th} scope="col">
              Post Count
            </th>
            <th
              className={styles.th}
              scope="col"
              style={{ textAlign: "right" }}
            >
              Actions
            </th>
          </tr>
        </thead>
        <tbody>{entries}</tbody>
      </table>
    </div>
  );
}
