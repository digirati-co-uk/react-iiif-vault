import { useEffect, useRef, useState } from 'react';

export type UseViewportScrollOptions = {
  axis?: 'y' | 'x';
  offset?: number; // pixels to add/subtract from position
  steps?: number; // multiply normalized fraction by this value
  enabled?: boolean;
};

/**
 * Returns a progress value derived from scroll position of provided element.
 * The returned value is in range [0, steps].
 * Uses passive scroll listener + requestAnimationFrame for efficient updates.
 */
export function useViewportScroll(ref: { current: HTMLElement | null } | null, options: UseViewportScrollOptions = {}) {
  const { axis = 'y', offset = 0, steps = 1, enabled = true } = options;
  const [progress, setProgress] = useState<number>(0);
  const lastRef = useRef<number>(-1);
  const rafIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) return;
    if (!ref || !ref.current) return;

    const el = ref.current;

    const update = () => {
      const scrollPos = axis === 'y' ? el.scrollTop : el.scrollLeft;
      const clientSize = axis === 'y' ? el.clientHeight : el.clientWidth;
      const scrollSize = axis === 'y' ? el.scrollHeight : el.scrollWidth;
      const max = scrollSize - clientSize;
      const fraction = max <= 0 ? 0 : Math.max(0, Math.min(1, (scrollPos + offset) / max));
      const value = fraction * steps;
      if (value !== lastRef.current) {
        lastRef.current = value;
        setProgress(value);
      }
      rafIdRef.current = null;
    };

    const onScroll = () => {
      if (rafIdRef.current === null) {
        rafIdRef.current = requestAnimationFrame(update);
      }
    };

    el.addEventListener('scroll', onScroll, { passive: true });
    update(); // initial

    return () => {
      el.removeEventListener('scroll', onScroll);
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, [ref, axis, offset, steps, enabled]);

  return progress;
}
