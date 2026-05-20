import type { Config } from "drizzle-kit";
import path from "node:path";

const dataDir = process.env.DATA_DIR || process.cwd();

export default {
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: {
    url: path.join(dataDir, "sqlite.db"),
  },
} satisfies Config;
