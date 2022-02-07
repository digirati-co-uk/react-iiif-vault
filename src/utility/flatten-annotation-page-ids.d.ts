import { CanvasNormalized, ManifestNormalized } from '@iiif/presentation-3';
export declare function flattenAnnotationPageIds({ canvas, manifest, all, canvases, }: {
    manifest?: ManifestNormalized;
    canvas?: CanvasNormalized;
    canvases?: CanvasNormalized[];
    all?: boolean;
}): string[];
