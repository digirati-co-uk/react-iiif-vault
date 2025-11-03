import type { ChoiceDescription } from '@iiif/helpers';
import type { InternationalString } from '@iiif/presentation-3';
import type { Single3DModelStrategy } from './3d-strategy';
import type { SingleImageStrategy } from './image-strategy';
import type {
  AnnotationPageDescription,
  AudioSequence,
  SingleAudio,
  SingleVideo,
  SingleYouTubeVideo,
  VideoSequence,
} from './resource-types';
import type { TextContent, TextualContentStrategy } from './textual-content-strategy';

export type MediaStrategy = {
  type: 'media';
  media: SingleAudio | SingleVideo | AudioSequence | VideoSequence | SingleYouTubeVideo;
  choice?: ChoiceDescription;
  annotations?: AnnotationPageDescription;
  noSpatial?: boolean;
  captions?: Array<{
    id: string;
    type: string;
    format: string;
    label?: InternationalString;
    language?: string;
  }>;
};

export type ComplexTimelineStrategy = {
  type: 'complex-timeline';
  items: Array<SingleImageStrategy['image'] | SingleAudio | SingleVideo | SingleYouTubeVideo | TextContent>;
  keyframes: TimelineKeyframe[];
  duration: number;
  choice?: ChoiceDescription;
  annotations?: AnnotationPageDescription;
  highlights: Array<any>;
};

export interface TimelineKeyframe {
  id: string;
  type: 'enter' | 'exit' | 'change';
  resourceType: 'image' | 'audio' | 'video' | 'text' | 'highlight';
  timeDelta?: number; // Difference from the media and the prime
  isPrime?: boolean; // This is the element to track for a clock, if available
  time: number;
}

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
