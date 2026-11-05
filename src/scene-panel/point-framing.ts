import type { SceneBounds } from './types';

/** Give a degenerate point a scale from its model, keeping the world-space anchor. */
export function pointFramingBounds(point: SceneBounds, context: SceneBounds | null): SceneBounds {
  const extent = Math.hypot(...point.max.map((v, i) => v - point.min[i]));
  const contextExtent = context ? Math.hypot(...context.max.map((v, i) => v - context.min[i])) : 0;
  if (extent > Math.max(contextExtent * 1e-6, 1e-9)) return point;
  const radius = contextExtent > 0 && Number.isFinite(contextExtent) ? contextExtent / 4 : 0.5;
  return {
    center: [...point.center],
    min: point.center.map((v) => v - radius) as [number, number, number],
    max: point.center.map((v) => v + radius) as [number, number, number],
  };
}
