import { CanvasNormalized } from '@iiif/presentation-3';
import { Paintables, unsupportedStrategy } from './rendering-utils';
import { MediaStrategy } from './strategies';
import { SingleVideo } from './resource-types';

export function getVideoStrategy(canvas: CanvasNormalized, paintables: Paintables) {
  const videoPaintables = paintables.items.filter((t) => t.type === 'video');

  if (!canvas.duration) {
    return unsupportedStrategy('No duration on canvas');
  }

  if (videoPaintables.length > 1) {
    return unsupportedStrategy('Only one video source supported');
  }

  const audioResource = videoPaintables[0]?.resource as any; // @todo stronger type for what this might be.

  if (!audioResource) {
    return unsupportedStrategy('Unknown video');
  }

  if (!audioResource.format) {
    return unsupportedStrategy('Video does not have format');
  }

  // @todo support VTT

  return {
    type: 'media',
    media: {
      duration: canvas.duration,
      url: audioResource.id,
      type: 'Video',
      items: [],
      target: {
        type: 'TemporalSelector',
        temporal: {
          startTime: 0,
          endTime: canvas.duration,
        },
      },
      format: audioResource.format,
      selector: {
        type: 'TemporalSelector',
        temporal: {
          startTime: 0,
          endTime: canvas.duration,
        },
      },
    },
    annotations: {
      pages: [],
    },
  } as MediaStrategy;
}
