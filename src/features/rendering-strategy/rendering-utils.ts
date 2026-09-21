import type { ContentResource as ContentResource3, PointSelector } from '@iiif/parser/presentation-3/types';
import type { ContentResource as ContentResource4 } from '@iiif/parser/presentation-4/types';
import { UseRenderingStrategy } from '../../hooks/useRenderingStrategy';
import {
  BoxSelector,
  expandTarget,
  parseSelector,
  SupportedTarget,
  TemporalBoxSelector,
  type Paintables,
} from '@iiif/helpers';
import type { CompatibleCanvas } from '../../utility/canvas-compat';
import { UnknownStrategy } from './strategies';

type ContentResource = ContentResource3 | ContentResource4;

/**
 * Parse specific resource.
 *
 * This could be expanded to support pulling out more from the specific resource.
 *
 * @param resource
 */
export function parseSpecificResource(resource: ContentResource) {
  if (resource.type === 'SpecificResource') {
    return [resource.source, { selector: resource.selector }];
  }

  return [resource, { selector: null }];
}

/** Keep canvas placement and source cropping separate for both audio and video. */
export function getMediaTemporalSelectors(canvas: CompatibleCanvas, item: Paintables['items'][number]) {
  const target = expandTarget(item.target).selector?.temporal;
  const source = parseSelector(item.selector).selector?.temporal;
  const duration = canvas.duration || 0;
  const startTime = target?.startTime ?? 0;
  const sourceStart = source?.startTime ?? 0;
  const resourceDuration =
    'duration' in item.resource && typeof item.resource.duration === 'number' ? item.resource.duration : undefined;
  const sourceEnd = source?.endTime ?? resourceDuration;
  // A start-only target plays the available source, bounded by the canvas duration.
  const endTime =
    target?.endTime ??
    (target && sourceEnd !== undefined && Number.isFinite(sourceEnd)
      ? Math.min(duration, startTime + Math.max(0, sourceEnd - sourceStart))
      : duration);
  return {
    target: { startTime, endTime },
    source: source || { startTime: 0, endTime: endTime - startTime },
  };
}

export function getParsedTargetSelector(
  canvas: CompatibleCanvas,
  target: Parameters<typeof expandTarget>[0]
): [TemporalBoxSelector | BoxSelector | PointSelector | null, SupportedTarget['source']] {
  const { selector: imageTarget, source } = expandTarget(target);

  if (source.id !== canvas.id) {
    // Skip invalid targets.
    return [null, source];
  }

  // Target is where it should be painted.
  const defaultTarget: BoxSelector = {
    type: 'BoxSelector',
    spatial: {
      x: 0,
      y: 0,
      width: Number(canvas.width),
      height: Number(canvas.height),
    },
  };

  return [
    imageTarget
      ? imageTarget.type === 'TemporalSelector'
        ? ({
            type: 'TemporalBoxSelector',
            temporal: imageTarget.temporal,
            spatial: defaultTarget.spatial,
          } as any)
        : imageTarget
      : null,
    source,
  ];
}

export const emptyActions = {
  makeChoice: () => {
    // no-op
  },
};

export const unknownResponse: UseRenderingStrategy[0] = { type: 'unknown' };

export const unsupportedStrategy = (reason: string): UnknownStrategy => {
  return { type: 'unknown', reason, annotations: { pages: [] } };
};

export const emptyStrategy = (width: number, height: number): UseRenderingStrategy[0] => {
  return { type: 'empty', width, height, annotations: { pages: [] }, image: null, images: [] };
};
