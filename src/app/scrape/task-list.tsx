"use client";

import { formatDistanceToNow } from "date-fns";
import { Check, Pencil, Play, Square, Trash2, X, Zap } from "lucide-react";
import React, { useState } from "react";
import {
  deleteScrapeTask,
  runTaskNow,
  stopTask,
  updateScrapeTask,
} from "@/app/scrape/actions";
import styles from "@/app/scrape/page.module.css";
import ScheduleBuilder from "@/app/scrape/schedule-builder";
import { describeSchedule } from "@/lib/utils/schedule-utils";

interface Task {
  id: number;
  name: string | null;
  sourceId: number;
  enabled: boolean | null;
  lastRunAt: Date | null;
  nextRunAt: Date | null;
  downloadOptions: {
    stopAfterCompleted?: number;
    stopAfterSkipped?: number;
    stopAfterPosts?: number;
  } | null;
  scheduleInterval: number | null;
  scheduleCron: string | null;
}

interface Source {
  id: number;
  name: string | null;
  url: string;
}

export default function ScrapeTaskList({
  initialTasks,
  sources,
}: {
  initialTasks: Task[];
  sources: Source[];
}) {
  const [runningTasks, setRunningTasks] = useState<Set<number>>(new Set());
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [editValues, setEditValues] = useState<{
    name: string;
    stopAfterCompleted: string;
    stopAfterSkipped: string;
    stopAfterPosts: string;
    enabled: boolean;
    scheduleInterval: number | null;
    scheduleCron: string | null;
  }>({
    name: "",
    stopAfterCompleted: "",
    stopAfterSkipped: "",
    stopAfterPosts: "",
    enabled: true,
    scheduleInterval: null,
    scheduleCron: null,
  });

  const handleRun = async (id: number, mode: "full" | "quick") => {
    setRunningTasks((prev) => new Set(prev).add(id));
    try {
      await runTaskNow(id, mode);
    } catch (error) {
      console.error("Failed to run task:", error);
      alert("Failed to run task");
    } finally {
      setTimeout(() => {
        setRunningTasks((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }, 2000);
    }
  };

  const handleStop = async (id: number) => {
    try {
      await stopTask(id);
    } catch (error) {
      console.error("Failed to stop task:", error);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this task?")) return;
    await deleteScrapeTask(id);
  };

  const handleEditClick = (task: Task) => {
    setEditingTaskId(task.id);
    setEditValues({
      name: task.name || "",
      stopAfterCompleted:
        task.downloadOptions?.stopAfterCompleted?.toString() || "",
      stopAfterSkipped:
        task.downloadOptions?.stopAfterSkipped?.toString() || "",
      stopAfterPosts: task.downloadOptions?.stopAfterPosts?.toString() || "",
      enabled: task.enabled ?? true,
      scheduleInterval: task.scheduleInterval,
      scheduleCron: task.scheduleCron,
    });
  };

  const handleCancelEdit = () => {
    setEditingTaskId(null);
  };

  const handleSaveEdit = async (id: number) => {
    setSavingId(id);
    try {
      await updateScrapeTask(id, {
        name: editValues.name || undefined,
        downloadOptions: {
          stopAfterCompleted: editValues.stopAfterCompleted
            ? parseInt(editValues.stopAfterCompleted, 10)
            : undefined,
          stopAfterSkipped: editValues.stopAfterSkipped
            ? parseInt(editValues.stopAfterSkipped, 10)
            : undefined,
          stopAfterPosts: editValues.stopAfterPosts
            ? parseInt(editValues.stopAfterPosts, 10)
            : undefined,
        },
        enabled: editValues.enabled,
        scheduleInterval: editValues.scheduleInterval,
        scheduleCron: editValues.scheduleCron,
      });
      setEditingTaskId(null);
    } catch (error) {
      console.error("Failed to save task:", error);
      alert("Failed to save task");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className={styles.listContainer}>
      {/* Desktop Table View */}
      <div className={styles.desktopTable}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Limits</th>
              <th>Schedule</th>
              <th>Last Run</th>
              <th>Next Run</th>
              <th>Status</th>
              <th style={{ textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {initialTasks.map((task) => {
              const source = sources.find((s) => s.id === task.sourceId);
              const sourceDisplay = source
                ? source.name || source.url
                : `Source ID: ${task.sourceId}`;

              return editingTaskId === task.id ? (
                <React.Fragment key={`edit-group-${task.id}`}>
                  <tr
                    className={styles.tableRow}
                    style={{ borderBottom: "none" }}
                  >
                    <td>
                      <input
                        value={editValues.name}
                        onChange={(e) =>
                          setEditValues({
                            ...editValues,
                            name: e.target.value,
                          })
                        }
                        placeholder="Task Name"
                        className={styles.input}
                        style={{
                          width: "100%",
                          marginBottom: "4px",
                          padding: "4px 8px",
                        }}
                      />
                      <div
                        style={{
                          fontSize: "0.75rem",
                          color: "hsl(var(--muted-foreground))",
                          maxWidth: "300px",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                        title={source?.url}
                      >
                        {sourceDisplay}
                      </div>
                    </td>
                    <td>
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "4px",
                        }}
                      >
                        <input
                          type="number"
                          min="1"
                          value={editValues.stopAfterCompleted}
                          onChange={(e) =>
                            setEditValues({
                              ...editValues,
                              stopAfterCompleted: e.target.value,
                            })
                          }
                          placeholder="Max DL"
                          className={styles.input}
                          style={{
                            fontSize: "0.75rem",
                            padding: "2px 4px",
                            height: "auto",
                          }}
                          title="Stop after completed"
                        />
                        <input
                          type="number"
                          min="1"
                          value={editValues.stopAfterSkipped}
                          onChange={(e) =>
                            setEditValues({
                              ...editValues,
                              stopAfterSkipped: e.target.value,
                            })
                          }
                          placeholder="Max Skip"
                          className={styles.input}
                          style={{
                            fontSize: "0.75rem",
                            padding: "2px 4px",
                            height: "auto",
                          }}
                          title="Stop after skipped"
                        />
                        <input
                          type="number"
                          min="1"
                          value={editValues.stopAfterPosts}
                          onChange={(e) =>
                            setEditValues({
                              ...editValues,
                              stopAfterPosts: e.target.value,
                            })
                          }
                          placeholder="Max Posts"
                          className={styles.input}
                          style={{
                            fontSize: "0.75rem",
                            padding: "2px 4px",
                            height: "auto",
                          }}
                          title="Stop after posts"
                        />
                      </div>
                    </td>
                    <td colSpan={3}>
                      <div
                        style={{
                          fontSize: "0.875rem",
                          color: "hsl(var(--muted-foreground))",
                        }}
                      >
                        Editing Schedule Below
                      </div>
                    </td>
                    <td>
                      <label
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "4px",
                          fontSize: "0.875rem",
                          cursor: "pointer",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={editValues.enabled}
                          onChange={(e) =>
                            setEditValues({
                              ...editValues,
                              enabled: e.target.checked,
                            })
                          }
                          style={{ margin: 0 }}
                        />
                        Enabled
                      </label>
                    </td>
                    <td>
                      <div className={styles.actionGroup}>
                        <button
                          type="button"
                          onClick={() => handleSaveEdit(task.id)}
                          disabled={savingId === task.id}
                          className={styles.iconButton}
                          style={{
                            color: "hsl(142.1 76.2% 36.3%)",
                          }}
                          title="Save Changes"
                        >
                          <Check size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={handleCancelEdit}
                          disabled={savingId === task.id}
                          className={styles.iconButton}
                          style={{
                            color: "hsl(var(--destructive))",
                          }}
                          title="Cancel"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                  <tr
                    className={styles.tableRow}
                    style={{ background: "hsl(var(--muted) / 0.1)" }}
                  >
                    <td colSpan={7} style={{ padding: "0 1rem 1rem 1rem" }}>
                      <ScheduleBuilder
                        initialInterval={editValues.scheduleInterval}
                        initialCron={editValues.scheduleCron}
                        onChange={({ scheduleInterval, scheduleCron }) => {
                          setEditValues((prev) => ({
                            ...prev,
                            scheduleInterval,
                            scheduleCron,
                          }));
                        }}
                      />
                    </td>
                  </tr>
                </React.Fragment>
              ) : (
                <tr key={task.id} className={styles.tableRow}>
                  <td>
                    <div style={{ fontWeight: 500 }}>
                      {task.name || `Task #${task.id}`}
                    </div>
                    <div
                      style={{
                        fontSize: "0.75rem",
                        color: "hsl(var(--muted-foreground))",
                        maxWidth: "300px",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                      title={source?.url}
                    >
                      {sourceDisplay}
                    </div>
                  </td>
                  <td>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "2px",
                        fontSize: "0.75rem",
                      }}
                    >
                      {task.downloadOptions?.stopAfterCompleted && (
                        <span>
                          Max DL: {task.downloadOptions.stopAfterCompleted}
                        </span>
                      )}
                      {task.downloadOptions?.stopAfterSkipped && (
                        <span>
                          Max Skip: {task.downloadOptions.stopAfterSkipped}
                        </span>
                      )}
                      {task.downloadOptions?.stopAfterPosts && (
                        <span>
                          Max Posts: {task.downloadOptions.stopAfterPosts}
                        </span>
                      )}
                      {!task.downloadOptions?.stopAfterCompleted &&
                        !task.downloadOptions?.stopAfterSkipped &&
                        !task.downloadOptions?.stopAfterPosts && (
                          <span
                            style={{
                              color: "hsl(var(--muted-foreground))",
                            }}
                          >
                            No limits
                          </span>
                        )}
                    </div>
                  </td>
                  <td>
                    <span style={{ fontSize: "0.875rem" }}>
                      {describeSchedule(
                        task.scheduleInterval,
                        task.scheduleCron,
                      )}
                    </span>
                  </td>
                  <td>
                    {task.lastRunAt
                      ? formatDistanceToNow(new Date(task.lastRunAt), {
                          addSuffix: true,
                        })
                      : "Never"}
                  </td>
                  <td>
                    {task.enabled && task.nextRunAt
                      ? formatDistanceToNow(new Date(task.nextRunAt), {
                          addSuffix: true,
                        })
                      : "-"}
                  </td>
                  <td>
                    {task.enabled ? (
                      <span
                        className={`${styles.badge} ${styles.badgeEnabled}`}
                      >
                        Enabled
                      </span>
                    ) : (
                      <span
                        className={`${styles.badge} ${styles.badgeDisabled}`}
                      >
                        Disabled
                      </span>
                    )}
                  </td>
                  <td>
                    <div className={styles.actionGroup}>
                      <button
                        type="button"
                        onClick={() => handleRun(task.id, "quick")}
                        disabled={runningTasks.has(task.id)}
                        className={styles.iconButton}
                        style={{
                          color: "hsl(35 100% 50%)",
                        }} // Orange color for quick
                        title="Quick Run (Stops after 15 skipped)"
                      >
                        <Zap size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRun(task.id, "full")}
                        disabled={runningTasks.has(task.id)}
                        className={styles.iconButton}
                        title="Full Run"
                      >
                        <Play size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleStop(task.id)}
                        className={styles.iconButton}
                        title="Stop Task"
                      >
                        <Square size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleEditClick(task)}
                        className={styles.iconButton}
                        title="Edit Task"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(task.id)}
                        className={styles.iconButton}
                        style={{
                          color: "hsl(var(--destructive))",
                        }}
                        title="Delete Task"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {initialTasks.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  style={{
                    textAlign: "center",
                    padding: "3rem",
                    color: "hsl(var(--muted-foreground))",
                  }}
                >
                  No tasks found. Create one above.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards View */}
      <div className={styles.mobileCardsList}>
        {initialTasks.map((task) => {
          const source = sources.find((s) => s.id === task.sourceId);
          const sourceDisplay = source
            ? source.name || source.url
            : `Source ID: ${task.sourceId}`;

          return editingTaskId === task.id ? (
            <div key={`edit-card-${task.id}`} className={styles.taskCard}>
              <div className={styles.formGroup} style={{ gap: "0.25rem" }}>
                <span className={styles.label}>Task Name</span>
                <input
                  value={editValues.name}
                  onChange={(e) =>
                    setEditValues({
                      ...editValues,
                      name: e.target.value,
                    })
                  }
                  placeholder="Task Name"
                  className={styles.input}
                />
                <div className={styles.taskCardSource}>{sourceDisplay}</div>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  gap: "0.5rem",
                  marginTop: "0.5rem",
                }}
              >
                <div className={styles.formGroup} style={{ gap: "0.25rem" }}>
                  <span
                    className={styles.label}
                    style={{ fontSize: "0.75rem" }}
                  >
                    Max DL
                  </span>
                  <input
                    type="number"
                    min="1"
                    value={editValues.stopAfterCompleted}
                    onChange={(e) =>
                      setEditValues({
                        ...editValues,
                        stopAfterCompleted: e.target.value,
                      })
                    }
                    placeholder="None"
                    className={styles.input}
                    style={{ height: "2.25rem", padding: "0 0.5rem" }}
                  />
                </div>
                <div className={styles.formGroup} style={{ gap: "0.25rem" }}>
                  <span
                    className={styles.label}
                    style={{ fontSize: "0.75rem" }}
                  >
                    Max Skip
                  </span>
                  <input
                    type="number"
                    min="1"
                    value={editValues.stopAfterSkipped}
                    onChange={(e) =>
                      setEditValues({
                        ...editValues,
                        stopAfterSkipped: e.target.value,
                      })
                    }
                    placeholder="None"
                    className={styles.input}
                    style={{ height: "2.25rem", padding: "0 0.5rem" }}
                  />
                </div>
                <div className={styles.formGroup} style={{ gap: "0.25rem" }}>
                  <span
                    className={styles.label}
                    style={{ fontSize: "0.75rem" }}
                  >
                    Max Posts
                  </span>
                  <input
                    type="number"
                    min="1"
                    value={editValues.stopAfterPosts}
                    onChange={(e) =>
                      setEditValues({
                        ...editValues,
                        stopAfterPosts: e.target.value,
                      })
                    }
                    placeholder="None"
                    className={styles.input}
                    style={{ height: "2.25rem", padding: "0 0.5rem" }}
                  />
                </div>
              </div>

              <div style={{ marginTop: "0.5rem" }}>
                <ScheduleBuilder
                  initialInterval={editValues.scheduleInterval}
                  initialCron={editValues.scheduleCron}
                  onChange={({ scheduleInterval, scheduleCron }) => {
                    setEditValues((prev) => ({
                      ...prev,
                      scheduleInterval,
                      scheduleCron,
                    }));
                  }}
                />
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginTop: "0.75rem",
                  borderTop: "1px solid hsl(var(--border))",
                  paddingTop: "0.75rem",
                }}
              >
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    fontSize: "0.875rem",
                    cursor: "pointer",
                    fontWeight: 500,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={editValues.enabled}
                    onChange={(e) =>
                      setEditValues({
                        ...editValues,
                        enabled: e.target.checked,
                      })
                    }
                  />
                  Enabled
                </label>

                <div className={styles.actionGroup}>
                  <button
                    type="button"
                    onClick={() => handleSaveEdit(task.id)}
                    disabled={savingId === task.id}
                    className={styles.button}
                    style={{
                      height: "2.25rem",
                      padding: "0 0.75rem",
                      fontSize: "0.875rem",
                    }}
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    disabled={savingId === task.id}
                    className={styles.button}
                    style={{
                      height: "2.25rem",
                      padding: "0 0.75rem",
                      fontSize: "0.875rem",
                      backgroundColor: "hsl(var(--muted))",
                      color: "hsl(var(--muted-foreground))",
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div key={`card-${task.id}`} className={styles.taskCard}>
              <div className={styles.taskCardHeader}>
                <div>
                  <div className={styles.taskCardTitle}>
                    {task.name || `Task #${task.id}`}
                  </div>
                  <div className={styles.taskCardSource} title={source?.url}>
                    {sourceDisplay}
                  </div>
                </div>
                {task.enabled ? (
                  <span className={`${styles.badge} ${styles.badgeEnabled}`}>
                    Enabled
                  </span>
                ) : (
                  <span className={`${styles.badge} ${styles.badgeDisabled}`}>
                    Disabled
                  </span>
                )}
              </div>

              <div className={styles.taskCardGrid}>
                <div className={styles.taskCardField}>
                  <span className={styles.taskCardLabel}>Schedule</span>
                  <span
                    className={styles.taskCardValue}
                    style={{ fontSize: "0.8rem" }}
                  >
                    {describeSchedule(task.scheduleInterval, task.scheduleCron)}
                  </span>
                </div>
                <div className={styles.taskCardField}>
                  <span className={styles.taskCardLabel}>Limits</span>
                  <span
                    className={styles.taskCardValue}
                    style={{
                      fontSize: "0.75rem",
                      display: "flex",
                      flexDirection: "column",
                      gap: "1px",
                    }}
                  >
                    {task.downloadOptions?.stopAfterCompleted && (
                      <span>
                        Max DL: {task.downloadOptions.stopAfterCompleted}
                      </span>
                    )}
                    {task.downloadOptions?.stopAfterSkipped && (
                      <span>
                        Max Skip: {task.downloadOptions.stopAfterSkipped}
                      </span>
                    )}
                    {task.downloadOptions?.stopAfterPosts && (
                      <span>
                        Max Posts: {task.downloadOptions.stopAfterPosts}
                      </span>
                    )}
                    {!task.downloadOptions?.stopAfterCompleted &&
                      !task.downloadOptions?.stopAfterSkipped &&
                      !task.downloadOptions?.stopAfterPosts && (
                        <span>No limits</span>
                      )}
                  </span>
                </div>
                <div
                  className={styles.taskCardField}
                  style={{ marginTop: "0.25rem" }}
                >
                  <span className={styles.taskCardLabel}>Last Run</span>
                  <span
                    className={styles.taskCardValue}
                    style={{ fontSize: "0.75rem" }}
                  >
                    {task.lastRunAt
                      ? formatDistanceToNow(new Date(task.lastRunAt), {
                          addSuffix: true,
                        })
                      : "Never"}
                  </span>
                </div>
                <div
                  className={styles.taskCardField}
                  style={{ marginTop: "0.25rem" }}
                >
                  <span className={styles.taskCardLabel}>Next Run</span>
                  <span
                    className={styles.taskCardValue}
                    style={{ fontSize: "0.75rem" }}
                  >
                    {task.enabled && task.nextRunAt
                      ? formatDistanceToNow(new Date(task.nextRunAt), {
                          addSuffix: true,
                        })
                      : "-"}
                  </span>
                </div>
              </div>

              <div className={styles.taskCardActions}>
                <button
                  type="button"
                  onClick={() => handleRun(task.id, "quick")}
                  disabled={runningTasks.has(task.id)}
                  className={styles.iconButton}
                  style={{ color: "hsl(35 100% 50%)" }}
                  title="Quick Run (Stops after 15 skipped)"
                >
                  <Zap size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => handleRun(task.id, "full")}
                  disabled={runningTasks.has(task.id)}
                  className={styles.iconButton}
                  title="Full Run"
                >
                  <Play size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => handleStop(task.id)}
                  className={styles.iconButton}
                  title="Stop Task"
                >
                  <Square size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => handleEditClick(task)}
                  className={styles.iconButton}
                  title="Edit Task"
                >
                  <Pencil size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(task.id)}
                  className={styles.iconButton}
                  style={{ color: "hsl(var(--destructive))" }}
                  title="Delete Task"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          );
        })}
        {initialTasks.length === 0 && (
          <div
            className={styles.emptyCell}
            style={{ border: "none", width: "100%" }}
          >
            No tasks found. Create one above.
          </div>
        )}
      </div>
    </div>
  );
}
