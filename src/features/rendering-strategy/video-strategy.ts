import { expandTarget, type Paintables, parseSelector, Vault } from '@iiif/helpers';
import type { CanvasNormalized } from '@iiif/presentation-3-normalized';
import type { CompatVault } from '../../utility/compat-vault';
import { unsupportedStrategy } from './rendering-utils';
import type { SingleVideo, SingleYouTubeVideo } from './resource-types';
import type { MediaStrategy, UnknownStrategy } from './strategies';

// https://stackoverflow.com/a/27728417
const ytRegex = /^.*(?:(?:youtu\.be\/|v\/|vi\/|u\/\w\/|embed\/|shorts\/)|(?:(?:watch)?\?vi?=|&vi?=))([^#&?]*).*/;

export function getVideoStrategy(
  canvas: CanvasNormalized,
  paintables: Paintables,
  vault: CompatVault,
  enforceSpatial = false
): UnknownStrategy | MediaStrategy {
  const videoPaintables = paintables.items.filter((t) => t.type === 'video');
  const video = videoPaintables[0];

  let noSpatial = false;
  let noDuration = false;

  if (!canvas.duration) {
    noDuration = true;
  }

  if (videoPaintables.length > 1 || !video) {
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

  const captions: MediaStrategy['captions'] = [];
  const annotationLists = vault.get(canvas.annotations || []);
  for (const annotationList of annotationLists) {
    const annotations = vault.get(annotationList.items || []);
    for (const annotation of annotations) {
      const motivations: any[] = annotation.motivation
        ? Array.isArray(annotation.motivation || '')
          ? annotation.motivation
          : [annotation.motivation]
        : [];
      if (motivations.includes('supplementing')) {
        const bodies = vault.get(annotation.body || []);
        for (const _body of bodies) {
          const body = _body as any;
          if (body.type === 'Choice') {
            for (const _choice of body.items) {
              const choice = vault.get(_choice) as any;
              if ((choice as any).format === 'text/vtt') {
                captions.push({
                  id: (choice as any).id,
                  type: 'Text',
                  format: 'text/vtt',
                  label: (choice as any).label,
                  language: (choice as any).language,
                });
              }
            }
          } else {
            if ((body as any).format === 'text/vtt') {
              captions.push({
                id: (body as any).id,
                type: 'Text',
                format: 'text/vtt',
                label: (body as any).label,
                language: (body as any).language,
              });
            }
          }
        }
      }
    }
  }

  const media: SingleVideo | SingleYouTubeVideo = {
    annotationId: video.annotationId,
    annotation: video.annotation,
    duration: canvas.duration,
    url: videoResource.id,
    type: 'Video',
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

  const target = expandTarget(video.target);
  if (target.selector && target.selector.type === 'TemporalBoxSelector') {
    media.target = target.selector;
  }

  const { selector } = parseSelector(video.selector);
  if (selector === null) {
    // We need to trim.
    const startTime = media.target.temporal.startTime;
    const endTime = media.target.temporal.endTime || canvas.duration;
    const duration = endTime - startTime;
    media.selector = {
      type: 'TemporalSelector',
      temporal: {
        startTime: 0,
        endTime: duration,
      },
    };
  } else if (selector.type === 'TemporalSelector') {
    media.selector = selector;
  }

  if (enforceSpatial && !media.target.spatial) {
    noSpatial = true;
    // If there is no target - put it on the bottom right.
    media.target = {
      type: 'TemporalBoxSelector',
      temporal: media.target.temporal,
      spatial: {
        x: canvas.width / 2,
        y: canvas.height / 2,
        width: canvas.width / 2,
        height: canvas.height / 2,
      },
    };
  }

  if (isYouTube) {
    (media as any).type = 'VideoYouTube';
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
    noSpatial,
    captions,
  } as MediaStrategy;
}
