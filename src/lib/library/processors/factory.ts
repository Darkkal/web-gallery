import { IMetadataProcessor } from './base';
import { TwitterProcessor } from './twitter';
import { PixivProcessor } from './pixiv';
import { GelbooruProcessor } from './gelbooru';

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
