import type { AtlasProps } from '@atlas-viewer/atlas';
import { cleanup, render } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { Viewer } from '../src/canvas-panel/Viewer';

const atlas = vi.hoisted(() => ({ props: null as AtlasProps | null }));

vi.mock('@atlas-viewer/atlas', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@atlas-viewer/atlas')>()),
  AtlasAuto: (props: AtlasProps) => {
    atlas.props = props;
    return null;
  },
}));
vi.mock('../src/hooks/useInternalSetCanvasViewports', () => ({ useInternalSetCanvasViewports: () => {} }));

afterEach(cleanup);

test('Viewer enables two-finger navigation while drawing and retains host controller settings', () => {
  const controllerConfig = { enableTouchRotation: true, enablePanMomentum: false };
  const view = render(<Viewer controllerConfig={controllerConfig}>{null}</Viewer>);
  expect(atlas.props?.controllerConfig).toMatchObject({
    sketchTouchNavigation: 'two-finger',
    ...controllerConfig,
  });
  expect(controllerConfig).not.toHaveProperty('sketchTouchNavigation');

  view.rerender(<Viewer>{null}</Viewer>);
  expect(atlas.props?.controllerConfig?.sketchTouchNavigation).toBe('two-finger');
});

test('Viewer preserves an explicit opt-out of navigation while drawing', () => {
  render(<Viewer controllerConfig={{ sketchTouchNavigation: 'none' }}>{null}</Viewer>);
  expect(atlas.props?.controllerConfig?.sketchTouchNavigation).toBe('none');
});
