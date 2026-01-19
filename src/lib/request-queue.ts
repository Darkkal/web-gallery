


type Task = () => Promise<void>;

interface QueueItem {
    task: Task;
    signal?: AbortSignal;
    resolve: () => void;
    reject: (err: any) => void;
}

class RequestQueue {
    private queue: QueueItem[] = [];
    private interval: NodeJS.Timeout | null = null;
    private rateLimitDelay = 200; // 5 per second = 200ms

    constructor() {
        this.process();
    }

    async enqueue(task: Task, signal?: AbortSignal): Promise<void> {
        if (signal?.aborted) return Promise.reject(new Error('Aborted'));

        return new Promise((resolve, reject) => {
            const item: QueueItem = { task, signal, resolve, reject };

            if (signal) {
                signal.addEventListener('abort', () => {
                    this.removeItem(item);
                    reject(new Error('Aborted'));
                });
            }

            this.queue.push(item);
        });
    }

    private removeItem(item: QueueItem) {
        const index = this.queue.indexOf(item);
        if (index > -1) {
            this.queue.splice(index, 1);
        }
    }

    private process() {
        // Run loop
        // We use setInterval designed to fire every X ms
        // This ensures rate limiting of STARTS

        // Clear existing if any (hot reload safety)
        if (this.interval) clearInterval(this.interval);

        this.interval = setInterval(() => {
            if (this.queue.length === 0) return;

            const item = this.queue.shift();
            if (!item) return;

            if (item.signal?.aborted) {
                item.reject(new Error('Aborted'));
                return;
            }

            // Execute (fire and forget from queue perspective, but resolve promise)
            item.task()
                .then(item.resolve)
                .catch(item.reject);

        }, this.rateLimitDelay);
    }
}

// Global Singleton pattern to survive HMR
const globalForQueue = globalThis as unknown as { avatarRequestQueue: RequestQueue };

export const avatarRequestQueue = globalForQueue.avatarRequestQueue || new RequestQueue();

if (process.env.NODE_ENV !== 'production') globalForQueue.avatarRequestQueue = avatarRequestQueue;
