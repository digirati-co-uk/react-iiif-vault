import type { InputShape, Point } from 'polygon-editor';

/** Both cubic control offsets are relative to the segment's starting anchor. */
export function polygonPath(points: Point[], open: boolean): string {
  if (!points.length) return '';
  let path = `M ${points[0][0]} ${points[0][1]}`;
  for (let i = 0; i < (open ? points.length - 1 : points.length); i++) {
    const p = points[i];
    const end = points[(i + 1) % points.length];
    path +=
      p.length === 6
        ? ` C ${p[0] + p[2]} ${p[1] + p[3]} ${p[0] + p[4]} ${p[1] + p[5]} ${end[0]} ${end[1]}`
        : ` L ${end[0]} ${end[1]}`;
  }
  return open ? path : `${path} Z`;
}

/** Read a single absolute M/L/C/Z path, as emitted by polygonPath. Unsupported paths return null. */
export function polygonFromPath(path: string): InputShape | null {
  const tokens = path.match(/[a-zA-Z]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?/g) || [];
  if (path.replace(/[a-zA-Z]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?|[\s,]/g, '')) return null;
  const points: Point[] = [];
  let open = true;
  let i = 0;
  while (i < tokens.length) {
    const command = tokens[i++];
    if (command === 'Z' && points.length) {
      if (i !== tokens.length) return null;
      open = false;
      break;
    }
    const count = command === 'C' ? 6 : command === 'M' || command === 'L' ? 2 : 0;
    if (!count || (command === 'M' ? points.length > 0 : !points.length)) return null;
    const values = tokens.slice(i, i + count).map(Number);
    if (values.length !== count || values.some((v) => !Number.isFinite(v))) return null;
    i += count;
    if (command === 'C') {
      const start = points[points.length - 1];
      points[points.length - 1] = [
        start[0],
        start[1],
        values[0] - start[0],
        values[1] - start[1],
        values[2] - start[0],
        values[3] - start[1],
      ];
      points.push([values[4], values[5]]);
    } else points.push([values[0], values[1]]);
  }
  if (!points.length) return null;
  if (!open && points.length > 1 && points.at(-1)![0] === points[0][0] && points.at(-1)![1] === points[0][1])
    points.pop();
  return { points, open };
}

/** Import the single polygon/polyline/cubic path produced by this editor. No SVG is executed. */
export function polygonFromSvgSelector(selector: { type: 'SvgSelector'; value: string }): InputShape | null {
  const svg = selector.value;
  if (/\btransform\s*=/.test(svg) || /<(?:rect|circle|ellipse|line|use|text|image|foreignObject)\b/.test(svg))
    return null;
  const shapes = [...svg.matchAll(/<(path|polygon|polyline)\b([^>]*)>/g)];
  if (shapes.length !== 1) return null;
  const [, kind, attributes] = shapes[0];
  const attribute = kind === 'path' ? 'd' : 'points';
  const value = attributes.match(new RegExp(`(?:^|\\s)${attribute}\\s*=\\s*(["'])(.*?)\\1`))?.[2];
  if (!value) return null;
  if (kind === 'path') return polygonFromPath(value);
  const numbers = value
    .trim()
    .split(/[\s,]+/)
    .map(Number);
  if (numbers.length < 2 || numbers.length % 2 || numbers.some((n) => !Number.isFinite(n))) return null;
  const points: Point[] = [];
  for (let i = 0; i < numbers.length; i += 2) points.push([numbers[i], numbers[i + 1]]);
  return { points, open: kind === 'polyline' };
}
