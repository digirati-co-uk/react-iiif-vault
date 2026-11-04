/** @vitest-environment happy-dom */
import React, { act } from 'react';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { useThree } from '@react-three/fiber';
import { Vector3 } from 'three';
import { expect, test, vi } from 'vitest';
import { SceneRuntimeContext } from '../src/scene-panel/context';
import { SceneViewBridge } from '../src/scene-panel/rendering-camera-rig';
import { createSceneRuntimeStore } from '../src/scene-panel/store';

test('reset restores the initial free view and orbitTarget and cancels a pending transition', async () => {
  const store = createSceneRuntimeStore({ id: 'scene', type: 'Scene', items: [] } as any, {
    time: 0,
    playing: false,
    playbackRate: 1,
  });
  store.setState({ resourcesReady: true });
  const controls = { target: new Vector3(), saveState: vi.fn() };
  let camera: any;
  let controller: any;
  const runtime = {
    store,
    orbitTarget: [1, 2, 3],
    cameraControls: { mode: 'orbit' },
    transitionDuration: 0.6,
    resolvePoint: vi.fn(),
    registerViewController: (value: any) => {
      controller = value;
      return () => undefined;
    },
  };
  function Setup() {
    const set = useThree((state) => state.set);
    camera = useThree((state) => state.camera);
    camera.userData.rivSceneFreeView = true;
    React.useLayoutEffect(() => {
      set({ controls } as any);
    }, [set]);
    return null;
  }
  const renderer = await ReactThreeTestRenderer.create(
    <SceneRuntimeContext.Provider value={runtime as any}>
      <Setup />
      <SceneViewBridge />
    </SceneRuntimeContext.Provider>
  );
  const initialPosition = camera.position.toArray();
  await act(async () =>
    controller.setView(
      {
        projection: 'perspective',
        position: [20, 10, 30],
        rotation: [0, 0, 0],
        target: [0, 0, 0],
        fieldOfView: 25,
        near: 0.1,
        far: 100,
      },
      { transition: true }
    )
  );
  await renderer.advanceFrames(5, 1 / 30);
  expect(camera.position.toArray()).not.toEqual(initialPosition);
  await act(async () => store.setState({ viewResetVersion: 1 }));
  await renderer.advanceFrames(60, 1 / 30);
  expect(camera.position.toArray()).toEqual(initialPosition);
  expect(controls.target.toArray()).toEqual([1, 2, 3]);
  expect(camera.fov).toBe(75);
  await renderer.unmount();
});
