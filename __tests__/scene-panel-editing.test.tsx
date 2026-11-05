/**
 * @vitest-environment happy-dom
 */

import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import { Vault4 } from '@iiif/helpers/vault-4';
import { Euler, OrthographicCamera, PerspectiveCamera, Vector3 } from 'three';
import { describe, expect, test, vi } from 'vitest';
import { SceneProvider, useSceneRuntime } from '../src/scene-panel/context';
import {
  applySceneView,
  applyFlyLookDelta,
  cameraInteractionNeedsContinuousFrames,
  captureSceneView,
  flyLookSpeed,
  frameCameraToBounds,
  isSceneSelectionClick,
  resolveCameraInteractionMode,
  shouldUseFreeViewCamera,
  syncOrbitTargetToBounds,
  useCurrentScenePaintables,
} from '../src/scene-panel/rendering';

const annotationId = 'https://example.org/annotation/model';
const scene = {
  id: 'https://example.org/scene/editing',
  type: 'Scene',
  items: [
    {
      id: 'https://example.org/scene/editing/page',
      type: 'AnnotationPage',
      items: [
        {
          id: annotationId,
          type: 'Annotation',
          motivation: ['painting'],
          body: { id: 'https://example.org/model.glb', type: 'Model', format: 'model/gltf-binary' },
          target: 'https://example.org/scene/editing',
        },
      ],
    },
  ],
} as any;

describe('ScenePanel interaction API', () => {
  test('only treats short, near-stationary pointer gestures as selection clicks', () => {
    const down = { x: 100, y: 200, time: 1_000 };
    expect(isSceneSelectionClick(down, { x: 102, y: 201, time: 1_200 })).toBe(true);
    expect(isSceneSelectionClick(down, { x: 108, y: 200, time: 1_200 })).toBe(false);
    expect(isSceneSelectionClick(down, { x: 100, y: 200, time: 1_600 })).toBe(false);
  });

  test('keeps Manifest camera behavior by default and allows fly-through override', () => {
    expect(resolveCameraInteractionMode('manifest', false, ['locked'])).toBe('locked');
    expect(resolveCameraInteractionMode('manifest', true, ['locked'])).toBe('orbit');
    expect(resolveCameraInteractionMode('fly', false, ['locked'])).toBe('fly');
    expect(shouldUseFreeViewCamera(true, false, 'manifest')).toBe(false);
    expect(shouldUseFreeViewCamera(true, false, 'fly')).toBe(true);
    expect(cameraInteractionNeedsContinuousFrames('fly')).toBe(true);
    expect(cameraInteractionNeedsContinuousFrames('free')).toBe(true);
    expect(cameraInteractionNeedsContinuousFrames('orbit')).toBe(false);
    expect(flyLookSpeed(0.5, true)).toBe(0.5);
    expect(flyLookSpeed(0.5, false)).toBe(-0.5);
  });

  test('applies fly look as direct pointer deltas and respects inversion', () => {
    const camera = new PerspectiveCamera();
    applyFlyLookDelta(camera, 100, 50, flyLookSpeed(0.005, true));
    const inverted = new Euler().setFromQuaternion(camera.quaternion, 'YXZ');
    expect(inverted.y).toBeCloseTo(0.5);
    expect(inverted.x).toBeCloseTo(0.25);

    camera.quaternion.identity();
    applyFlyLookDelta(camera, 100, 50, flyLookSpeed(0.005, false));
    const normal = new Euler().setFromQuaternion(camera.quaternion, 'YXZ');
    expect(normal.y).toBeCloseTo(-0.5);
    expect(normal.x).toBeCloseTo(-0.25);
  });

  test('keeps controlled selection authoritative while emitting hydrated Annotations', async () => {
    let runtime!: ReturnType<typeof useSceneRuntime>;
    const onSelect = vi.fn();
    function Probe() {
      runtime = useSceneRuntime();
      return <span>{runtime.store.getState().selectedAnnotation || 'none'}</span>;
    }

    const view = render(
      <SceneProvider scene={scene} selectedAnnotation={annotationId} onSelectAnnotation={onSelect}>
        <Probe />
      </SceneProvider>
    );
    await waitFor(() => expect(runtime.store.getState().selectedAnnotation).toBe(annotationId));

    act(() => runtime.selectAnnotation(null));
    expect(onSelect).toHaveBeenLastCalledWith(null);
    expect(runtime.store.getState().selectedAnnotation).toBe(annotationId);

    view.rerender(
      <SceneProvider scene={scene} selectedAnnotation={null} onSelectAnnotation={onSelect}>
        <Probe />
      </SceneProvider>
    );
    await waitFor(() => expect(runtime.store.getState().selectedAnnotation).toBeNull());

    view.rerender(
      <SceneProvider scene={scene} onSelectAnnotation={onSelect}>
        <Probe />
      </SceneProvider>
    );
    act(() => runtime.selectAnnotation(annotationId));
    expect(runtime.store.getState().selectedAnnotation).toBe(annotationId);
    expect(onSelect).toHaveBeenLastCalledWith(expect.objectContaining({ id: annotationId, type: 'Annotation' }));

    view.rerender(
      <SceneProvider scene={scene} selectedAnnotation={annotationId} onSelectAnnotation={onSelect}>
        <Probe />
      </SceneProvider>
    );
    await waitFor(() => expect(runtime.store.getState().selectedAnnotation).toBe(annotationId));
    view.rerender(
      <SceneProvider scene={scene} onSelectAnnotation={onSelect}>
        <Probe />
      </SceneProvider>
    );
    await waitFor(() => expect(runtime.store.getState().selectedAnnotation).toBeNull());
  });

  test('unifies registered bounds, framing, and resource status by Annotation ID', async () => {
    let runtime!: ReturnType<typeof useSceneRuntime>;
    const onStatus = vi.fn();
    function Probe() {
      runtime = useSceneRuntime();
      return <span>ready</span>;
    }
    render(
      <SceneProvider scene={scene} onResourceStatusChange={onStatus}>
        <Probe />
      </SceneProvider>
    );
    await screen.findByText('ready');
    const bounds = {
      min: [-1, 0, 2] as [number, number, number],
      max: [3, 4, 6] as [number, number, number],
      center: [1, 2, 4] as [number, number, number],
    };
    const unregister = runtime.register({
      path: 'model-path',
      ids: [annotationId, 'https://example.org/model.glb'],
      type: 'model',
      annotationId,
      resourceId: 'https://example.org/model.glb',
      resourceType: 'Model',
      getBoundingBox: () => bounds,
    });
    const frame = vi.fn();
    const unregisterView = runtime.registerViewController({
      getView: () => runtime.handle().getView(),
      setView: vi.fn(),
      frame,
    });

    expect(runtime.handle().getAnnotationBounds(annotationId)).toEqual(bounds);
    expect(runtime.resolvePoint(annotationId)).toEqual([1, 2, 4]);
    bounds.center = [8, 9, 10];
    expect(runtime.resolvePoint(annotationId)).toEqual([8, 9, 10]);
    bounds.center = [1, 2, 4];
    runtime.handle().frameAnnotation(annotationId, { padding: 1.5 });
    runtime.handle().frameAll();
    expect(frame).toHaveBeenNthCalledWith(1, bounds, { padding: 1.5 });
    expect(frame).toHaveBeenNthCalledWith(2, bounds, undefined);
    await waitFor(() =>
      expect(onStatus).toHaveBeenLastCalledWith([
        expect.objectContaining({
          annotationId,
          resourceType: 'Model',
          status: 'ready',
          bounds: { min: bounds.min, max: bounds.max },
        }),
      ])
    );
    unregisterView();
    unregister();
  });

  test('reports sibling bodies separately and frames only frameable resources', async () => {
    let runtime!: ReturnType<typeof useSceneRuntime>;
    const onStatus = vi.fn();
    function Probe() {
      runtime = useSceneRuntime();
      return <span>status-ready</span>;
    }
    render(
      <SceneProvider scene={scene} onResourceStatusChange={onStatus}>
        <Probe />
      </SceneProvider>
    );
    await screen.findByText('status-ready');
    const modelBounds = {
      min: [-1, -1, -1] as [number, number, number],
      max: [1, 1, 1] as [number, number, number],
      center: [0, 0, 0] as [number, number, number],
    };
    const first = runtime.register({
      path: 'body/one',
      ids: [annotationId, 'body-one'],
      annotationId,
      resourceId: 'body-one',
      resourceType: 'Model',
      type: 'model',
      frameable: true,
      getBoundingBox: () => modelBounds,
    });
    const second = runtime.register({
      path: 'body/two',
      ids: [annotationId, 'body-two'],
      annotationId,
      resourceId: 'body-two',
      resourceType: 'PointLight',
      type: 'point-light',
      frameable: false,
      getBounds: () => [10_000, 0, 0],
    });
    await waitFor(() =>
      expect(onStatus).toHaveBeenLastCalledWith([
        expect.objectContaining({ resourceId: 'body-one' }),
        expect.objectContaining({ resourceId: 'body-two' }),
      ])
    );
    const frame = vi.fn();
    const unregisterView = runtime.registerViewController({
      getView: runtime.handle().getView,
      setView: vi.fn(),
      frame,
    });
    runtime.handle().frameAll();
    expect(frame).toHaveBeenCalledWith(modelBounds, undefined);
    unregisterView();
    second();
    first();
  });

  test('keeps global, instance, and renderer selection in sync', async () => {
    let runtime!: ReturnType<typeof useSceneRuntime>;
    function Probe() {
      runtime = useSceneRuntime();
      return <span>selection-ready</span>;
    }
    render(
      <SceneProvider scene={scene}>
        <Probe />
      </SceneProvider>
    );
    await screen.findByText('selection-ready');
    const unregisterA = runtime.register({ path: 'instance/a', ids: [annotationId], annotationId, type: 'model' });
    const unregisterB = runtime.register({ path: 'instance/b', ids: [annotationId], annotationId, type: 'model' });

    act(() => runtime.selectAnnotation({ id: annotationId, path: 'instance/b' }));
    expect(runtime.store.getState()).toMatchObject({
      selectedAnnotation: annotationId,
      selectedAnnotationPath: 'instance/b',
      resources: { 'instance/a': { selected: false }, 'instance/b': { selected: true } },
    });
    expect(runtime.handle().getSnapshot()).toMatchObject({
      selectedAnnotation: annotationId,
      selectedAnnotationPath: 'instance/b',
      resources: { 'instance/a': { selected: false }, 'instance/b': { selected: true } },
    });
    act(() => runtime.selectAnnotation(null));
    expect(runtime.store.getState().resources['instance/b'].selected).toBe(false);
    unregisterB();
    unregisterA();
  });

  test('applies selectCamera to the renderer-owned override view', async () => {
    let runtime!: ReturnType<typeof useSceneRuntime>;
    function Probe() {
      runtime = useSceneRuntime();
      return <span>camera-override-ready</span>;
    }
    render(
      <SceneProvider scene={scene} cameraControls={{ mode: 'orbit' }}>
        <Probe />
      </SceneProvider>
    );
    await screen.findByText('camera-override-ready');
    const view = {
      projection: 'perspective' as const,
      position: [0, 0, 12] as [number, number, number],
      rotation: [0, 0, 0] as [number, number, number],
      target: [0, 0, 0] as [number, number, number],
      fieldOfView: 42,
      near: 0.2,
      far: 900,
    };
    const unregister = runtime.register({
      path: 'camera/path',
      ids: ['camera-id'],
      type: 'perspective-camera',
      getView: () => view,
    });
    const setView = vi.fn();
    const unregisterView = runtime.registerViewController({ getView: () => view, setView, frame: vi.fn() });
    act(() => runtime.selectCamera('camera-id'));
    expect(setView).toHaveBeenCalledWith(view);
    expect(runtime.store.getState()).toMatchObject({ activeCamera: 'camera/path', freeViewActive: true });
    unregisterView();
    unregister();
  });

  test('reacts to Vault-authored transform updates without remounting the Scene provider', async () => {
    const vault = new Vault4();
    const mounted = vi.fn();
    function TransformProbe() {
      const { paintables } = useCurrentScenePaintables();
      React.useEffect(() => {
        mounted();
      }, []);
      const translation = paintables.items[0]?.bodyTransform.find(
        (transform) => transform.type === 'TranslateTransform'
      );
      return <span>translation:{translation?.x || 0}</span>;
    }
    render(
      <SceneProvider vault={vault} scene={scene}>
        <TransformProbe />
      </SceneProvider>
    );
    await screen.findByText('translation:0');

    act(() => {
      vault.modifyEntityField({ id: 'https://example.org/model.glb', type: 'ContentResource' } as any, 'transform', [
        { type: 'TranslateTransform', x: 9, y: 8, z: 7 },
      ]);
    });

    await screen.findByText('translation:9');
    expect(mounted).toHaveBeenCalledOnce();
  });

  test('captures and applies both camera projections', () => {
    const controls = { enabled: true, target: new Vector3(1, 2, 3), saveState: vi.fn() };
    const perspective = new PerspectiveCamera(62, 2, 0.2, 800);
    perspective.position.set(4, 5, 6);
    perspective.rotation.set(0.1, 0.2, 0.3);
    perspective.updateMatrixWorld();
    expect(captureSceneView(perspective, controls.target)).toMatchObject({
      projection: 'perspective',
      position: [4, 5, 6],
      target: [1, 2, 3],
      up: [0, 1, 0],
      fieldOfView: 62,
      near: 0.2,
      far: 800,
    });

    const orthographic = new OrthographicCamera(-2, 2, 1, -1, 0.1, 100);
    applySceneView(orthographic, controls, {
      projection: 'orthographic',
      position: [3, 4, 5],
      rotation: [10, 20, 30],
      target: [0, 0, 0],
      up: [0, 0, 1],
      viewHeight: 6,
      near: 0.5,
      far: 500,
    });
    expect(captureSceneView(orthographic, controls.target)).toMatchObject({
      projection: 'orthographic',
      position: [3, 4, 5],
      target: [0, 0, 0],
      up: [0, 0, 1],
      viewHeight: 6,
      near: 0.5,
      far: 500,
    });

    frameCameraToBounds(perspective, controls, { min: [-2, -1, -3], max: [2, 3, 1], center: [0, 1, -1] }, 1.25);
    expect(controls.target.toArray()).toEqual([0, 1, -1]);
    expect(perspective.position.distanceTo(controls.target)).toBeGreaterThan(4);
  });

  test('sets the orbit target and zoom range when explicitly synchronized', () => {
    const camera = new PerspectiveCamera(50, 1, 0.1, 1000);
    camera.position.set(0, 0, 5);
    const controls = { target: new Vector3(), maxDistance: 0, saveState: vi.fn() };

    syncOrbitTargetToBounds(camera, controls, { min: [8, -2, -2], max: [12, 2, 2], center: [10, 0, 0] });
    expect(controls.target.toArray()).toEqual([10, 0, 0]);
    expect(controls.maxDistance).toBeGreaterThan(100);

    syncOrbitTargetToBounds(camera, controls, { min: [-6, 0, -1], max: [-2, 4, 3], center: [-4, 2, 1] });
    expect(controls.target.toArray()).toEqual([-4, 2, 1]);
    expect(controls.maxDistance).toBeGreaterThan(50);
    expect(controls.saveState).toHaveBeenCalledTimes(2);
  });
});
