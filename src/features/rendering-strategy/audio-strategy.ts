import type { Paintables } from '@iiif/helpers';
import type { CanvasNormalized } from '@iiif/presentation-3-normalized';
import { unsupportedStrategy } from './rendering-utils';
import type { MediaStrategy } from './strategies';

export function getAudioStrategy(canvas: CanvasNormalized, paintables: Paintables) {
  const items = paintables.items;
  const audio = items[0];

  if (items.length === 0 || !audio) {
    return unsupportedStrategy('No audio');
  }

  if (!canvas.duration) {
    return unsupportedStrategy('No duration on canvas');
  }

  if (items.length > 1) {
    return unsupportedStrategy('Only one audio source supported');
  }

  const audioResource = audio.resource; // @todo stronger type for what this might be.

  if (!audioResource) {
    return unsupportedStrategy('Unknown audio');
  }

  if (!('format' in audioResource)) {
    // This is too strict, let's default.
    // return unsupportedStrategy('Audio does not have format');
    audioResource.format = 'audio/mpeg';
  }

  return {
    type: 'media',
    media: {
      annotationId: audio.annotationId,
      annotation: audio.annotation,
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
