import { ImageCandidate, ImageCandidateRequest } from '@atlas-viewer/iiif-image-api';
export declare function useThumbnail(request: ImageCandidateRequest, dereference?: boolean, { canvasId, manifestId }?: {
    canvasId?: string;
    manifestId?: string;
}): ImageCandidate | undefined;
