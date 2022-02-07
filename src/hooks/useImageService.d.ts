import { ImageService } from '@iiif/presentation-3';
export declare function useImageService(): {
    data: ImageService | undefined;
    isFetching: boolean;
    status: 'error' | 'success' | 'loading';
};
