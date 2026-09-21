import type { Paintables } from '@iiif/helpers';
import type { CompatibleCanvas } from '../../utility/canvas-compat';
import { getMediaTemporalSelectors, unsupportedStrategy } from './rendering-utils';
import type { MediaStrategy } from './strategies';

export function getAudioStrategy(canvas: CompatibleCanvas, paintables: Paintables) {
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

  const { target, source } = getMediaTemporalSelectors(canvas, audio);

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
        temporal: target,
      },
      format:
        ('format' in audioResource && typeof audioResource.format === 'string' ? audioResource.format : undefined) ||
        'audio/mpeg',
      selector: {
        type: 'TemporalSelector',
        temporal: source,
      },
    },
    annotations: {
      pages: [],
    },
  } as MediaStrategy;
}
