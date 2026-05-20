export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { initDb } = await import("@/lib/db");
    await initDb();

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
