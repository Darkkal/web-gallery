import { ProcessTask, ProcessorContext } from '@/lib/library/types';

export interface IMetadataProcessor {
    // Returns the created or found postId
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    process(meta: any, task: ProcessTask, context: ProcessorContext): number | null;
}
