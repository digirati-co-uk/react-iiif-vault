import { renderHook } from '@testing-library/react';
import { createHelper } from 'polygon-editor';
import { expect, test } from 'vitest';
import { usePolygonInput } from '../src/hooks/usePolygonInput';

const event = (x: number, y: number, extra = {}) => ({
  pointerId: 1,
  button: 0,
  buttons: 1,
  clientX: x,
  clientY: y,
  ...extra,
});

function setup(toWorld: (e: ReturnType<typeof event>) => [number, number] | null) {
  const helper = createHelper({ open: true, points: [], tool: 'box' }, () => {});
  const { result } = renderHook(() => usePolygonInput({ helper, toWorld, capturePointer: false }));
  return { helper, input: result.current };
}

test('a surface that cannot be measured ignores the gesture instead of throwing', () => {
  const { helper, input } = setup(() => null);
  expect(() => {
    input.pointerDown(event(1, 1));
    input.pointerMove(event(5, 5));
    input.pointerUp(event(5, 5));
    input.doubleClick(event(5, 5));
  }).not.toThrow();
  expect(helper.state.polygon.points).toHaveLength(0);
});

test('drawing a box with a measurable surface commits it', () => {
  const { helper, input } = setup((e) => [e.clientX, e.clientY]);
  input.pointerDown(event(10, 10));
  input.pointerMove(event(60, 40));
  input.pointerUp(event(60, 40));
  expect(helper.state.polygon.points).toHaveLength(4);
});

test('a second contact cancels the gesture until every contact lifts', () => {
  const { helper, input } = setup((e) => [e.clientX, e.clientY]);
  input.pointerDown(event(10, 10));
  input.pointerDown(event(20, 20, { pointerId: 2 }));
  input.pointerMove(event(60, 40));
  input.pointerUp(event(60, 40));
  input.pointerUp(event(60, 40, { pointerId: 2 }));
  expect(helper.state.polygon.points).toHaveLength(0);
  input.pointerDown(event(10, 10));
  input.pointerMove(event(60, 40));
  input.pointerUp(event(60, 40));
  expect(helper.state.polygon.points).toHaveLength(4);
});
