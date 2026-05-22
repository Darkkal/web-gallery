export interface AppSettings {
  colorTheme: "dark" | "light" | "system";
  galleryPageSize: number;
  timelinePageSize: number;
  scrollMode: "infinite" | "button";
  scrapeLogRetentionDays: number;
  enableProductionDestructiveOps: boolean;
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
