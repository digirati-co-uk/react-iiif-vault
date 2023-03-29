import { ChoiceDescription } from '@iiif/vault-helpers';
import {
  AnnotationPageDescription,
  AudioSequence,
  ImageWithOptionalService,
  SingleAudio,
  SingleVideo,
  SingleYouTubeVideo,
  VideoSequence,
} from './resource-types';
import { SingleImageStrategy } from './image-strategy';
import { Single3DModelStrategy } from './3d-strategy';
import { TextualContentStrategy } from './textual-content-strategy';

export type MediaStrategy = {
  type: 'media';
  media: SingleAudio | SingleVideo | AudioSequence | VideoSequence | SingleYouTubeVideo;
  choice?: ChoiceDescription;
  annotations?: AnnotationPageDescription;
};

export type ComplexTimelineStrategy = {
  type: 'complex-timeline';
  items: Array<ImageWithOptionalService | SingleAudio | SingleVideo>;
  choice?: ChoiceDescription;
  annotations?: AnnotationPageDescription;
};

export type EmptyStrategy = {
  type: 'empty';
  image: null;
  images: [];
  height: number;
  width: number;
  annotations?: AnnotationPageDescription;
};

export type UnknownStrategy = {
  type: 'unknown';
  reason?: string;
  annotations?: AnnotationPageDescription;
};

export type RenderingStrategy =
  | SingleImageStrategy
  | MediaStrategy
  | ComplexTimelineStrategy
  | Single3DModelStrategy
  | TextualContentStrategy
  | UnknownStrategy
  | EmptyStrategy;
