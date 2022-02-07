import { QueryOptions } from 'react-query';
import { CollectionNormalized } from '@iiif/presentation-3';
export declare const useExternalCollection: (id: string, config?: QueryOptions<CollectionNormalized>) => {
    id: string;
    isLoaded: boolean;
    collection?: CollectionNormalized | undefined;
};
