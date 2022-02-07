import { AnnotationNormalized } from '@iiif/presentation-3';
export declare function useAnnotation(options?: {
    id: string;
}): AnnotationNormalized | undefined;
export declare function useAnnotation<T>(options?: {
    id: string;
    selector: (annotation: AnnotationNormalized) => T;
}, deps?: any[]): T | undefined;
