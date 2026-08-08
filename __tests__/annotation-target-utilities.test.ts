import { describe, expect, test } from 'vitest';
import { polygonToTarget } from '../src/canvas-panel/context/atlas-store';
import { isRectangle } from '../src/utility/is-rectangle';
import { polygonToBoundingBox } from '../src/utility/polygon-to-bounding-box';

describe('shared annotation target utilities', () => {
  test('uses corrected Helpers geometry and selector serialization', () => {
    expect(isRectangle([[0, 0], [10, 0], [0, 10]])).toBe(false);
    expect(polygonToBoundingBox({ points: [[-5, -5], [-1, -5], [-1, -1], [-5, -1]], open: false })).toEqual({
      x: -5,
      y: -5,
      width: 4,
      height: 4,
    });
    expect(
      polygonToTarget({ points: [[0, 0], [10, 5]], open: true })
    ).toMatchObject({ type: 'SvgSelector', value: expect.stringContaining('<polyline ') });
    expect(
      polygonToTarget({ points: [[0, 0], [10, 0], [5, 5]], open: false })
    ).toMatchObject({ type: 'SvgSelector', value: expect.stringContaining('<polygon ') });
  });
});
