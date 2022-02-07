import { ImageService } from '@iiif/presentation-3';
export declare function useImageTile(): {
    isLoading: boolean;
    tile: {
        id: string | undefined;
        width: number | null | undefined;
        height: number | null | undefined;
        imageService: ImageService;
        thumbnail: undefined;
    } | null;
};
