import { cleanup, render } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { useSvgEditor } from '../src/hooks/useSvgEditor';

vi.mock('../src/hooks/usePolygonHelper', () => ({
  usePolygonHelper: () => ({
    helper: {
      state: { slowState: { currentTool: 'box' } },
      modifiers: { reset: vi.fn() },
      tools: { setTool: vi.fn() },
    },
    state: { currentTool: 'box', showBoundingBox: true, boxMode: true },
    currentShape: {
      open: false,
      points: [
        [100, 100],
        [300, 100],
        [300, 200],
        [100, 200],
      ],
    },
  }),
}));

function Editor() {
  const { defs, editor } = useSvgEditor({ image: { width: 1000, height: 1000 } });
  return (
    <svg viewBox="0 0 1000 1000">
      <defs>{defs}</defs>
      {editor}
    </svg>
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function markerSizes(container: HTMLElement) {
  return Array.from(container.querySelectorAll('marker'), (marker) => [
    marker.getAttribute('markerWidth'),
    marker.getAttribute('markerHeight'),
  ]);
}

// SVG strokes and their markers are already rendered in CSS pixels. Display
// density must not enlarge the handles relative to the rest of the editor.
test.each([1, 1.5, 2, 3])('marker sizes stay constant at devicePixelRatio=%s', (ratio) => {
  vi.stubGlobal('devicePixelRatio', ratio);
  const { container } = render(<Editor />);
  expect(markerSizes(container)).toEqual([
    ['5', '5'],
    ['5', '5'],
    ['5', '5'],
    ['6', '6'],
  ]);

  const boundingBoxes = container.querySelectorAll('polygon[marker-start]');
  expect(boundingBoxes).toHaveLength(2);
  for (const box of boundingBoxes) {
    expect(box.getAttribute('vector-effect')).toBe('non-scaling-stroke');
    expect(box.getAttribute('stroke-width')).toBe('2');
    const markerId = box.getAttribute('marker-start')!.slice(5, -1);
    expect(container.querySelector(`[id="${markerId}"]`)?.getAttribute('markerWidth')).toBe('6');
  }
});

test('moving between display densities does not resize mounted handles', () => {
  vi.stubGlobal('devicePixelRatio', 1);
  const { container, rerender } = render(<Editor />);
  const originalSizes = markerSizes(container);
  for (const ratio of [2, 1.5, 1]) {
    vi.stubGlobal('devicePixelRatio', ratio);
    rerender(<Editor />);
    expect(markerSizes(container)).toEqual(originalSizes);
  }
});
