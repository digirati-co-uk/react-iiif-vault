import { ContentResource, PointSelector, W3CAnnotationTarget } from '@iiif/presentation-3';
import { CanvasNormalized } from '@iiif/presentation-3-normalized';
import { UseRenderingStrategy } from '../../hooks/useRenderingStrategy';
import { BoxSelector, expandTarget, SupportedTarget, TemporalBoxSelector } from '@iiif/helpers';
import { UnknownStrategy } from './strategies';

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

export function getParsedTargetSelector(
  canvas: CanvasNormalized,
  target: W3CAnnotationTarget | W3CAnnotationTarget[]
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
