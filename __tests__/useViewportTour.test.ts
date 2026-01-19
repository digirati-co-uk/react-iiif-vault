/**
 * @vitest-environment happy-dom
 */

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { useViewportTour } from '../src/hooks/useViewportTour';
import type { Rect } from '../src/utility/viewport';

describe('useViewportTour hook', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  test('reports index changes based on getProgress polling', () => {
    const initial: Rect = { x: 0, y: 0, width: 100, height: 100 };
    const regions: Rect[] = [
      { x: 10, y: 10, width: 50, height: 50 },
      { x: 100, y: 100, width: 50, height: 50 },
    ];

    let progress = 0;
    const getProgress = () => progress;

    const onEnter = vi.fn();
    const onExit = vi.fn();
    const onProgress = vi.fn();

    const { result } = renderHook(() =>
      useViewportTour({ initial, regions, getProgress, pollInterval: 10, onEnter, onExit, onProgress }),
    );

    // initial poll
    act(() => {
      vi.advanceTimersByTime(10);
    });

    expect(onEnter).toHaveBeenCalledTimes(1);
    expect(onEnter).toHaveBeenCalledWith(0);
    expect(result.current.currentIndex).toBe(0);

    // progress into second step
    act(() => {
      progress = 1.2; // into second step
      vi.advanceTimersByTime(10);
    });

    expect(onExit).toHaveBeenCalledWith(0);
    expect(onEnter).toHaveBeenCalledWith(1);
    expect(result.current.currentIndex).toBe(1);

    // progress beyond end
    act(() => {
      progress = 3;
      vi.advanceTimersByTime(10);
    });

    expect(result.current.currentIndex).toBe(2);
  });
});
