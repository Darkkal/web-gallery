export interface Post {
    id: number;
    extractorType: string;
    jsonSourceId: string | null;
    internalSourceId: number | null;
    userId: string | null;
    date: string | null;
    title: string | null;
    content: string | null;
    url: string | null;
    metadataPath: string | null;
    createdAt: Date;
}

export type { TimelinePost } from '@/lib/db/repositories/posts';
