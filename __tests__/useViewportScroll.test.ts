/**
 * @vitest-environment happy-dom
 */

import { act, renderHook } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { useViewportScroll } from '../src/hooks/useViewportScroll';

describe('useViewportScroll', () => {
  test('computes progress from element scroll', async () => {
    const el = document.createElement('div');

    Object.defineProperty(el, 'clientHeight', { value: 100, configurable: true });
    Object.defineProperty(el, 'scrollHeight', { value: 500, configurable: true });
    el.scrollTop = 0;

    const inner = document.createElement('div');
    el.appendChild(inner);

    document.body.appendChild(el);

    const ref = { current: el } as any;

    const { result } = renderHook(() => useViewportScroll(ref, { axis: 'y', steps: 3 }));

    expect(result.current).toBeGreaterThanOrEqual(0);

    act(() => {
      (el as any).scrollTop = 200;
      el.dispatchEvent(new Event('scroll', { bubbles: true }));
    });

    await new Promise((r) => requestAnimationFrame(r));

    const finalProgress = result.current;
    try {
      expect(finalProgress).toBeGreaterThan(1.4);
      expect(finalProgress).toBeLessThan(1.7);
    } finally {
      document.body.removeChild(el);
    }
  });
});
