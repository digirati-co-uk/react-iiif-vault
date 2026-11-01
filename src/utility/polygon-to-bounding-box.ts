import type { InputShape } from 'polygon-editor';

/** Include cubic extrema, including curves extending beyond their anchors. */
export function polygonToBoundingBox(polygon: InputShape | null) {
  if (!polygon?.points.length) return null;
  const positions = polygon.points.map((p) => [p[0], p[1]]);
  const points = polygon.points;
  for (let i = 0; i < (polygon.open ? points.length - 1 : points.length); i++) {
    const p = points[i],
      end = points[(i + 1) % points.length];
    if (p.length !== 6) continue;
    const times = new Set<number>();
    for (const axis of [0, 1]) {
      const a = p[axis],
        b = a + p[2 + axis],
        c = a + p[4 + axis],
        d = end[axis];
      const A = -a + 3 * b - 3 * c + d,
        B = 2 * (a - 2 * b + c),
        C = b - a;
      if (Math.abs(A) < 1e-12) {
        if (Math.abs(B) > 1e-12) times.add(-C / B);
      } else {
        const discriminant = B * B - 4 * A * C;
        if (discriminant >= 0) {
          times.add((-B + Math.sqrt(discriminant)) / (2 * A));
          times.add((-B - Math.sqrt(discriminant)) / (2 * A));
        }
      }
    }
    for (const t of times)
      if (t > 0 && t < 1) {
        const u = 1 - t;
        positions.push(
          [0, 1].map(
            (axis) =>
              u ** 3 * p[axis] +
              3 * u * u * t * (p[axis] + p[2 + axis]) +
              3 * u * t * t * (p[axis] + p[4 + axis]) +
              t ** 3 * end[axis]
          )
        );
      }
  }
  if (positions.some((p) => p.some((n) => !Number.isFinite(n)))) return null;
  const x = Math.min(...positions.map((p) => p[0])),
    y = Math.min(...positions.map((p) => p[1]));
  return {
    x,
    y,
    width: Math.max(...positions.map((p) => p[0])) - x,
    height: Math.max(...positions.map((p) => p[1])) - y,
  };
}
