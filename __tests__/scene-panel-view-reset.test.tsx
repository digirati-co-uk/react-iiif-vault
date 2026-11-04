/** @vitest-environment happy-dom */
import React, { act } from 'react';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { useThree } from '@react-three/fiber';
import { PerspectiveCamera, Vector3 } from 'three';
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
  expect(camera.position.toArray()).not.toEqual(initialPosition);
  await renderer.advanceFrames(1, 1 / 30);
  expect(camera.position.toArray()).not.toEqual(initialPosition);
  await renderer.advanceFrames(60, 1 / 30);
  expect(camera.position.toArray()).toEqual(initialPosition);
  expect(controls.target.toArray()).toEqual([1, 2, 3]);
  expect(camera.fov).toBe(75);
  camera.userData.rivSceneTarget = [4, 5, 6];
  runtime.orbitTarget = undefined as any;
  await act(async () => {
    store.setState({ viewResetVersion: 2 });
    await renderer.update(
      <SceneRuntimeContext.Provider value={{ ...runtime } as any}>
        <Setup />
        <SceneViewBridge />
      </SceneRuntimeContext.Provider>
    );
  });
  await renderer.advanceFrames(60, 1 / 30);
  expect(controls.target.toArray()).toEqual([4, 5, 6]);
  expect(controller.getView().target).toEqual([4, 5, 6]);
  camera.position.set(30, 40, 50);
  await act(async () => store.setState({ viewResetVersion: 3, viewResetAnimate: false }));
  expect(camera.position.toArray()).toEqual(initialPosition);
  await renderer.unmount();
});

test.each(['locked', 'orbit'])(
  'discards the previous view transition on an authored %s camera handover',
  async (mode) => {
    const scene = { id: 'scene', type: 'Scene', items: [] } as any;
    const store = createSceneRuntimeStore(scene, { time: 0, playing: false, playbackRate: 1 });
    store.setState({ resourcesReady: true });
    const controls = { target: new Vector3(), saveState: vi.fn() };
    let setThree: any;
    let controller: any;
    const runtime = {
      scene,
      store,
      orbitTarget: [2, 3, 4],
      cameraControls: { mode: 'manifest' },
      transitionDuration: 0.6,
      resolvePoint: vi.fn(),
      registerViewController: (value: any) => {
        controller = value;
        return () => {};
      },
    };
    function Setup() {
      setThree = useThree((state) => state.set);
      React.useLayoutEffect(() => {
        setThree({ controls });
      }, []);
      return null;
    }
    const renderer = await ReactThreeTestRenderer.create(
      <SceneRuntimeContext.Provider value={runtime as any}>
        <Setup />
        <SceneViewBridge />
      </SceneRuntimeContext.Provider>
    );
    await renderer.advanceFrames(3, 1 / 30);
    const nextCamera = new PerspectiveCamera();
    nextCamera.position.set(100, 100, 100);
    await act(async () => {
      store.setState({
        activeCamera: 'authored',
        resources: { authored: { type: 'perspective-camera', interactionMode: [mode] } as any },
      });
      setThree({ camera: nextCamera, controls: undefined });
    });
    await renderer.advanceFrames(60, 1 / 30);
    expect(nextCamera.position.toArray()).toEqual([100, 100, 100]);
    nextCamera.position.set(200, 200, 200);
    await act(async () => store.setState({ viewResetVersion: 1, viewResetAnimate: false }));
    expect(controller.getView().position).toEqual([100, 100, 100]);
    await renderer.unmount();
  }
);

test.each(['locked', 'hemisphere-orbit', 'free-direction', 'orbit'])(
  'frame respects authored %s restrictions',
  async (mode) => {
    const store = createSceneRuntimeStore({ id: 'scene', type: 'Scene', items: [], interactionMode: [mode] } as any, {
      time: 0,
      playing: false,
      playbackRate: 1,
    });
    let controller: any;
    let camera: any;
    const runtime = {
      store,
      scene: store.getState().scene,
      cameraControls: { mode: 'manifest' },
      registerViewController: (value: any) => {
        controller = value;
        return () => {};
      },
    };
    function Setup() {
      camera = useThree((state) => state.camera);
      camera.userData.rivSceneFreeView = true;
      return null;
    }
    const renderer = await ReactThreeTestRenderer.create(
      <SceneRuntimeContext.Provider value={runtime as any}>
        <Setup />
        <SceneViewBridge />
      </SceneRuntimeContext.Provider>
    );
    const position = camera.position.toArray();
    await act(async () => controller.frame({ min: [90, 90, 90], max: [110, 110, 110], center: [100, 100, 100] }));
    expect(store.getState().freeViewActive).toBe(mode === 'orbit');
    if (mode === 'orbit') expect(camera.position.toArray()).not.toEqual(position);
    else expect(camera.position.toArray()).toEqual(position);
    await renderer.unmount();
  }
);
