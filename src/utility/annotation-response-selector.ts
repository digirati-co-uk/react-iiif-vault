import type { BoxSelector, SupportedSelector, SvgSelector } from '@iiif/helpers';
import { polygonToTarget, type AnnotationResponse } from '../canvas-panel/context/atlas-store';
import { isRectangle } from './is-rectangle';
import invariant from 'tiny-invariant';

export function annotationResponseToSelector(response: AnnotationResponse): SupportedSelector {
  if (response.polygon && !isRectangle(response.polygon.points)) {
    const target = response.target || polygonToTarget(response.polygon);
    invariant(target?.type === 'SvgSelector');

    return {
      type: 'SvgSelector',
      points: response.polygon.points as any,
      // open: response.polygon.open, @todo support in parser.
      spatial: { unit: 'pixel', ...(response.boundingBox || ({} as any))! },
      svgShape: response.polygon.open ? 'polyline' : 'polygon',
      svg: (target as any).value,
    } satisfies SvgSelector;
  }

  return {
    type: 'BoxSelector',
    spatial: response.boundingBox!,
  } satisfies BoxSelector;
}
