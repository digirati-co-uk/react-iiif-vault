import { AnnotationPage, ImageService } from '@iiif/presentation-3';
import { BoxSelector, TemporalBoxSelector, TemporalSelector } from './selector-extensions';
export declare type ImageWithOptionalService = {
    id: string;
    type: 'Image';
    service?: ImageService;
    width?: number;
    height?: number;
    sizes?: Array<{
        width: number;
        height: number;
    }>;
    target: BoxSelector | TemporalBoxSelector;
    selector: BoxSelector;
};
export declare type SingleAudio = {
    type: 'Sound';
    url: string;
    format: string;
    duration: number;
    target: TemporalSelector;
    selector: TemporalSelector;
};
export declare type SingleVideo = {
    type: 'Video';
    url: string;
    format: string;
    duration: number;
    target: TemporalBoxSelector;
    selector: TemporalBoxSelector;
};
export declare type AudioSequence = {
    type: 'SoundSequence';
    items: SingleAudio[];
};
export declare type VideoSequence = {
    type: 'VideoSequence';
    items: SingleVideo[];
};
export declare type AnnotationPageDescription = {
    pages: AnnotationPage[];
};
