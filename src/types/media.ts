export interface MediaItem {
    id: number;
    filePath: string;
    mediaType: 'image' | 'video' | 'audio' | 'text';
    capturedAt: Date | null;
    createdAt: Date;
    postId: number | null;
}

export interface GalleryRow {
    item: MediaItem;
    post?: import('./posts').Post;
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
