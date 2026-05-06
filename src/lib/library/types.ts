import type { DbTransaction } from '@/lib/db';

export interface ProcessTask {
    fsPath: string;
    dbFilePath: string;
    jsonPath: string | undefined;
    defaultType: 'image' | 'video' | 'audio' | 'text';
    sourceId: number | null;
}

export type TagCache = Map<string, number>;
export type UserCache = Set<string>;

export interface ProcessorContext {
    tx: DbTransaction;
    existingTwitterUsers: UserCache;
    existingPixivUsers: UserCache;
    existingTags: TagCache;
    existingPosts: Map<string, number>;
    userAvatars: Map<string, string>;
    internalSourceId: number | null;
}
