import { useEffect, useRef, useState } from 'react';
import { cubicBezierEasing, EASING_PRESETS, type EasingPreset } from '../utility/viewport';

type EasingInput = ((t: number) => number) | EasingPreset | [number, number, number, number];

interface UseSmoothedRotationOptions {
  /** Duration of the transition in milliseconds. Default: 400 */
  duration?: number;
  /** Easing function, preset name, or cubic-bezier control points. Default: 'ease-in-out' */
  easing?: EasingInput;
}

/**
 * Takes a target rotation (in degrees) and returns a smoothed value that
 * animates toward it using requestAnimationFrame and an easing function.
 *
 * Handles rapid changes: if the target changes mid-animation, the animation
 * re-targets from the current interpolated position so there's no jump.
 *
 * Rotation is interpolated along the shortest angular path (e.g. 350→10
 * goes through 0 rather than backwards 340°).
 */
export function useSmoothedRotation(
  target: number | undefined,
  { duration = 300, easing: easingInput }: UseSmoothedRotationOptions = {},
): number | undefined {
  const easeFn = useRef<(t: number) => number>(cubicBezierEasing(EASING_PRESETS['ease-in-out']));

  // Rebuild the easing function only when the input changes.
  useEffect(() => {
    if (!easingInput) {
      easeFn.current = cubicBezierEasing(EASING_PRESETS['ease-in-out']);
    } else if (typeof easingInput === 'function') {
      easeFn.current = easingInput;
    } else if (Array.isArray(easingInput)) {
      easeFn.current = cubicBezierEasing(easingInput as [number, number, number, number]);
    } else {
      const preset = EASING_PRESETS[easingInput as EasingPreset];
      easeFn.current = cubicBezierEasing(preset ?? EASING_PRESETS['ease-in-out']);
    }
  }, [easingInput]);

  // Start from `undefined` so the first render matches the initial target
  // without playing an animation (no visible jump from 0→target).
  const [smoothed, setSmoothed] = useState<number | undefined>(target);

  // Mutable refs so the RAF callback always sees current values without
  // needing to be recreated on every render.
  const fromRef = useRef<number>(target ?? 0);
  const startTimeRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const targetRef = useRef<number | undefined>(target);

  useEffect(() => {
    if (target === undefined) {
      setSmoothed(undefined);
      return;
    }

    const prevTarget = targetRef.current;
    targetRef.current = target;

    // First render: snap immediately, no animation.
    if (prevTarget === undefined) {
      fromRef.current = target;
      setSmoothed(target);
      return;
    }

    // Already at the target: nothing to do.
    if (prevTarget === target && smoothed === target) {
      return;
    }

    // Cancel any in-progress animation and capture the current interpolated
    // angle as the new starting point, so mid-flight changes don't jump.
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    // fromRef.current already holds the last rendered smoothed value (updated
    // inside the RAF loop below), so we use it directly as the start.
    startTimeRef.current = null;

    // Compute the shortest angular delta from current smoothed → new target.
    // We work in raw degrees and offset the target so the interpolation path
    // is always ≤ 180°.
    const from = fromRef.current;
    const delta = (((((target || 0) - from) % 360) + 540) % 360) - 180; // shortest path, range (-180, 180]
    const to = from + delta;

    function tick(now: number) {
      if (startTimeRef.current === null) {
        startTimeRef.current = now;
      }
      const elapsed = now - startTimeRef.current;
      const rawT = Math.min(elapsed / duration, 1);
      const easedT = easeFn.current(rawT);

      const current = from + (to - from) * easedT;
      fromRef.current = current;
      setSmoothed(current);

      if (rawT < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        // Snap to exact target value and normalise to [0, 360).
        fromRef.current = (((target || 0) % 360) + 360) % 360;
        setSmoothed(fromRef.current);
        rafRef.current = null;
      }
    }

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [target, duration]);

  return smoothed;
}
