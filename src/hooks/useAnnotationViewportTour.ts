import { expandTarget } from '@iiif/helpers';
import { useEffect, useMemo } from 'react';
import { useStore } from 'zustand';
import { useAtlasStore } from '../canvas-panel/context/atlas-store-provider';
import type { Rect } from '../utility/viewport';
import { useViewportScroll } from './useViewportScroll';
import { type EasingInput, useViewportTour } from './useViewportTour';

export type UseAnnotationViewportTourOptions = {
  initial: Rect;
  annotations: any[];
  /** Either provide a getProgress function or a containerRef for scroll-based progress */
  getProgress?: () => number;
  containerRef?: { current: HTMLElement | null } | null;
  enabled?: boolean;
  padding?: number;
  easing?: EasingInput;
  reportEveryFrame?: boolean;
  loop?: boolean;
  onEnter?: (index: number) => void;
  onExit?: (index: number) => void;
  onProgress?: (index: number, t: number) => void;
  jumpTo?: (fn: (index: number) => void) => void;
};

export function useAnnotationViewportTour(options: UseAnnotationViewportTourOptions) {
  const {
    initial,
    annotations,
    getProgress,
    containerRef,
    enabled = true,
    padding = 40,
    easing,
    reportEveryFrame = false,
    loop = false,
    onEnter,
    onExit,
    onProgress,
    jumpTo: jumpToProp,
  } = options;

  const atlasStore = useAtlasStore();
  const runtime = useStore(atlasStore, (s) => s.runtime);

  const regions = useMemo(() => {
    if (!annotations || annotations.length === 0) return [] as Rect[];

    return annotations
      .map((a) => {
        try {
          const supported = expandTarget(a.target || a);
          const spatial = (supported.selector?.spatial as any) || {};
          if (typeof spatial.x === 'number') {
            return {
              x: spatial.x,
              y: spatial.y,
              width: spatial.width,
              height: spatial.height,
            } as Rect;
          }
        } catch (e) {
          // ignore
        }
        return null;
      })
      .filter(Boolean) as Rect[];
  }, [annotations]);

  const scrollProgress = containerRef
    ? useViewportScroll(containerRef, { axis: 'y', steps: regions.length })
    : undefined;
  const progressSource = getProgress || scrollProgress;

  const tour = useViewportTour({
    initial,
    regions,
    getProgress: typeof progressSource === 'function' ? (progressSource as () => number) : undefined,
    progress: typeof progressSource === 'number' ? (progressSource as number) : undefined,
    enabled,
    easing,
    reportEveryFrame,
    loop,
    onEnter,
    onExit,
    onProgress,
    jumpTo: jumpToProp,
  });

  useEffect(() => {
    if (!runtime) return;
    if (!tour.rect) return;

    runtime.world.gotoRegion({
      ...tour.rect,
      padding,
      paddingPx: tour.currentIndex === 0 ? undefined : { left: 440, top: padding, bottom: padding, right: padding },
    });
  }, [runtime, tour.rect, padding]);

  return {
    regions,
    tour,
    runtime,
  };
}
