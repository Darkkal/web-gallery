"use client";

import {
  AlertCircle,
  CheckCircle,
  Globe,
  Play,
  RotateCcw,
  Save,
  Settings as SettingsIcon,
  ShieldAlert,
  Sliders,
  SlidersHorizontal,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { saveSettingsAction } from "@/app/actions/settings";
import styles from "@/app/settings/page.module.css";
import { DEFAULT_SETTINGS, type SystemSettings } from "@/types/settings";

interface SettingsPageClientProps {
  initialSettings: SystemSettings;
}

export default function SettingsPageClient({
  initialSettings,
}: SettingsPageClientProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"app" | "scraper">("app");
  const [settings, setSettings] = useState<SystemSettings>(initialSettings);
  const [isSaving, setIsSaving] = useState(false);
  const [notification, setNotification] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);

  // Set hydration status on mount
  useEffect(() => {
    setIsHydrated(true);
  }, []);

  // Auto-dismiss notification after 4 seconds
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => {
        setNotification(null);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const handleAppChange = <K extends keyof SystemSettings["app"]>(
    key: K,
    value: SystemSettings["app"][K],
  ) => {
    setSettings((prev) => ({
      ...prev,
      app: {
        ...prev.app,
        [key]: value,
      },
    }));
  };

  const handleScraperChange = <K extends keyof SystemSettings["scraper"]>(
    key: K,
    value: SystemSettings["scraper"][K],
  ) => {
    setSettings((prev) => ({
      ...prev,
      scraper: {
        ...prev.scraper,
        [key]: value,
      },
    }));
  };

  const applyTheme = (theme: "dark" | "light" | "system") => {
    let resolvedTheme: "dark" | "light" = "dark";
    if (theme === "system") {
      resolvedTheme = window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
    } else {
      resolvedTheme = theme;
    }

    localStorage.setItem("theme", resolvedTheme);
    document.documentElement.setAttribute("data-theme", resolvedTheme);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setNotification(null);

    // Validation checks
    if (
      settings.app.galleryPageSize < 1 ||
      settings.app.galleryPageSize > 500
    ) {
      setNotification({
        type: "error",
        message: "Gallery page size must be between 1 and 500.",
      });
      setIsSaving(false);
      return;
    }

    if (
      settings.app.infiniteScrollBuffer < 0 ||
      settings.app.infiniteScrollBuffer > 2000
    ) {
      setNotification({
        type: "error",
        message: "Infinite scroll buffer must be between 0 and 2000 pixels.",
      });
      setIsSaving(false);
      return;
    }

    if (
      settings.app.timelinePageSize < 1 ||
      settings.app.timelinePageSize > 500
    ) {
      setNotification({
        type: "error",
        message: "Timeline page size must be between 1 and 500.",
      });
      setIsSaving(false);
      return;
    }

    if (
      settings.app.condensePostLines < 1 ||
      settings.app.condensePostLines > 20
    ) {
      setNotification({
        type: "error",
        message: "Condense post lines must be between 1 and 20 lines.",
      });
      setIsSaving(false);
      return;
    }

    if (
      settings.app.statisticsRankingLimit < 1 ||
      settings.app.statisticsRankingLimit > 100
    ) {
      setNotification({
        type: "error",
        message: "Statistics ranking limit must be between 1 and 100.",
      });
      setIsSaving(false);
      return;
    }

    if (
      settings.scraper.sleepMin < 0 ||
      settings.scraper.sleepMax < 0 ||
      settings.scraper.sleepMin > settings.scraper.sleepMax
    ) {
      setNotification({
        type: "error",
        message:
          "Scraper sleep range is invalid (Min must be >= 0 and <= Max).",
      });
      setIsSaving(false);
      return;
    }

    if (
      settings.scraper.sleepRequestMin < 0 ||
      settings.scraper.sleepRequestMax < 0 ||
      settings.scraper.sleepRequestMin > settings.scraper.sleepRequestMax
    ) {
      setNotification({
        type: "error",
        message:
          "Scraper request sleep range is invalid (Min must be >= 0 and <= Max).",
      });
      setIsSaving(false);
      return;
    }

    try {
      const res = await saveSettingsAction(settings);
      if (res.success) {
        setNotification({
          type: "success",
          message: "Settings saved and updated successfully!",
        });

        // Dynamically apply color theme immediately
        applyTheme(settings.app.colorTheme);

        router.refresh();
      } else {
        setNotification({
          type: "error",
          message: res.error || "Failed to save settings.",
        });
      }
    } catch (err) {
      setNotification({
        type: "error",
        message:
          err instanceof Error
            ? err.message
            : "An unexpected error occurred while saving.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetDefaults = () => {
    if (
      confirm(
        "Are you sure you want to reset all settings to defaults? This will clear custom proxy settings and scraper configurations.",
      )
    ) {
      setSettings(JSON.parse(JSON.stringify(DEFAULT_SETTINGS)));
      setNotification({
        type: "success",
        message: "Reset settings in form. Click 'Save Changes' to commit.",
      });
    }
  };

  return (
    <div className={styles.container} data-hydrated={isHydrated}>
      <header className={styles.header}>
        <h1 className={styles.title}>System Settings</h1>
      </header>

      {notification && (
        <div
          className={`${styles.notification} ${
            notification.type === "success"
              ? styles.successNotification
              : styles.errorNotification
          }`}
          role="alert"
        >
          {notification.type === "success" ? (
            <CheckCircle className={styles.successIcon} size={20} />
          ) : (
            <AlertCircle className={styles.errorIcon} size={20} />
          )}
          <span>{notification.message}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className={styles.settingsCard} noValidate>
        <nav className={styles.tabs} aria-label="Settings Categories">
          <button
            type="button"
            className={`${styles.tabButton} ${activeTab === "app" ? styles.activeTabButton : ""}`}
            onClick={() => setActiveTab("app")}
          >
            <SettingsIcon size={18} />
            <span>App Settings</span>
          </button>
          <button
            type="button"
            className={`${styles.tabButton} ${activeTab === "scraper" ? styles.activeTabButton : ""}`}
            onClick={() => setActiveTab("scraper")}
          >
            <SlidersHorizontal size={18} />
            <span>Scraper Settings</span>
          </button>
        </nav>

        <div className={styles.content}>
          {activeTab === "app" && (
            <div className={styles.tabContent}>
              <h2 className={styles.sectionTitle}>
                <Sliders size={18} />
                <span>General Display & Layout</span>
              </h2>

              <div className={styles.grid}>
                <div className={styles.formGroup}>
                  <label htmlFor="colorTheme" className={styles.label}>
                    Color Theme
                  </label>
                  <select
                    id="colorTheme"
                    value={settings.app.colorTheme}
                    onChange={(e) =>
                      handleAppChange(
                        "colorTheme",
                        e.target.value as "dark" | "light" | "system",
                      )
                    }
                    className={styles.select}
                  >
                    <option value="dark">Dark Theme (Default)</option>
                    <option value="light">Light Theme</option>
                    <option value="system">Follow System Preference</option>
                  </select>
                  <p className={styles.helperText}>
                    Customize application UI colors.
                  </p>
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="scrollMode" className={styles.label}>
                    Pagination Scroll Mode
                  </label>
                  <select
                    id="scrollMode"
                    value={settings.app.scrollMode}
                    onChange={(e) =>
                      handleAppChange(
                        "scrollMode",
                        e.target.value as "infinite" | "button",
                      )
                    }
                    className={styles.select}
                  >
                    <option value="infinite">
                      Infinite Loading (Sentinel)
                    </option>
                    <option value="button">Explicit "Load More" Button</option>
                  </select>
                  <p className={styles.helperText}>
                    Choose how more records are loaded into timeline & gallery.
                  </p>
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="galleryPageSize" className={styles.label}>
                    Gallery Page Size
                  </label>
                  <input
                    id="galleryPageSize"
                    type="number"
                    min="1"
                    max="500"
                    value={settings.app.galleryPageSize}
                    onChange={(e) =>
                      handleAppChange(
                        "galleryPageSize",
                        parseInt(e.target.value, 10) || 50,
                      )
                    }
                    className={styles.input}
                    required
                  />
                  <p className={styles.helperText}>
                    Number of items rendered per page in masonry view (1-500).
                  </p>
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="timelinePageSize" className={styles.label}>
                    Timeline Page Size
                  </label>
                  <input
                    id="timelinePageSize"
                    type="number"
                    min="1"
                    max="500"
                    value={settings.app.timelinePageSize}
                    onChange={(e) =>
                      handleAppChange(
                        "timelinePageSize",
                        parseInt(e.target.value, 10) || 20,
                      )
                    }
                    className={styles.input}
                    required
                  />
                  <p className={styles.helperText}>
                    Number of posts rendered per page in timeline feed (1-500).
                  </p>
                </div>

                <div className={styles.formGroup}>
                  <label
                    htmlFor="infiniteScrollBuffer"
                    className={styles.label}
                  >
                    Infinite Scroll Buffer (px)
                  </label>
                  <input
                    id="infiniteScrollBuffer"
                    type="number"
                    min="0"
                    max="2000"
                    value={settings.app.infiniteScrollBuffer}
                    onChange={(e) =>
                      handleAppChange(
                        "infiniteScrollBuffer",
                        parseInt(e.target.value, 10) || 300,
                      )
                    }
                    className={styles.input}
                    required
                  />
                  <p className={styles.helperText}>
                    Distance in pixels off-screen to trigger loading next page
                    (0-2000).
                  </p>
                </div>

                <div className={styles.formGroup}>
                  <label
                    htmlFor="scrapeLogRetentionDays"
                    className={styles.label}
                  >
                    Log Retention Days
                  </label>
                  <input
                    id="scrapeLogRetentionDays"
                    type="number"
                    min="0"
                    max="365"
                    value={settings.app.scrapeLogRetentionDays}
                    onChange={(e) =>
                      handleAppChange(
                        "scrapeLogRetentionDays",
                        parseInt(e.target.value, 10) || 0,
                      )
                    }
                    className={styles.input}
                    required
                  />
                  <p className={styles.helperText}>
                    Automatically delete scrape log files older than $N$ days.
                    Use 0 to disable cleanup.
                  </p>
                </div>
              </div>

              <h2 className={styles.sectionTitle}>
                <Sliders size={18} />
                <span>Timeline Feed Customization</span>
              </h2>

              <div
                className={styles.toggleContainer}
                style={{ marginBottom: "1.5rem" }}
              >
                <div className={styles.toggleInfo}>
                  <span className={styles.toggleTitle}>
                    Condense Long Timeline Posts
                  </span>
                  <span className={styles.toggleDescription}>
                    Automatically limit post text to a specified character limit
                    and show a "Show More" button.
                  </span>
                </div>
                <label className={styles.switch} htmlFor="condensePostText">
                  <input
                    id="condensePostText"
                    aria-label="Condense Long Timeline Posts"
                    type="checkbox"
                    checked={settings.app.condensePostText}
                    onChange={(e) =>
                      handleAppChange("condensePostText", e.target.checked)
                    }
                  />
                  <span className={styles.slider} />
                </label>
              </div>

              <div
                className={styles.formGroup}
                style={{ marginBottom: "2rem" }}
              >
                <label htmlFor="condensePostLines" className={styles.label}>
                  Condense Lines Threshold
                </label>
                <input
                  id="condensePostLines"
                  type="number"
                  min="1"
                  max="20"
                  value={settings.app.condensePostLines}
                  onChange={(e) =>
                    handleAppChange(
                      "condensePostLines",
                      parseInt(e.target.value, 10) || 2,
                    )
                  }
                  className={styles.input}
                  disabled={!settings.app.condensePostText}
                  required
                />
                <p className={styles.helperText}>
                  Maximum number of lines of text to show before condensing the
                  post.
                </p>
              </div>

              <h2 className={styles.sectionTitle}>
                <Play size={18} />
                <span>Playback & Media</span>
              </h2>

              <div
                className={styles.toggleContainer}
                style={{ marginBottom: "1.5rem" }}
              >
                <div className={styles.toggleInfo}>
                  <span className={styles.toggleTitle}>
                    Loop Videos by Default
                  </span>
                  <span className={styles.toggleDescription}>
                    Automatically loop video clips when playing them in the
                    gallery lightbox and timeline.
                  </span>
                </div>
                <label className={styles.switch} htmlFor="loopVideos">
                  <input
                    id="loopVideos"
                    aria-label="Loop Videos by Default"
                    type="checkbox"
                    checked={settings.app.loopVideos}
                    onChange={(e) =>
                      handleAppChange("loopVideos", e.target.checked)
                    }
                  />
                  <span className={styles.slider} />
                </label>
              </div>

              <div
                className={styles.toggleContainer}
                style={{ marginBottom: "1.5rem" }}
              >
                <div className={styles.toggleInfo}>
                  <span className={styles.toggleTitle}>
                    Autoplay Videos on Scroll
                  </span>
                  <span className={styles.toggleDescription}>
                    Automatically play video clips when they are scrolled into
                    view in the gallery grid and timeline.
                  </span>
                </div>
                <label className={styles.switch} htmlFor="autoplayVideos">
                  <input
                    id="autoplayVideos"
                    aria-label="Autoplay Videos on Scroll"
                    type="checkbox"
                    checked={settings.app.autoplayVideos}
                    onChange={(e) =>
                      handleAppChange("autoplayVideos", e.target.checked)
                    }
                  />
                  <span className={styles.slider} />
                </label>
              </div>

              <div
                className={styles.toggleContainer}
                style={{
                  marginBottom: "2rem",
                  opacity: settings.app.autoplayVideos ? 1 : 0.5,
                  transition: "opacity 0.2s ease-in-out",
                  pointerEvents: settings.app.autoplayVideos ? "auto" : "none",
                }}
              >
                <div className={styles.toggleInfo}>
                  <span className={styles.toggleTitle}>
                    Mute Autoplayed Videos
                  </span>
                  <span className={styles.toggleDescription}>
                    Mute videos when autoplaying to avoid overlapping audio
                    sources. Turning this off may be blocked by browser autoplay
                    policies.
                  </span>
                </div>
                <label className={styles.switch} htmlFor="muteAutoplayVideos">
                  <input
                    id="muteAutoplayVideos"
                    aria-label="Mute Autoplayed Videos"
                    type="checkbox"
                    checked={settings.app.muteAutoplayVideos}
                    disabled={!settings.app.autoplayVideos}
                    onChange={(e) =>
                      handleAppChange("muteAutoplayVideos", e.target.checked)
                    }
                  />
                  <span className={styles.slider} />
                </label>
              </div>

              <h2 className={styles.sectionTitle}>
                <Sliders size={18} />
                <span>Library Statistics Page</span>
              </h2>

              <div
                className={styles.toggleContainer}
                style={{ marginBottom: "1.5rem" }}
              >
                <div className={styles.toggleInfo}>
                  <span className={styles.toggleTitle}>
                    Compute Storage Statistics
                  </span>
                  <span className={styles.toggleDescription}>
                    Calculate total storage used by media files during library
                    scans. Disable on slow storage for faster scans.
                  </span>
                </div>
                <label
                  className={styles.switch}
                  htmlFor="computeStorageStatistics"
                >
                  <input
                    id="computeStorageStatistics"
                    aria-label="Compute Storage Statistics"
                    type="checkbox"
                    checked={settings.app.computeStorageStatistics}
                    onChange={(e) =>
                      handleAppChange(
                        "computeStorageStatistics",
                        e.target.checked,
                      )
                    }
                  />
                  <span className={styles.slider} />
                </label>
              </div>

              <div
                className={styles.formGroup}
                style={{ marginBottom: "2rem" }}
              >
                <label
                  htmlFor="statisticsRankingLimit"
                  className={styles.label}
                >
                  Ranking Cards Limit
                </label>
                <input
                  id="statisticsRankingLimit"
                  type="number"
                  min="1"
                  max="100"
                  value={settings.app.statisticsRankingLimit}
                  onChange={(e) =>
                    handleAppChange(
                      "statisticsRankingLimit",
                      parseInt(e.target.value, 10) || 10,
                    )
                  }
                  className={styles.input}
                  required
                />
                <p className={styles.helperText}>
                  Maximum number of cards shown in each ranking section on the
                  Statistics page (1-100).
                </p>
              </div>

              <h2 className={styles.sectionTitle}>
                <ShieldAlert size={18} />
                <span>Security & Admin Guards</span>
              </h2>

              <div className={styles.toggleContainer}>
                <div className={styles.toggleInfo}>
                  <span className={styles.toggleTitle}>
                    Enable Destructive Operations in Production
                  </span>
                  <span className={styles.toggleDescription}>
                    Allows full database purging, avatar deletions, and media
                    cache purges in a production environment. Leave off for
                    safety.
                  </span>
                </div>
                <label
                  className={`${styles.switch} ${styles.dangerousToggle}`}
                  htmlFor="enableProductionDestructiveOps"
                >
                  <input
                    id="enableProductionDestructiveOps"
                    aria-label="Enable Destructive Operations in Production"
                    type="checkbox"
                    checked={settings.app.enableProductionDestructiveOps}
                    onChange={(e) =>
                      handleAppChange(
                        "enableProductionDestructiveOps",
                        e.target.checked,
                      )
                    }
                  />
                  <span className={styles.slider} />
                </label>
              </div>
            </div>
          )}

          {activeTab === "scraper" && (
            <div className={styles.tabContent}>
              <h2 className={styles.sectionTitle}>
                <Globe size={18} />
                <span>Network & Fetching Controls</span>
              </h2>

              <div className={styles.grid}>
                <div className={styles.formGroup}>
                  <label htmlFor="rateLimit" className={styles.label}>
                    Network Rate Limit
                  </label>
                  <select
                    id="rateLimit"
                    value={settings.scraper.rateLimit}
                    onChange={(e) =>
                      handleScraperChange("rateLimit", e.target.value)
                    }
                    className={styles.select}
                  >
                    <option value="No Limit">No Limit (Maximum speed)</option>
                    <option value="500K">500 KB/s</option>
                    <option value="1M">1 MB/s</option>
                    <option value="2M">2 MB/s</option>
                    <option value="5M">5 MB/s (Recommended)</option>
                    <option value="10M">10 MB/s</option>
                  </select>
                  <p className={styles.helperText}>
                    Maximum download bandwidth allowed for scraper execution.
                  </p>
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="retries" className={styles.label}>
                    Connection Retries
                  </label>
                  <input
                    id="retries"
                    type="number"
                    min="0"
                    max="20"
                    value={settings.scraper.retries}
                    onChange={(e) =>
                      handleScraperChange(
                        "retries",
                        parseInt(e.target.value, 10) || 3,
                      )
                    }
                    className={styles.input}
                    required
                  />
                  <p className={styles.helperText}>
                    Number of times to retry downloading failed items before
                    skipping.
                  </p>
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="cookiesSource" className={styles.label}>
                    Cookies Import Source
                  </label>
                  <select
                    id="cookiesSource"
                    value={settings.scraper.cookiesSource}
                    onChange={(e) =>
                      handleScraperChange(
                        "cookiesSource",
                        e.target.value as
                          | "firefox"
                          | "chrome"
                          | "edge"
                          | "safari"
                          | "opera"
                          | "vivaldi"
                          | "none",
                      )
                    }
                    className={styles.select}
                  >
                    <option value="none">None (Public posts only)</option>
                    <option value="firefox">Mozilla Firefox</option>
                    <option value="chrome">Google Chrome</option>
                    <option value="edge">Microsoft Edge</option>
                    <option value="safari">Apple Safari</option>
                    <option value="opera">Opera</option>
                    <option value="vivaldi">Vivaldi</option>
                  </select>
                  <p className={styles.helperText}>
                    Imports browser cookies to scrape account-locked or private
                    media posts safely.
                  </p>
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="proxy" className={styles.label}>
                    Network Proxy URL
                  </label>
                  <input
                    id="proxy"
                    type="text"
                    placeholder="e.g. http://127.0.0.1:7890"
                    value={settings.scraper.proxy}
                    onChange={(e) =>
                      handleScraperChange("proxy", e.target.value)
                    }
                    className={styles.input}
                  />
                  <p className={styles.helperText}>
                    Optional HTTP/HTTPS/SOCKS5 proxy server for scraper
                    requests.
                  </p>
                </div>
              </div>

              <h2 className={styles.sectionTitle}>
                <Sliders size={18} />
                <span>Sleep & Rate-Limit Evasion</span>
              </h2>

              <div className={styles.grid}>
                <div className={styles.formGroup}>
                  <span className={styles.label}>
                    Post Download Sleep Range (Seconds)
                  </span>
                  <div className={styles.rowInputs}>
                    <input
                      id="sleepMin"
                      type="number"
                      min="0"
                      max="3600"
                      placeholder="Min"
                      value={settings.scraper.sleepMin}
                      onChange={(e) =>
                        handleScraperChange(
                          "sleepMin",
                          parseInt(e.target.value, 10) || 0,
                        )
                      }
                      className={styles.input}
                      required
                    />
                    <input
                      id="sleepMax"
                      type="number"
                      min="0"
                      max="3600"
                      placeholder="Max"
                      value={settings.scraper.sleepMax}
                      onChange={(e) =>
                        handleScraperChange(
                          "sleepMax",
                          parseInt(e.target.value, 10) || 0,
                        )
                      }
                      className={styles.input}
                      required
                    />
                  </div>
                  <p className={styles.helperText}>
                    Min and Max seconds to sleep after downloading each file to
                    mimic human actions.
                  </p>
                </div>

                <div className={styles.formGroup}>
                  <span className={styles.label}>
                    Request API Sleep Range (Seconds)
                  </span>
                  <div className={styles.rowInputs}>
                    <input
                      id="sleepRequestMin"
                      type="number"
                      min="0"
                      max="3600"
                      placeholder="Min"
                      value={settings.scraper.sleepRequestMin}
                      onChange={(e) =>
                        handleScraperChange(
                          "sleepRequestMin",
                          parseInt(e.target.value, 10) || 0,
                        )
                      }
                      className={styles.input}
                      required
                    />
                    <input
                      id="sleepRequestMax"
                      type="number"
                      min="0"
                      max="3600"
                      placeholder="Max"
                      value={settings.scraper.sleepRequestMax}
                      onChange={(e) =>
                        handleScraperChange(
                          "sleepRequestMax",
                          parseInt(e.target.value, 10) || 0,
                        )
                      }
                      className={styles.input}
                      required
                    />
                  </div>
                  <p className={styles.helperText}>
                    Min and Max seconds to sleep between API HTTP metadata
                    calls.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className={styles.footer}>
            <button
              type="button"
              onClick={handleResetDefaults}
              className={`${styles.button} ${styles.cancelButton}`}
            >
              <RotateCcw size={16} />
              <span>Reset Defaults</span>
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className={`${styles.button} ${styles.saveButton}`}
            >
              <Save size={16} />
              <span>{isSaving ? "Saving Changes..." : "Save Changes"}</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
