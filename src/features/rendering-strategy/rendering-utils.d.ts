import { AnnotationNormalized, ContentResource, IIIFExternalWebResource, SpecificResource } from '@iiif/presentation-3';
import { Vault } from '@iiif/vault';
export declare function parseSpecificResource(resource: ContentResource): any[];
export declare function getPaintables(vault: Vault, paintingAnnotations: AnnotationNormalized[]): {
    types: string[];
    items: {
        type: string;
        resource: IIIFExternalWebResource | SpecificResource;
        target: any;
        selector: any;
    }[];
};
