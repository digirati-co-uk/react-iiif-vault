import { CanvasNormalized } from '@iiif/presentation-3';
export declare function useCanvas(options?: {
    id: string;
}): CanvasNormalized | undefined;
export declare function useCanvas<T>(options?: {
    id: string;
    selector: (canvas: CanvasNormalized) => T;
}, deps?: any[]): T | undefined;
