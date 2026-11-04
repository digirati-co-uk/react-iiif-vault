import { describe, expect, test } from 'vitest';
import {
  polygonToTarget,
  requestToAnnotationResponse,
} from '../src/canvas-panel/context/atlas-store';
import { serialiseSupportedSelector } from '../src/utility/serialise-supported-selector';
import { polygonFromPath, polygonPath, polygonFromSvgSelector } from '../src/utility/polygon-path';
import { polygonToBoundingBox } from '../src/utility/polygon-to-bounding-box';
import { isRectangle } from '../src/utility/is-rectangle';
import type { InputShape } from 'polygon-editor';

const box: InputShape = {
  open: false,
  points: [
    [10, 10],
    [100, 10],
    [100, 80],
    [10, 80],
  ],
};
const curve: InputShape = {
  open: true,
  points: [
    [0, 0, 0, 100, 100, 100],
    [100, 0],
  ],
};

describe('selector fidelity', () => {
  test('only a closed rectangle becomes xywh', () => {
    expect(polygonToTarget(box)?.type).toBe('FragmentSelector');
    expect(polygonToTarget({ ...box, open: true })?.type).toBe('SvgSelector');
    expect(
      isRectangle([
        [0, 0],
        [100, 0],
        [50, 100],
      ])
    ).toBe(false);
    expect(
      isRectangle([
        [0, 0],
        [100, 100],
        [100, 0],
        [0, 100],
      ])
    ).toBe(false);
    expect(polygonToTarget(curve)?.type).toBe('SvgSelector');
    expect(requestToAnnotationResponse({ type: 'polygon', open: true, points: box.points }).polygon?.open).toBe(true);
  });
  test.each([true, false])('open=%s survives direct serialization with and without canvas dimensions', (open) => {
    for (const on of [undefined, { width: 300, height: 200 }]) {
      const result = serialiseSupportedSelector(
        {
          type: 'SvgSelector',
          svgShape: open ? 'polyline' : 'polygon',
          points: [
            [0, 0],
            [100, 0],
            [50, 100],
          ],
        } as any,
        on
      );
      expect(result && 'value' in result ? result.value : null).toContain(`<${open ? 'polyline' : 'polygon'} `);
    }
  });
  test.each([true, false])('cubic controls round-trip through a path with open=%s', (open) => {
    const shape = { ...curve, open };
    const path = polygonPath(shape.points, shape.open);
    expect(path).toContain('C 0 100 100 100 100 0');
    expect(polygonFromPath(path)).toEqual(shape);
    const target = polygonToTarget(shape);
    expect(JSON.stringify(target)).toContain('<path d=');
    if (target?.type !== 'SvgSelector' || !('value' in target)) throw new Error('Expected inline SVG');
    expect(polygonFromSvgSelector({ type: 'SvgSelector', value: target.value })).toEqual(shape);
  });
  test('unsupported or malformed paths are rejected without losing geometry silently', () => {
    for (const path of ['M 0 0 Q 5 10 20 20', 'M 0 0 M 1 1', 'M 0 0 C 1 2', 'M 0 0 Z L 2 2'])
      expect(polygonFromPath(path)).toBeNull();
  });
  test('bounds include curve extrema and negative coordinates', () => {
    expect(polygonToBoundingBox(curve)).toEqual({ x: 0, y: 0, width: 100, height: 75 });
    expect(
      polygonToBoundingBox({
        open: true,
        points: [
          [-20, -30],
          [-10, -5],
        ],
      })
    ).toEqual({ x: -20, y: -30, width: 10, height: 25 });
  });
});
