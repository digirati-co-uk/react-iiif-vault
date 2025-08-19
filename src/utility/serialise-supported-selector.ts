import type { BoxSelector, SupportedSelector, SvgSelector } from '@iiif/helpers';

export function isSvgSelector(t: SupportedSelector): t is SvgSelector {
  return t.type === 'SvgSelector';
}

export function isBoxSelector(t: SupportedSelector): t is BoxSelector {
  return t.type === 'BoxSelector';
}

export function seraliseSupportedSelector(selector: SupportedSelector) {
  if (isSvgSelector(selector)) {
    const notOpen = selector.svgShape === 'polyline';

    if (!selector.points || selector.points.length === 0) {
      return null;
    }

    return {
      // @todo support colour
      // @todo support other shapes.
      type: 'SvgSelector',
      value: `<svg xmlns='http://www.w3.org/2000/svg' xmlns:xlink='http://www.w3.org/1999/xlink'><g><path d='M${selector.points
        .map((p) => p.join(','))
        .join(' ')}${!notOpen ? '' : ' Z'}' /></g></svg>`,
    };
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
  };
}
