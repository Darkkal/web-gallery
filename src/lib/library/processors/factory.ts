import type { IMetadataProcessor } from "@/lib/library/processors/base";
import { GelbooruProcessor } from "@/lib/library/processors/gelbooru";
import { PixivProcessor } from "@/lib/library/processors/pixiv";
import { TwitterProcessor } from "@/lib/library/processors/twitter";

export const MetadataProcessorFactory = {
  getProcessor(extractorType: string): IMetadataProcessor | null {
    switch (extractorType) {
      case "twitter":
        return new TwitterProcessor();
      case "pixiv":
        return new PixivProcessor();
      case "gelbooruv02":
        return new GelbooruProcessor();
      default:
        return null;
    }
  },
};
