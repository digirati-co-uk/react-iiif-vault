import { CanvasNormalized } from '@iiif/presentation-3-normalized';
import { unsupportedStrategy } from './rendering-utils';
import { MediaStrategy } from './strategies';
import { Paintables } from '@iiif/helpers';

export function getAudioStrategy(canvas: CanvasNormalized, paintables: Paintables) {
  if (!canvas.duration) {
    return unsupportedStrategy('No duration on canvas');
  }

  if (paintables.items.length > 1) {
    return unsupportedStrategy('Only one audio source supported');
  }

  const audioResource = paintables.items[0]?.resource as any; // @todo stronger type for what this might be.

  if (!audioResource) {
    return unsupportedStrategy('Unknown audio');
  }

  if (!audioResource.format) {
    return unsupportedStrategy('Audio does not have format');
  }

  return {
    type: 'media',
    media: {
      annotationId: paintables.items[0].annotationId,
      duration: canvas.duration,
      url: audioResource.id,
      type: 'Sound',
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
