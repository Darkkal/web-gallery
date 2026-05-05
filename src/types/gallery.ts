export interface MediaItem {
    id: number;
    filePath: string;
    mediaType: 'image' | 'video' | 'audio' | 'text';
    capturedAt: Date | null;
    createdAt: Date;
    postId: number | null;
}

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

export interface GalleryRow {
    item: MediaItem;
    post?: Post;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    twitter?: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    pixiv?: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    gelbooru?: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    user?: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    pixivUser?: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    source?: any;
}

export interface GalleryGroup extends GalleryRow {
    groupItems: GalleryRow[];
    groupCount: number;
}
