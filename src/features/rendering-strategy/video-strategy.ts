import { CanvasNormalized } from '@iiif/presentation-3-normalized';
import { unsupportedStrategy } from './rendering-utils';
import { MediaStrategy } from './strategies';
import { Paintables } from '@iiif/helpers';

// https://stackoverflow.com/a/27728417
const ytRegex = /^.*(?:(?:youtu\.be\/|v\/|vi\/|u\/\w\/|embed\/|shorts\/)|(?:(?:watch)?\?vi?=|&vi?=))([^#&?]*).*/;

export function getVideoStrategy(canvas: CanvasNormalized, paintables: Paintables) {
  const videoPaintables = paintables.items.filter((t) => t.type === 'video');

  let noDuration = false;

  if (!canvas.duration) {
    noDuration = true;
  }

  if (videoPaintables.length > 1) {
    return unsupportedStrategy('Only one video source supported');
  }

  const videoResource = videoPaintables[0]?.resource as any; // @todo stronger type for what this might be.
  const isYouTube = !!(videoResource.service || []).find((service: any) =>
    (service.profile || '').includes('youtube.com')
  );

  if (!isYouTube && noDuration) {
    return unsupportedStrategy('Video does not have duration');
  }

  if (!videoResource) {
    return unsupportedStrategy('Unknown video');
  }

  if (!videoResource.format || videoResource.format === 'text/html') {
    if (!isYouTube) {
      return unsupportedStrategy('Video does not have format');
    }
  }

  const media = {
    annotationId: (paintables.items[0] as any).annotationId,
    duration: canvas.duration,
    url: videoResource.id,
    type: 'Video',
    items: [],
    target: {
      type: 'TemporalSelector',
      temporal: {
        startTime: 0,
        endTime: canvas.duration,
      },
    },
    format: videoResource.format,
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
    const id = videoResource.id.match(ytRegex);
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
