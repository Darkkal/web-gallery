export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { initDb } = await import("@/lib/db");
    await initDb();

    // Clean up any scan records left as "running" from a previous crash/restart.
    // This uses the DB as source of truth since in-memory state is lost on restart.
    try {
      const { cleanupStaleScans } = await import("@/lib/library/scanner");
      await cleanupStaleScans();
    } catch {
      // Scanner module may not be available during build
    }

    // Clean up old scrape logs based on user retention policy
    try {
      const { cleanupOldScrapeLogs } = await import("@/lib/settings");
      await cleanupOldScrapeLogs();
    } catch (e) {
      console.error("[Startup] Failed to cleanup old scrape logs:", e);
    }

    // Initialize the scraping task scheduler
    try {
      const { taskScheduler } = await import("@/lib/scheduler/scheduler");
      await taskScheduler.init();
    } catch (e) {
      console.error("[Startup] Failed to initialize task scheduler:", e);
    }

    // Process-level error handlers to ensure unexpected terminations
    // are logged with stack traces instead of dying silently.
    process.on("uncaughtException", (error) => {
      console.error("[FATAL] Uncaught exception:", error);
      // Give stdout time to flush before the default handler terminates the process.
      setTimeout(() => process.exit(1), 100);
    });

    process.on("unhandledRejection", (reason) => {
      console.error("[FATAL] Unhandled promise rejection:", reason);
      setTimeout(() => process.exit(1), 100);
    });

    process.on("exit", (code) => {
      if (code !== 0) {
        console.error(`[PROCESS] Exiting with code ${code}`);
      }
    });
  }
}
