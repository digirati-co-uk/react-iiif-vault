/** @vitest-environment happy-dom */
import React, { act } from 'react';
import Renderer from '@react-three/test-renderer';
import { useThree } from '@react-three/fiber';
import { PerspectiveCamera, OrthographicCamera, Vector3, Matrix4 } from 'three';
import { test, expect, vi } from 'vitest';
import { SceneRuntimeContext } from '../src/scene-panel/context';
import { AtlasOrbitControlsImpl } from '../src/scene-panel/atlas-orbit-controls';
import { SceneViewBridge } from '../src/scene-panel/rendering-camera-rig';
import { CameraResource } from '../src/scene-panel/rendering-camera';
import { createSceneRuntimeStore } from '../src/scene-panel/store';
function setup() {
  const scene: any = { id: 's', type: 'Scene', items: [] };
  const store = createSceneRuntimeStore(scene, { time: 0, playing: false, playbackRate: 1 });
  store.setState({ resourcesReady: true });
  const runtime: any = {
    scene,
    store,
    cameraControls: { mode: 'orbit' },
    transitionDuration: 0,
    registerViewController: () => () => {},
    resolvePoint: vi.fn(),
    refreshResourceBounds: vi.fn(),
  };
  return { store, runtime };
}
test('Home waits for the destination camera during a projection handover', async () => {
  const { store, runtime } = setup();
  let set: any;
  const original = new PerspectiveCamera();
  original.position.set(0, 0, 10);
  original.userData.rivSceneFreeView = true;
  const controls = { target: new Vector3(), saveState: vi.fn() };
  function Setup() {
    set = useThree((s) => s.set);
    React.useLayoutEffect(() => set({ camera: original, controls }), []);
    return null;
  }
  const r = await Renderer.create(
    <SceneRuntimeContext.Provider value={runtime}>
      <Setup />
      <SceneViewBridge />
    </SceneRuntimeContext.Provider>
  );
  const outgoing = new OrthographicCamera();
  outgoing.userData.rivSceneFreeView = true;
  outgoing.position.set(20, 30, 40);
  await act(async () => {
    set({ camera: outgoing });
    store.setState({ freeProjection: 'orthographic' });
  });
  await act(async () =>
    store.setState({ freeProjection: 'perspective', viewResetVersion: 1, viewResetAnimate: false })
  );
  original.position.set(9, 9, 9);
  await act(async () => set({ camera: original }));
  expect(original.position.toArray()).toEqual([0, 0, 10]);
  await r.unmount();
});
test('preserves controlled focus across a camera handover', async () => {
  const { store, runtime } = setup();
  runtime.orbitTarget = [2, 3, 4];
  let set: any;
  const controls = { target: new Vector3(), saveState: vi.fn() };
  function Setup() {
    set = useThree((s) => s.set);
    React.useLayoutEffect(() => set({ controls }), []);
    return null;
  }
  const r = await Renderer.create(
    <SceneRuntimeContext.Provider value={runtime}>
      <Setup />
      <SceneViewBridge />
    </SceneRuntimeContext.Provider>
  );
  expect(controls.target.toArray()).toEqual([2, 3, 4]);
  const next = new PerspectiveCamera();
  const nextControls = { target: new Vector3(0, 0, -1), saveState: vi.fn() };
  await act(async () => set({ camera: next, controls: nextControls }));
  expect(nextControls.target.toArray()).toEqual([2, 3, 4]);
  await r.unmount();
});
test('authored orthographic Home ignores live zoom on republication', async () => {
  const { store, runtime } = setup();
  runtime.cameraControls.mode = 'manifest';
  const ref: any = { current: null };
  const resource: any = { id: 'cam', type: 'OrthographicCamera', viewHeight: 8 };
  const matrix = new Matrix4().toArray();
  function tree(resource: any) {
    return (
      <SceneRuntimeContext.Provider value={runtime}>
        <CameraResource
          resource={resource}
          annotation={{} as any}
          target={{} as any}
          path="cam"
          matrix={matrix}
          state={{} as any}
          objectRef={ref}
          clock={{ time: 0, playing: false, playbackRate: 1 }}
          register={() => () => {}}
          setStatus={() => {}}
          activate={() => ({ ok: true, annotationIds: [] })}
          onDiagnostic={() => {}}
        />
      </SceneRuntimeContext.Provider>
    );
  }
  const r = await Renderer.create(tree(resource));
  expect(store.getState().homeViews['camera:cam'].view.viewHeight).toBe(8);
  ref.current.zoom = 2;
  await r.update(tree({ ...resource }));
  expect(store.getState().homeViews['camera:cam'].view.viewHeight).toBe(8);
  await r.unmount();
});
import { FreeViewCamera } from '../src/scene-panel/rendering-camera-rig';
test('actual FreeViewCamera projection round trip Home', async () => {
  const { store, runtime } = setup();
  let controller: any;
  runtime.registerViewController = (v: any) => {
    controller = v;
    return () => {};
  };
  const r = await Renderer.create(
    <SceneRuntimeContext.Provider value={runtime}>
      <FreeViewCamera active />
      <SceneViewBridge />
    </SceneRuntimeContext.Provider>
  );
  const home = store.getState().homeViews.free.view;
  await act(async () => controller.setView({ ...home, position: [20, 30, 40] }));
  await act(async () =>
    controller.setView({ ...home, projection: 'orthographic', position: [50, 60, 70], viewHeight: 12 })
  );
  expect(controller.getView().projection).toBe('orthographic');
  await act(async () =>
    store.setState({ freeProjection: home.projection, viewResetVersion: 1, viewResetAnimate: false })
  );
  expect(controller.getView().position).toEqual(home.position);
  expect(controller.getView().projection).toEqual(home.projection);
  await r.unmount();
});

test('applies an initial controlled focus when controls arrive late', async () => {
  const { runtime } = setup();
  runtime.orbitTarget = [2, 3, 4];
  let set: any;
  function Setup() {
    set = useThree((state) => state.set);
    return null;
  }
  const renderer = await Renderer.create(
    <SceneRuntimeContext.Provider value={runtime}>
      <Setup />
      <SceneViewBridge />
    </SceneRuntimeContext.Provider>
  );
  const controls = { target: new Vector3(), saveState: vi.fn() };
  await act(async () => set({ controls }));
  expect(controls.target.toArray()).toEqual([2, 3, 4]);
  await renderer.unmount();
});

test('user camera input interrupts a running Home transition', async () => {
  const { store, runtime } = setup();
  runtime.transitionDuration = 0.6;
  let camera: any;
  let controls!: AtlasOrbitControlsImpl;
  function Setup() {
    const set = useThree((state) => state.set);
    camera = useThree((state) => state.camera);
    React.useLayoutEffect(() => {
      controls = new AtlasOrbitControlsImpl(camera);
      set({ controls } as any);
    }, [set]);
    return null;
  }
  const renderer = await Renderer.create(
    <SceneRuntimeContext.Provider value={runtime}>
      <Setup />
      <SceneViewBridge />
    </SceneRuntimeContext.Provider>
  );
  camera.position.set(50, 60, 70);
  await act(async () => store.setState({ viewResetVersion: 1 }));
  await renderer.advanceFrames(3, 1 / 30);
  controls.dispatchEvent({ type: 'start' });
  camera.position.set(10, 20, 30);
  await renderer.advanceFrames(60, 1 / 30);
  expect(camera.position.toArray()).toEqual([10, 20, 30]);
  await renderer.unmount();
});
