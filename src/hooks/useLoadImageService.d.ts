import { ImageService } from '@iiif/presentation-3';
export declare function useLoadImageService(): readonly [(imageService: any | undefined, { height, width }: {
    height: number;
    width: number;
}) => ImageService | undefined, Record<string, string>];
