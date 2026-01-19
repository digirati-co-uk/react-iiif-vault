export type Rect = { x: number; y: number; width: number; height: number };

export type Transition = { from: Rect; to: Rect };

export const DEFAULT_BEZIER: [number, number, number, number] = [0.6, 0.02, 0.0, 0.75];
export const DEFAULT_POLL_INTERVAL = 16;

export type EasingPreset = 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'ease-in-cubic' | 'ease-out-cubic';

export const EASING_PRESETS: Record<EasingPreset, [number, number, number, number]> = {
  linear: [0, 0, 1, 1],
  'ease-in': [0.42, 0, 1, 1],
  'ease-out': [0, 0, 0.58, 1],
  'ease-in-out': [0.42, 0, 0.58, 1],
  'ease-in-cubic': DEFAULT_BEZIER,
  'ease-out-cubic': [0.215, 0.61, 0.355, 1],
};

export function interpolateRect(a: Rect, b: Rect, t: number): Rect {
  const clampT = Math.max(0, Math.min(1, t));
  return {
    x: a.x + (b.x - a.x) * clampT,
    y: a.y + (b.y - a.y) * clampT,
    width: a.width + (b.width - a.width) * clampT,
    height: a.height + (b.height - a.height) * clampT,
  };
}

export function buildTransitions(initial: Rect, regions: Rect[]): Transition[] {
  const list: Transition[] = [];
  let prev = initial;
  for (const r of regions) {
    list.push({ from: prev, to: r });
    prev = r;
  }
  return list;
}

/**
 * Create a cubic-bezier easing function given control points [x1,y1,x2,y2].
 * Uses a numeric solve to invert x(t) -> t for a given x input.
 */
export function cubicBezierEasing([x1, y1, x2, y2]: [number, number, number, number]) {
  // Cubic Bezier polynomial
  const cx = 3.0 * x1;
  const bx = 3.0 * (x2 - x1) - cx;
  const ax = 1.0 - cx - bx;

  const cy = 3.0 * y1;
  const by = 3.0 * (y2 - y1) - cy;
  const ay = 1.0 - cy - by;

  function sampleCurveX(t: number) {
    return ((ax * t + bx) * t + cx) * t;
  }

  function sampleCurveY(t: number) {
    return ((ay * t + by) * t + cy) * t;
  }

  function sampleCurveDerivativeX(t: number) {
    return (3.0 * ax * t + 2.0 * bx) * t + cx;
  }

  // Given x, find t such that sampleCurveX(t) ~= x via Newton-Raphson, fallback to bisection
  function solveCurveX(x: number, epsilon = 1e-6) {
    let t = x;
    for (let i = 0; i < 8; i++) {
      const x2 = sampleCurveX(t) - x;
      if (Math.abs(x2) < epsilon) return t;
      const d = sampleCurveDerivativeX(t);
      if (Math.abs(d) < 1e-6) break;
      t = t - x2 / d;
    }
    // fallback to bisection
    let t0 = 0.0;
    let t1 = 1.0;
    t = x;
    while (t0 < t1) {
      const x2 = sampleCurveX(t);
      if (Math.abs(x2 - x) < epsilon) return t;
      if (x > x2) t0 = t;
      else t1 = t;
      t = (t1 - t0) * 0.5 + t0;
    }
    return t;
  }

  return (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    const t = solveCurveX(x);
    return sampleCurveY(t);
  };
}

/**
 * Map a progress value to a step index and local t in [0,1].
 * If progress < 0 returns index -1 and t 0. If progress >= transitions.length returns index = transitions.length and t 0.
 */
export function getStepFromProgress(progress: number, transitions: Transition[]) {
  if (!transitions || transitions.length === 0) {
    return { index: -1, t: 0 };
  }

  if (Number.isNaN(progress) || !isFinite(progress)) {
    return { index: -1, t: 0 };
  }

  if (progress < 0) return { index: -1, t: 0 };

  if (progress >= transitions.length) return { index: transitions.length, t: 0 };

  const index = Math.floor(progress);
  const t = progress - index;
  return { index, t };
}
