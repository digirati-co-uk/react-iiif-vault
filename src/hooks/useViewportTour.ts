import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  buildTransitions,
  cubicBezierEasing,
  DEFAULT_BEZIER,
  DEFAULT_POLL_INTERVAL,
  EASING_PRESETS,
  type EasingPreset,
  getStepFromProgress,
  interpolateRect,
  type Rect,
  type Transition,
} from '../utility/viewport';

export type EasingInput = ((t: number) => number) | EasingPreset | [number, number, number, number];

export type UseViewportTourOptions = {
  initial: Rect;
  regions: Rect[];
  /** Provide either a numeric progress or a function that returns progress */
  progress?: number;
  getProgress?: () => number;
  enabled?: boolean;
  easing?: EasingInput;
  /** if true, report progress every tick; otherwise only when step index changes */
  reportEveryFrame?: boolean;
  pollInterval?: number; // ms, default DEFAULT_POLL_INTERVAL
  loop?: boolean;
  onEnter?: (index: number) => void;
  onExit?: (index: number) => void;
  onProgress?: (index: number, t: number) => void;
  /** optional callback to receive jump-to function for programmatic navigation */
  jumpTo?: (fn: (index: number) => void) => void;
};

export function useViewportTour(options: UseViewportTourOptions) {
  const {
    initial,
    regions,
    progress,
    getProgress,
    enabled = true,
    easing: easingInput,
    reportEveryFrame = false,
    pollInterval = DEFAULT_POLL_INTERVAL,
    loop = false,
    onEnter,
    onExit,
    onProgress,
    jumpTo: jumpToProp,
  } = options;

  const transitions = useMemo(() => buildTransitions(initial, regions), [initial, regions]);

  const [currentIndex, setCurrentIndex] = useState<number>(() => -1);
  const [t, setT] = useState<number>(0);
  const lastIndexRef = useRef<number>(-1);
  const lastTRef = useRef<number>(0);
  const mounted = useRef(true);
  const jumpToCallbackRef = useRef<(index: number) => void>(() => {});

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const easeFn = useMemo(() => {
    if (!easingInput) return cubicBezierEasing(DEFAULT_BEZIER);
    if (typeof easingInput === 'function') return easingInput;
    if (Array.isArray(easingInput) && easingInput.length === 4) {
      return cubicBezierEasing(easingInput as [number, number, number, number]);
    }
    const preset = EASING_PRESETS[easingInput as EasingPreset];
    return preset ? cubicBezierEasing(preset) : cubicBezierEasing(DEFAULT_BEZIER);
  }, [easingInput]);

  const jumpToFn = useCallback(
    (indexToJump: number) => {
      if (indexToJump < 0 || indexToJump >= transitions.length) return;
      setCurrentIndex(indexToJump);
      lastIndexRef.current = indexToJump;
      lastTRef.current = 0;
      setT(0);
      if (onEnter) {
        try {
          onEnter(indexToJump);
        } catch {}
      }
    },
    [transitions, onEnter],
  );

  useEffect(() => {
    jumpToCallbackRef.current = jumpToFn;
    if (jumpToProp) {
      jumpToProp(jumpToFn);
    }
  }, [jumpToFn, jumpToProp]);

  function handleProgressValue(progressValue: number) {
    const { index, t: localT } = getStepFromProgress(progressValue, transitions);

    let wrappedIndex = index;
    if (loop && transitions.length > 0) {
      const len = transitions.length;
      wrappedIndex = ((index % len) + len) % len;
    }

    const eased = easeFn(localT);

    if (wrappedIndex !== lastIndexRef.current) {
      if (lastIndexRef.current >= 0 && onExit) {
        try {
          onExit(lastIndexRef.current);
        } catch {}
      }
      if (wrappedIndex >= 0 && onEnter) {
        try {
          onEnter(wrappedIndex);
        } catch {}
      }
      lastIndexRef.current = wrappedIndex;
      if (mounted.current) setCurrentIndex(wrappedIndex);
    }

    lastTRef.current = eased;
    if (mounted.current) {
      if (reportEveryFrame) {
        setT(eased);
      } else {
        if (wrappedIndex !== currentIndex) {
          setT(eased);
        }
      }
    }

    if (onProgress && wrappedIndex >= 0) {
      try {
        onProgress(wrappedIndex, eased);
      } catch {}
    }
  }

  useEffect(() => {
    if (!enabled) return;
    if (typeof progress === 'number') {
      handleProgressValue(progress);
    }
  }, [progress, enabled]);

  useEffect(() => {
    if (!enabled) return;
    if (typeof getProgress !== 'function') return;

    let intervalId: any = null;

    const poll = () => {
      try {
        const v = getProgress();
        handleProgressValue(v);
      } catch (e) {}
    };

    poll();
    intervalId = setInterval(poll, pollInterval);

    return () => clearInterval(intervalId);
  }, [getProgress, enabled, pollInterval]);

  const currentTransition: Transition | undefined =
    currentIndex >= 0 && currentIndex < transitions.length ? transitions[currentIndex] : undefined;

  const currentRect = currentTransition
    ? interpolateRect(currentTransition.from, currentTransition.to, lastTRef.current)
    : undefined;

  return {
    transitions,
    currentIndex,
    currentTransition,
    t: lastTRef.current,
    rect: currentRect,
    jumpTo: jumpToFn,
  };
}
