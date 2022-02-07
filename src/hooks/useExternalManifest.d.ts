import { QueryOptions } from 'react-query';
import { ManifestNormalized } from '@iiif/presentation-3';
export declare const useExternalManifest: (id: string, config?: QueryOptions<ManifestNormalized>) => {
    id: string;
    isLoaded: boolean;
    error: any;
    manifest?: ManifestNormalized | undefined;
};
