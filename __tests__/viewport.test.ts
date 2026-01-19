/**
 * @vitest-environment happy-dom
 */

import { describe, expect, test } from 'vitest';
import { buildTransitions, getStepFromProgress, interpolateRect, type Rect } from '../src/utility/viewport';

describe('viewport utilities', () => {
  test('interpolateRect clamps t and interpolates fields', () => {
    const a: Rect = { x: 0, y: 0, width: 100, height: 100 };
    const b: Rect = { x: 100, y: 200, width: 200, height: 300 };

    expect(interpolateRect(a, b, 0)).toEqual(a);
    expect(interpolateRect(a, b, 1)).toEqual(b);
    expect(interpolateRect(a, b, 0.5)).toEqual({ x: 50, y: 100, width: 150, height: 200 });
    // clamps
    expect(interpolateRect(a, b, -1)).toEqual(a);
    expect(interpolateRect(a, b, 2)).toEqual(b);
  });

  test('buildTransitions returns sequence from initial through regions', () => {
    const initial: Rect = { x: 0, y: 0, width: 10, height: 10 };
    const regions: Rect[] = [
      { x: 1, y: 1, width: 2, height: 2 },
      { x: 3, y: 3, width: 4, height: 4 },
    ];

    const transitions = buildTransitions(initial, regions);
    expect(transitions.length).toBe(2);
    expect(transitions[0].from).toEqual(initial);
    expect(transitions[0].to).toEqual(regions[0]);
    expect(transitions[1].from).toEqual(regions[0]);
    expect(transitions[1].to).toEqual(regions[1]);
  });

  test('getStepFromProgress handles edge cases and computes index and t', () => {
    const initial: Rect = { x: 0, y: 0, width: 10, height: 10 };
    const regions: Rect[] = [
      { x: 1, y: 1, width: 2, height: 2 },
      { x: 3, y: 3, width: 4, height: 4 },
    ];
    const transitions = buildTransitions(initial, regions);

    expect(getStepFromProgress(-1, transitions)).toEqual({ index: -1, t: 0 });
    expect(getStepFromProgress(0, transitions)).toEqual({ index: 0, t: 0 });
    expect(getStepFromProgress(0.25, transitions)).toEqual({ index: 0, t: 0.25 });
    expect(getStepFromProgress(1, transitions)).toEqual({ index: 1, t: 0 });
    expect(getStepFromProgress(1.5, transitions)).toEqual({ index: 1, t: 0.5 });
    expect(getStepFromProgress(2, transitions)).toEqual({ index: 2, t: 0 });
  });
});
