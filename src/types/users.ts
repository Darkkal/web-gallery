import { type InferSelectModel } from 'drizzle-orm';
import { twitterUsers, pixivUsers } from '@/lib/db/schema';

export type TwitterUser = InferSelectModel<typeof twitterUsers>;
export type PixivUser = InferSelectModel<typeof pixivUsers>;
