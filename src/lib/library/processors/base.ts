import { ProcessTask, ProcessorContext } from '@/lib/library/types';

export interface IMetadataProcessor<TMeta = Record<string, unknown>> {
    // Returns the created or found postId
    process(meta: TMeta, task: ProcessTask, context: ProcessorContext): Promise<number | null>;
}
