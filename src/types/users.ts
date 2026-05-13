import type { InferSelectModel } from "drizzle-orm";
import type { pixivUsers, twitterUsers } from "@/lib/db/schema";

export type TwitterUser = InferSelectModel<typeof twitterUsers>;
export type PixivUser = InferSelectModel<typeof pixivUsers>;
