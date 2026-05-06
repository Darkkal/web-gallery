import { IMetadataProcessor } from '@/lib/library/processors/base';
import { TwitterProcessor } from '@/lib/library/processors/twitter';
import { PixivProcessor } from '@/lib/library/processors/pixiv';
import { GelbooruProcessor } from '@/lib/library/processors/gelbooru';

export class MetadataProcessorFactory {
    static getProcessor(extractorType: string): IMetadataProcessor | null {
        switch (extractorType) {
            case 'twitter':
                return new TwitterProcessor();
            case 'pixiv':
                return new PixivProcessor();
            case 'gelbooruv02':
                return new GelbooruProcessor();
            default:
                return null;
        }
    }
}
