import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { paths } from "@/lib/config";
import type { BaseScraperStrategy } from "@/lib/scrapers/strategies/base";
import { GalleryDlStrategy } from "@/lib/scrapers/strategies/gallery-dl";
import { YtDlpStrategy } from "@/lib/scrapers/strategies/yt-dlp";
import type { ScrapeResult, ScraperOptions } from "@/lib/scrapers/types";

export interface ScrapeLimits {
  stopAfterCompleted?: number;
  stopAfterSkipped?: number;
  stopAfterPosts?: number;
}

// biome-ignore lint/suspicious/noExplicitAny: Deep merge requires handling untyped JSON structures
function deepMerge(target: any, source: any): any {
  if (
    target &&
    typeof target === "object" &&
    source &&
    typeof source === "object"
  ) {
    if (Array.isArray(source)) {
      return source;
    }
    const result = { ...target };
    for (const key of Object.keys(source)) {
      if (key in target) {
        result[key] = deepMerge(target[key], source[key]);
      } else {
        result[key] = source[key];
      }
    }
    return result;
  }
  return source !== undefined ? source : target;
}

export class ScraperRunner {
  private basePath: string;

  constructor(basePath: string) {
    this.basePath = basePath;
    if (!fs.existsSync(basePath)) {
      fs.mkdirSync(basePath, { recursive: true });
    }
    this.ensureConfig();
  }

  private ensureConfig() {
    const scraperDataDir = paths.galleryDl.root;
    const configPath = paths.galleryDl.config;
    const logsDir = paths.galleryDl.logs;
    const archivesDir = paths.galleryDl.archives;

    // Ensure directories exist
    [scraperDataDir, logsDir, archivesDir].forEach((dir) => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });

    const defaultConfigPath = path.join(
      process.cwd(),
      "gallery-dl-default.conf",
    );

    let resolvedDefaultConfigPath = defaultConfigPath;
    if (!fs.existsSync(defaultConfigPath)) {
      const pathsToTry = [
        path.join(__dirname, "..", "..", "..", "gallery-dl-default.conf"),
        path.join(__dirname, "..", "..", "..", "..", "gallery-dl-default.conf"),
        path.join(
          __dirname,
          "..",
          "..",
          "..",
          "..",
          "..",
          "gallery-dl-default.conf",
        ),
        "/snapshot/web-gallery/gallery-dl-default.conf",
        "/snapshot/web-gallery/.next/standalone/gallery-dl-default.conf",
      ];
      for (const p of pathsToTry) {
        if (fs.existsSync(p)) {
          resolvedDefaultConfigPath = p;
          break;
        }
      }
    }

    let defaultConfigJson: Record<string, unknown> = {};
    if (fs.existsSync(resolvedDefaultConfigPath)) {
      try {
        defaultConfigJson = JSON.parse(
          fs.readFileSync(resolvedDefaultConfigPath, "utf-8"),
        );
      } catch {}
    }

    let existingConfigJson: Record<string, unknown> = {};
    if (fs.existsSync(configPath)) {
      try {
        existingConfigJson = JSON.parse(fs.readFileSync(configPath, "utf-8"));
      } catch {}
    }

    // Merge existing config on top of the default template config
    const configJson = deepMerge(defaultConfigJson, existingConfigJson);

    // Write updated config
    fs.writeFileSync(configPath, JSON.stringify(configJson, null, 4), "utf-8");
  }

  run(
    tool: "gallery-dl" | "yt-dlp",
    options: ScraperOptions,
    limits?: ScrapeLimits,
  ): {
    promise: Promise<ScrapeResult>;
    child: import("child_process").ChildProcess;
    strategy: BaseScraperStrategy;
  } {
    let strategy: BaseScraperStrategy;

    if (tool === "yt-dlp") {
      strategy = new YtDlpStrategy(this.basePath, options, limits);
    } else {
      strategy = new GalleryDlStrategy(this.basePath, options, limits);
    }

    const args = strategy.buildArgs();
    console.log(`Starting ${tool} with args:`, args);

    const getCommandPath = (command: string): string => {
      const localBin = path.join(
        process.cwd(),
        "bin",
        process.platform === "win32" ? `${command}.exe` : command,
      );
      return fs.existsSync(localBin) ? localBin : command;
    };

    const cmdPath = getCommandPath(tool);
    const child = spawn(cmdPath, args, {
      shell: false,
      cwd: process.cwd(),
    });

    const promise = new Promise<ScrapeResult>((resolve) => {
      child.stdout?.on("data", (data: Buffer) => {
        const text = data.toString();
        text.split("\n").forEach((line: string) => {
          if (!line.trim()) return;

          if (
            !line.startsWith("[progress]") &&
            !line.startsWith("[download]")
          ) {
            strategy.stdout += `${line}\n`;
          }

          strategy.parseLine(line, child);
        });
      });

      child.stderr?.on("data", (data: Buffer) => {
        const text = data.toString();
        text.split("\n").forEach((line: string) => {
          if (!line.trim()) return;

          if (
            !line.startsWith("[progress]") &&
            !line.startsWith("[download]")
          ) {
            strategy.stderr += `${line}\n`;
          }

          if (line.includes("[error]") || line.includes("ERROR:")) {
            console.error(`[ScraperRunner] ${tool} Error:`, line.trim());
          }

          strategy.parseLine(line, child);
        });
      });

      child.on("close", (code) => {
        if (code === 0 || strategy.intentionalStop) {
          resolve(strategy.getFinalResult(true));
        } else if (code === null) {
          resolve(strategy.getFinalResult(false, "Process was terminated"));
        } else {
          resolve(strategy.getFinalResult(false, strategy.stderr));
        }
      });
    });

    return { promise, child, strategy };
  }
}
