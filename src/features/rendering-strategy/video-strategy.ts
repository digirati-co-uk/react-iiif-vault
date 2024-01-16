import { CanvasNormalized } from '@iiif/presentation-3-normalized';
import { unsupportedStrategy } from './rendering-utils';
import { MediaStrategy } from './strategies';
import { Paintables } from '@iiif/helpers';

// https://stackoverflow.com/a/27728417
const ytRegex = /^.*(?:(?:youtu\.be\/|v\/|vi\/|u\/\w\/|embed\/|shorts\/)|(?:(?:watch)?\?vi?=|&vi?=))([^#&?]*).*/;

export function getVideoStrategy(canvas: CanvasNormalized, paintables: Paintables) {
  const videoPaintables = paintables.items.filter((t) => t.type === 'video');

  if (!canvas.duration) {
    return unsupportedStrategy('No duration on canvas');
  }

  if (videoPaintables.length > 1) {
    return unsupportedStrategy('Only one video source supported');
  }

  const audioResource = videoPaintables[0]?.resource as any; // @todo stronger type for what this might be.
  const isYouTube = !!(audioResource.service || []).find((service: any) =>
    (service.profile || '').includes('youtube.com')
  );

  if (!audioResource) {
    return unsupportedStrategy('Unknown video');
  }

  if (!audioResource.format || audioResource.format === 'text/html') {
    if (!isYouTube) {
      return unsupportedStrategy('Video does not have format');
    }
  }

  const media = {
    annotationId: (paintables.items[0] as any).annotationId,
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
  };

  if (isYouTube) {
    media.type = 'VideoYouTube';
    const id = audioResource.id.match(ytRegex);
    if (!id[1]) {
      return unsupportedStrategy('Video is not known youtube video');
    }
    (media as any).youTubeId = id[1];
  }

  // @todo support VTT

  return {
    type: 'media',
    media,
    annotations: {
      pages: [],
    },
  } as MediaStrategy;
}
