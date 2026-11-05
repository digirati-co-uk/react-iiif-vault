/** @vitest-environment happy-dom */
import React, { act } from 'react';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { useThree } from '@react-three/fiber';
import { PerspectiveCamera, Vector3 } from 'three';
import { expect, test, vi } from 'vitest';
import { SceneRuntimeContext } from '../src/scene-panel/context';
import { homeViewForCamera, captureSceneView, SceneViewBridge } from '../src/scene-panel/rendering-camera-rig';
import { InitialSceneBounds } from '../src/scene-panel/rendering-primitives';
import { AtlasOrbitControlsImpl } from '../src/scene-panel/atlas-orbit-controls';
import type { SceneBounds } from '../src/scene-panel/types';
import { createSceneRuntimeStore } from '../src/scene-panel/store';

test('Home restores its canonical target instead of a controlled focus or stale camera cache', async () => {
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
  const homeTarget = store.getState().homeViews.free.view.target;
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
  expect(controls.target.toArray()).toEqual(homeTarget);
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
  expect(controls.target.toArray()).toEqual(homeTarget);
  expect(controller.getView().target).toEqual(homeTarget);
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

test.each([true, false])(
  'Home uses the published frame regardless of sibling effect order (bridge first: %s)',
  async (bridgeFirst) => {
    const store = createSceneRuntimeStore({ id: 'scene', type: 'Scene', items: [] } as any, {
      time: 0,
      playing: false,
      playbackRate: 1,
    });
    store.setState({ resourcesReady: true });
    let camera: any;
    let controls: AtlasOrbitControlsImpl;
    let controller: any;
    const runtime = {
      store,
      cameraPadding: 1.4,
      cameraControls: { mode: 'orbit' },
      transitionDuration: 0.6,
      registerViewController: (value: any) => {
        controller = value;
        return () => {};
      },
      resolvePoint: vi.fn(),
    };
    function Setup() {
      const set = useThree((s) => s.set);
      camera = useThree((s) => s.camera);
      React.useLayoutEffect(() => {
        controls = new AtlasOrbitControlsImpl(camera);
        controls.target.set(0, 0, 4); // the temporary target that broke the real demo
        set({ controls } as any);
      }, [set]);
      return null;
    }
    const contents = (x: number, focused?: readonly [number, number, number]) => (
      <SceneRuntimeContext.Provider value={{ ...runtime, orbitTarget: focused } as any}>
        <Setup />
        {bridgeFirst ? <SceneViewBridge /> : null}
        <InitialSceneBounds frame padding={1.4} onBounds={vi.fn()}>
          <mesh position={[x, 10, 0]}>
            <boxGeometry args={[4, 2, 6]} />
          </mesh>
        </InitialSceneBounds>
        {bridgeFirst ? null : <SceneViewBridge />}
      </SceneRuntimeContext.Provider>
    );
    const renderer = await ReactThreeTestRenderer.create(contents(20));
    const home = store.getState().homeViews.free;
    expect(home.source).toBe('framed');
    expect(home.view.target).toEqual([20, 10, 0]);
    const assertHome = () => {
      expect(camera.position.distanceTo(new Vector3(...home.view.position))).toBeLessThan(1e-8);
      expect(controls.target.distanceTo(new Vector3(...home.view.target))).toBeLessThan(1e-8);
      controls.update(); // the next real OrbitControls frame must not undo Home
      expect(camera.position.distanceTo(new Vector3(...home.view.position))).toBeLessThan(1e-8);
      expect(
        camera.getWorldDirection(new Vector3()).dot(new Vector3(...home.view.target).sub(camera.position).normalize())
      ).toBeCloseTo(1);
    };
    await renderer.update(contents(200, [200, 10, 0])); // interactions must not change Home
    await renderer.advanceFrames(60, 1 / 30);
    await act(async () => controller.setView({ ...controller.getView(), position: [30, 40, 50] }));
    await act(async () => store.setState({ viewResetVersion: 1 }));
    // Host clears controlled focus one commit AFTER issuing Home.
    await renderer.update(contents(200));
    await renderer.advanceFrames(60, 1 / 30);
    assertHome();
    expect(store.getState().homeViews.free).toBe(home);
    await act(async () => store.setState({ viewResetVersion: 2 }));
    await renderer.advanceFrames(60, 1 / 30);
    assertHome(); // repeated Home is idempotent
    await renderer.unmount();
  }
);

test('refits frozen Home bounds for a portrait viewport and includes depth', () => {
  const camera = new PerspectiveCamera(50, 2, 0.1, 1000);
  camera.position.set(0, 0, 12);
  const home = {
    view: captureSceneView(camera, new Vector3()),
    aspect: 2,
    bounds: { min: [-5, -2, -5], max: [5, 2, 5], center: [0, 0, 0] } as SceneBounds,
  };
  camera.aspect = 0.4;
  camera.updateProjectionMatrix();
  const view = homeViewForCamera(camera, home);
  const fitted = new PerspectiveCamera(50, 0.4);
  fitted.position.fromArray(view.position);
  fitted.lookAt(new Vector3(...view.target));
  fitted.updateMatrixWorld();
  for (const x of [-5, 5])
    for (const y of [-2, 2])
      for (const z of [-5, 5]) {
        const projected = new Vector3(x, y, z).project(fitted);
        expect(Math.abs(projected.x)).toBeLessThan(1);
        expect(Math.abs(projected.y)).toBeLessThan(1);
      }
  expect(home.view.position).toEqual([0, 0, 12]);
});

test('stops residual pan, damping and zoom before giving Home ownership', () => {
  const camera = new PerspectiveCamera();
  camera.position.set(0, 0, 10);
  const controls = new AtlasOrbitControlsImpl(camera);
  (controls as any)._sphericalDelta.set(0, 0.2, 0);
  (controls as any)._panOffset.set(1, 2, 0);
  (controls as any)._scale = 0.5;
  controls.stop();
  controls.update();
  expect(camera.position.distanceTo(new Vector3(0, 0, 10))).toBeLessThan(1e-8);
});
