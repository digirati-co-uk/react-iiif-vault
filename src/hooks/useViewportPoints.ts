// const { current, getProgress } = useViewportPoints(
//   {
//     enabled: true, // e.g. free form
//     regions: [
//       {x: 0, y: 0, width: 100, height: 100, id: '1'},
//       {x: 50, y: 50, width: 100, height: 100, id: '2'},
//       ...
//     ],
//     gap: 0.2,
//     // function that returns 0.0 -> 1.0 per step (ignore negative)
//     getProgress: () => progress,
//     // also ignore Ignore > regions.length
//   },
// );

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from 'zustand';
import { useAtlasStore } from '../canvas-panel/context/atlas-store-provider';

export interface UseViewportPoints {
  initial: { width: number; height: number };
  regions: { x: number; y: number; width: number; height: number; id?: string }[];
  getProgress: () => number;
  enabled?: boolean;
  gap?: number;
  easing?: [number, number, number, number];
}

const DEFAULT_EASING = [0.6, 0.02, 0.0, 0.75];

const easeFn = (t: number) => lerp(0, 1, t);

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

export function useViewportPoints(options: UseViewportPoints) {
  const easing = options.easing || DEFAULT_EASING;
  const store = useAtlasStore();
  const runtime = useStore(store, (s) => s.runtime);
  const [currentIndex, setCurrentIndex] = useState(-1);

  const { list } = useMemo(
    () =>
      options.regions.reduce(
        ({ prev, list }, next) => {
          return {
            prev: next,
            list: [...list, { from: prev, to: next }],
          };
        },
        {
          list: [] as {
            from: UseViewportPoints['regions'][number];
            to: UseViewportPoints['regions'][number];
          }[],
          prev: {
            x: 0,
            y: 0,
            width: options.initial.width,
            height: options.initial.height,
          } as UseViewportPoints['regions'][number],
        }
      ),
    [options.regions, options.initial.width, options.initial.height]
  );

  const lastProgress = useRef<number>(-1);

  const callback = useCallback(() => {
    const currentProgress = options.getProgress();
    if (currentProgress < 0 || currentProgress >= list.length) return;

    const newCurrentIndex = Math.floor(currentProgress);
    const ease = easeFn(currentProgress - newCurrentIndex);
    const t = list[newCurrentIndex];

    runtime?.world.gotoRegion({
      x: t.from.x + (t.to.x - t.from.x) * ease,
      y: t.from.y + (t.to.y - t.from.y) * ease,
      width: t.from.width + (t.to.width - t.from.width) * ease,
      height: t.from.height + (t.to.height - t.from.height) * ease,
      padding: 20,
    });

    lastProgress.current = currentProgress;

    if (newCurrentIndex !== currentIndex) {
      setCurrentIndex(newCurrentIndex);
    }
  }, [runtime, currentIndex, list]);

  useEffect(() => {
    if (runtime) {
      return runtime.registerHook('useBeforeFrame', callback);
    }
    return () => {
      // no-op
    };
  }, [runtime, callback]);

  return {
    regions: list,
    currentIndex,
    current: list[currentIndex],
  };
}
