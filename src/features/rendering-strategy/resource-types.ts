import { ImageService } from '@iiif/presentation-3';
import { AnnotationPageNormalized } from '@iiif/presentation-3-normalized';
import { BoxSelector, TemporalBoxSelector, TemporalSelector } from '@iiif/vault-helpers/annotation-targets';

export type ImageWithOptionalService = {
  id: string;
  annotationId: string;
  type: 'Image';
  service?: ImageService;
  width?: number;
  height?: number;
  sizes?: Array<{
    width: number;
    height: number;
  }>;
  target: BoxSelector | TemporalBoxSelector;
  selector?: BoxSelector;
};

export type SingleAudio = {
  type: 'Sound';
  annotationId: string;
  url: string;
  format: string;
  duration: number;
  target: TemporalSelector;
  /**
   * Which part of this audio should be used (cropping).
   */
  selector: TemporalSelector;
};

export type SingleYouTubeVideo = {
  type: 'VideoYouTube';
  annotationId: string;
  url: string;
  youTubeId: string;
  duration: number;
  target: TemporalSelector | TemporalBoxSelector;
  selector: TemporalSelector | TemporalBoxSelector;
};

export type SingleVideo = {
  type: 'Video';
  annotationId: string;
  url: string;
  format: string;
  duration: number;
  /**
   * Where on the canvas should this section of video be painted.
   */
  target: TemporalSelector | TemporalBoxSelector;

  /**
   * Which part of this video should be painted.
   */
  selector: TemporalSelector | TemporalBoxSelector;
};

export type AudioSequence = {
  type: 'SoundSequence';
  items: SingleAudio[];
};

export type VideoSequence = {
  type: 'VideoSequence';
  items: SingleVideo[];
};

// Similar to an annotation page itself, but virtual.
export type AnnotationPageDescription = {
  pages: AnnotationPageNormalized[];
};
