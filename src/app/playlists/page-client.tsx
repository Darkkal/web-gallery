"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  bulkDeletePlaylists,
  createPlaylist,
  deletePlaylist,
  updatePlaylist,
} from "@/app/actions/playlists";
import ControlsBar from "@/app/playlists/components/ControlsBar";
import CreatePlaylistModal from "@/app/playlists/components/CreatePlaylistModal";
import PlaylistCard from "@/app/playlists/components/PlaylistCard";
import PlaylistTableRow from "@/app/playlists/components/PlaylistTableRow";
import styles from "@/app/playlists/page.module.css";
import { useSelection } from "@/hooks/useSelection";
import type { Playlist } from "@/types/playlist";

interface PlaylistsPageClientProps {
  initialPlaylists: Playlist[];
}

export default function PlaylistsPageClient({
  initialPlaylists,
}: PlaylistsPageClientProps) {
  const router = useRouter();
  const [playlists, setPlaylists] = useState<Playlist[]>(initialPlaylists);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("updated-desc");
  const [viewMode, setViewMode] = useState<"card" | "table">("card");

  // Dialog/Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPlaylist, setEditingPlaylist] = useState<Playlist | null>(null);

  const {
    selectedIds,
    toggleSelection,
    selectAll,
    selectedCount,
    clearSelection,
  } = useSelection();

  // Load viewMode preference from localStorage on mount
  useEffect(() => {
    const savedMode = localStorage.getItem("playlists_view_mode") as
      | "card"
      | "table";
    if (savedMode) {
      setViewMode(savedMode);
    }
  }, []);

  function handleSetViewMode(mode: "card" | "table") {
    setViewMode(mode);
    localStorage.setItem("playlists_view_mode", mode);
  }

  // Load playlists from API on search/sort change
  useEffect(() => {
    let active = true;
    async function loadData() {
      try {
        const queryParams = new URLSearchParams();
        if (search) queryParams.set("search", search);
        queryParams.set("sort", sortBy);

        const res = await fetch(`/api/playlists?${queryParams.toString()}`);
        if (!res.ok) throw new Error("Failed to fetch playlists");
        const data = await res.json();

        if (active) {
          setPlaylists(data);
        }
      } catch (error) {
        console.error("Error loading playlists:", error);
      }
    }

    // Simple debounce/defer for initial mount to avoid double fetching
    const timer = setTimeout(loadData, 100);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [search, sortBy]);

  async function reloadPlaylists() {
    const queryParams = new URLSearchParams();
    if (search) queryParams.set("search", search);
    queryParams.set("sort", sortBy);

    const res = await fetch(`/api/playlists?${queryParams.toString()}`);
    const data = await res.json();
    setPlaylists(data);
  }

  async function handleCreatePlaylist(name: string, description?: string) {
    await createPlaylist(name, description);
    await reloadPlaylists();
  }

  async function handleEditPlaylist(name: string, description?: string) {
    if (!editingPlaylist) return;
    await updatePlaylist(editingPlaylist.id, { name, description });
    setEditingPlaylist(null);
    await reloadPlaylists();
  }

  function triggerEdit(playlist: Playlist) {
    setEditingPlaylist(playlist);
    setModalOpen(true);
  }

  async function handleDelete(playlist: Playlist) {
    if (
      !confirm(
        `Are you sure you want to delete the playlist "${playlist.name}"?`,
      )
    ) {
      return;
    }
    await deletePlaylist(playlist.id);
    clearSelection();
    await reloadPlaylists();
  }

  async function handleDeleteSelected() {
    if (selectedCount === 0) return;
    if (
      !confirm(
        `Are you sure you want to delete ${selectedCount} playlists? This will also remove all their items.`,
      )
    ) {
      return;
    }

    const ids = Array.from(selectedIds);
    await bulkDeletePlaylists(ids);
    clearSelection();
    await reloadPlaylists();
  }

  function handlePlay(playlist: Playlist) {
    router.push(`/playlists/${playlist.id}/player`);
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Playlists</h1>
      </div>

      <ControlsBar
        search={search}
        setSearch={setSearch}
        sortBy={sortBy}
        setSortBy={setSortBy}
        selectedCount={selectedCount}
        onDeleteSelected={handleDeleteSelected}
        viewMode={viewMode}
        setViewMode={handleSetViewMode}
        onCreatePlaylist={() => {
          setEditingPlaylist(null);
          setModalOpen(true);
        }}
      />

      {viewMode === "card" ? (
        <div className={styles.grid}>
          {playlists.map((playlist) => (
            <PlaylistCard
              key={playlist.id}
              playlist={playlist}
              isSelected={selectedIds.has(playlist.id)}
              onToggleSelection={() => toggleSelection(playlist.id)}
              onPlay={() => handlePlay(playlist)}
              onEdit={() => triggerEdit(playlist)}
              onDelete={() => handleDelete(playlist)}
            />
          ))}
        </div>
      ) : (
        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.thCheck}>
                  <input
                    type="checkbox"
                    className={styles.checkbox}
                    checked={
                      playlists.length > 0 && selectedCount === playlists.length
                    }
                    onChange={() => selectAll(playlists.map((p) => p.id))}
                  />
                </th>
                <th className={styles.thThumb}>Preview</th>
                <th className={styles.thActions}>Actions</th>
                <th>Playlist Details</th>
                <th>Items</th>
                <th>Last Modified</th>
              </tr>
            </thead>
            <tbody>
              {playlists.map((playlist) => (
                <PlaylistTableRow
                  key={playlist.id}
                  playlist={playlist}
                  isSelected={selectedIds.has(playlist.id)}
                  onToggleSelection={() => toggleSelection(playlist.id)}
                  onPlay={() => handlePlay(playlist)}
                  onEdit={() => triggerEdit(playlist)}
                  onDelete={() => handleDelete(playlist)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {playlists.length === 0 && (
        <div className={styles.emptyState}>
          No playlists found. Create one to get started!
        </div>
      )}

      {/* Dialog for Creating or Editing Playlists */}
      <CreatePlaylistModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingPlaylist(null);
        }}
        onSubmit={editingPlaylist ? handleEditPlaylist : handleCreatePlaylist}
        initialName={editingPlaylist?.name ?? ""}
        initialDescription={editingPlaylist?.description ?? ""}
        title={editingPlaylist ? "Edit Playlist Details" : "Create Playlist"}
      />
    </div>
  );
}
