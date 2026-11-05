import React from 'react';
import { act, render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import { SceneProvider, useSceneRuntime } from '../src/scene-panel/context';
import { useSceneControls } from '../src/scene-panel/controls';
import type { SceneRuntimeStore } from '../src/scene-panel/store';
import { Vault4 } from '@iiif/helpers/vault-4';

test('reports the active authored interaction so host controls never unlock a fixed camera', async () => {
  let store: SceneRuntimeStore | undefined;
  function Probe() {
    store = useSceneRuntime().store;
    return <output>{useSceneControls().interactionMode}</output>;
  }
  render(
    <SceneProvider
      vault={new Vault4()}
      scene={{ id: 'https://example.org/scene', type: 'Scene', interactionMode: ['locked'], items: [] } as any}
    >
      <Probe />
    </SceneProvider>
  );
  await screen.findByText('locked');
  act(() =>
    store!.setState({
      activeCamera: 'camera',
      resources: {
        camera: {
          hidden: false,
          disabled: false,
          selected: false,
          playing: false,
          activeAnimation: null,
          resetVersion: 0,
          transformOverride: null,
          type: 'perspective-camera',
          interactionMode: ['free'],
        },
      },
    })
  );
  expect(screen.getByText('free')).toBeTruthy();
  act(() => store!.setState({ freeViewActive: true }));
  expect(screen.getByText('orbit')).toBeTruthy();
});
