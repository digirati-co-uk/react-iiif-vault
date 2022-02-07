import { CollectionNormalized } from '@iiif/presentation-3';
export declare function useCollection(options: {
    id: string;
}): CollectionNormalized | undefined;
export declare function useCollection<T>(options: {
    id: string;
    selector: (collection: CollectionNormalized) => T;
}, deps?: any[]): T | undefined;
