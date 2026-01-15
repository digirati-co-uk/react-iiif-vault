/**
 * @vitest-environment happy-dom
 */

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { Rect } from '../src/utility/viewport';
import { cubicBezierEasing, DEFAULT_BEZIER, EASING_PRESETS, type EasingPreset } from '../src/utility/viewport';

describe('viewport utilities (added tests)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  test('cubicBezierEasing produces expected easing curve', () => {
    const ease = cubicBezierEasing(DEFAULT_BEZIER);
    expect(ease(0)).toBe(0);
    expect(ease(1)).toBe(1);
    expect(ease(0.5)).toBeGreaterThan(0);
    expect(ease(0.5)).toBeLessThan(1);
  });

  test('cubicBezierEasing clamps to [0,1]', () => {
    const ease = cubicBezierEasing(DEFAULT_BEZIER);
    expect(ease(-0.1)).toBe(0);
    expect(ease(1.5)).toBe(1);
  });

  test('EASING_PRESETS includes known presets', () => {
    const presets = [
      'linear',
      'ease-in',
      'ease-out',
      'ease-in-out',
      'ease-in-cubic',
      'ease-out-cubic',
    ] as EasingPreset[];
    for (const preset of presets) {
      const tuple = EASING_PRESETS[preset];
      expect(tuple).toBeDefined();
      expect(Array.isArray(tuple)).toBe(true);
      expect(tuple.length).toBe(4);
    }
  });
});
