import { ManifestNormalized } from '@iiif/presentation-3';
export declare function useManifest(options?: {
    id: string;
}): ManifestNormalized | undefined;
export declare function useManifest<T>(options?: {
    id: string;
    selector: (manifest: ManifestNormalized) => T;
}, deps?: any[]): T | undefined;
