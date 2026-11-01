import { polygonPath } from './polygon-path';
import type { Point } from 'polygon-editor';
import type { BoxSelector, SupportedSelector, SvgSelector } from '@iiif/helpers';
import type {
  FragmentSelector as W3CFragmentSelector,
  SvgSelector as W3CSvgSelector,
} from '@iiif/parser/presentation-3/types';

export function isSvgSelector(t: SupportedSelector): t is SvgSelector {
  return t.type === 'SvgSelector';
}

export function isBoxSelector(t: SupportedSelector): t is BoxSelector {
  return t.type === 'BoxSelector';
}

export function serialiseSupportedSelector(
  selector: SupportedSelector,
  on?: { width: number; height: number } | null
): null | W3CSvgSelector | W3CFragmentSelector {
  if (isSvgSelector(selector)) {
    if (!selector.points?.length) return null;
    const points = selector.points as Point[];
    const open = selector.svgShape === 'polyline';
    const geometry = points.some((p) => p.length === 6)
      ? `<path d="${polygonPath(points, open)}" />`
      : `<${open ? 'polyline' : 'polygon'} points="${points.map((p) => `${p[0]},${p[1]}`).join(' ')}" />`;
    const dimensions = on ? ` viewBox="0 0 ${on.width} ${on.height}" width="${on.width}" height="${on.height}"` : '';
    return { type: 'SvgSelector', value: `<svg xmlns="http://www.w3.org/2000/svg"${dimensions}>${geometry}</svg>` };
  }

  if (!selector.spatial) {
    return null;
  }

  const { x, y, width, height } = selector.spatial || {};

  if (!width || !height) {
    return null;
  }

  return {
    type: 'FragmentSelector',
    value: `xywh=${~~x},${~~y},${~~width},${~~height}`,
  } satisfies W3CFragmentSelector;
}

/** @deprecated Use serialiseSupportedSelector (corrected spelling). */
export const seraliseSupportedSelector = serialiseSupportedSelector;
