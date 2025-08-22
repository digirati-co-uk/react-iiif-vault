import type { BoxSelector, SupportedSelector, SvgSelector } from '@iiif/helpers';
import type { FragmentSelector as W3CFragmentSelector, SvgSelector as W3CSvgSelector } from '@iiif/presentation-3';

export function isSvgSelector(t: SupportedSelector): t is SvgSelector {
  return t.type === 'SvgSelector';
}

export function isBoxSelector(t: SupportedSelector): t is BoxSelector {
  return t.type === 'BoxSelector';
}

export function seraliseSupportedSelector(selector: SupportedSelector, on?: { width: number; height: number }): null | W3CSvgSelector | W3CFragmentSelector {
  if (isSvgSelector(selector)) {
    const notOpen = selector.svgShape === 'polyline';

    if (!selector.points || selector.points.length === 0) {
      return null;
    }

    if (on) {
      const { width, height } = on;
      const el = !notOpen ? 'polyline' : 'polygon';
      return {
        type: 'SvgSelector',
        value: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}"><${el} points="${selector.points.map((p: any) => p.join(',')).join(' ')}" /></svg>`,
      } satisfies W3CSvgSelector;
    }

    return {
      // @todo support colour
      // @todo support other shapes.
      type: 'SvgSelector',
      value: `<svg xmlns='http://www.w3.org/2000/svg' xmlns:xlink='http://www.w3.org/1999/xlink'><g><path d='M${selector.points
        .map((p) => p.join(','))
        .join(' ')}${!notOpen ? '' : ' Z'}' /></g></svg>`,
    } satisfies W3CSvgSelector;
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
    value: `#xywh=${~~x},${~~y},${~~width},${~~height}`,
  } satisfies W3CFragmentSelector;
}
