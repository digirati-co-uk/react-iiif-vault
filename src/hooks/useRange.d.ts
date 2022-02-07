import { RangeNormalized } from '@iiif/presentation-3';
export declare function useRange(options?: {
    id: string;
}): RangeNormalized | undefined;
export declare function useRange<T>(options?: {
    id: string;
    selector: (range: RangeNormalized) => T;
}, deps?: any[]): T | undefined;
