export interface AppSettings {
  colorTheme: "dark" | "light" | "system";
  galleryPageSize: number;
  timelinePageSize: number;
  scrollMode: "infinite" | "button";
  scrapeLogRetentionDays: number;
  enableProductionDestructiveOps: boolean;
  loopVideos: boolean;
  condensePostText: boolean;
  condensePostLines: number;
  autoplayVideos: boolean;
  muteAutoplayVideos: boolean;
  infiniteScrollBuffer: number;
  computeStorageStatistics: boolean;
  statisticsRankingLimit: number;
  implicitHierarchyFiltering: boolean;
  lightboxFitMode: "fitBoth" | "fitWidth" | "fitHeight";
  lightboxZoomMin: number;
  lightboxZoomMax: number;
  lightboxZoomStep: number;
  lightboxAutoHideControls: boolean;
  lightboxAutoHideDelay: number;
}

export interface ScraperSettings {
  rateLimit: string; // e.g. "5M"
  retries: number;
  proxy: string;
  cookiesSource:
    | "firefox"
    | "chrome"
    | "edge"
    | "safari"
    | "opera"
    | "vivaldi"
    | "none";
  sleepMin: number;
  sleepMax: number;
  sleepRequestMin: number;
  sleepRequestMax: number;
}

export interface SystemSettings {
  app: AppSettings;
  scraper: ScraperSettings;
}

export const DEFAULT_SETTINGS: SystemSettings = {
  app: {
    colorTheme: "dark",
    galleryPageSize: 50,
    timelinePageSize: 20,
    scrollMode: "infinite",
    scrapeLogRetentionDays: 30,
    enableProductionDestructiveOps: false,
    loopVideos: true,
    condensePostText: true,
    condensePostLines: 2,
    autoplayVideos: false,
    muteAutoplayVideos: true,
    infiniteScrollBuffer: 300,
    computeStorageStatistics: true,
    statisticsRankingLimit: 10,
    implicitHierarchyFiltering: true,
    lightboxFitMode: "fitBoth",
    lightboxZoomMin: 50,
    lightboxZoomMax: 200,
    lightboxZoomStep: 25,
    lightboxAutoHideControls: false,
    lightboxAutoHideDelay: 3,
  },
  scraper: {
    rateLimit: "5M",
    retries: 3,
    proxy: "",
    cookiesSource: "firefox",
    sleepMin: 5,
    sleepMax: 10,
    sleepRequestMin: 5,
    sleepRequestMax: 10,
  },
};
