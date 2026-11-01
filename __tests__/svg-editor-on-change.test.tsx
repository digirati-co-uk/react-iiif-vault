import { cleanup, render } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { useSvgEditor } from '../src/hooks/useSvgEditor';

const shape = {
  open: false,
  points: [
    [0, 0],
    [10, 0],
    [10, 10],
  ],
};

vi.mock('../src/hooks/usePolygonHelper', () => ({
  usePolygonHelper: () => ({
    helper: {
      state: { slowState: { currentTool: 'pen' }, scale: 1 },
      modifiers: { reset: vi.fn() },
      tools: { setTool: vi.fn() },
    },
    state: { currentTool: 'pen' },
    currentShape: shape,
  }),
}));

afterEach(cleanup);

test('an inline onChange is called once per committed shape, not once per render', () => {
  const calls: unknown[] = [];
  function Editor() {
    useSvgEditor({ image: { width: 100, height: 100 }, onChange: (s) => calls.push(s) });
    return null;
  }
  const { rerender } = render(<Editor />);
  rerender(<Editor />);
  rerender(<Editor />);
  expect(calls).toEqual([shape]);
});
