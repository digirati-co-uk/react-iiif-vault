import type { InputShape } from 'polygon-editor';

/** Four distinct corners connected by axis-aligned edges; curves are never rectangles. */
export function isRectangle(input: InputShape['points']) {
  const points =
    input.length === 5 && input[0][0] === input[4][0] && input[0][1] === input[4][1] ? input.slice(0, 4) : input;
  if (input.some((p) => p.length !== 2 || p.some((n) => !Number.isFinite(n))) || points.length !== 4) return false;
  if (new Set(points.map((p) => `${p[0]},${p[1]}`)).size !== 4) return false;
  return points.every((p, i) => {
    const next = points[(i + 1) % 4];
    const previous = points[(i + 3) % 4];
    return (p[0] === next[0] && p[1] === previous[1]) || (p[1] === next[1] && p[0] === previous[0]);
  });
}
