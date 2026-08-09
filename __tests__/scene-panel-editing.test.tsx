/**
 * @vitest-environment happy-dom
 */

import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import { createSceneTransformMatrix } from '@iiif/helpers/scenes';
import { Vault4 } from '@iiif/helpers/vault-4';
import { Euler, Matrix4, OrthographicCamera, PerspectiveCamera, Vector3 } from 'three';
import { describe, expect, test, vi } from 'vitest';
import { SceneProvider, useSceneRuntime } from '../src/scene-panel/context';
import {
  applySceneView,
  applyFlyLookDelta,
  cameraInteractionNeedsContinuousFrames,
  captureSceneView,
  flyLookSpeed,
  frameCameraToBounds,
  sceneTransformValueFromMatrix,
  resolveCameraInteractionMode,
  setControlsTransforming,
  shouldShowSelectionOutline,
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

describe('ScenePanel editing API', () => {
  test('keeps Manifest camera behavior by default and allows fly-through override', () => {
    expect(resolveCameraInteractionMode('manifest', false, ['locked'])).toBe('locked');
    expect(resolveCameraInteractionMode('manifest', true, ['locked'])).toBe('orbit');
    expect(resolveCameraInteractionMode('fly', false, ['locked'])).toBe('fly');
    expect(shouldUseFreeViewCamera(true, false, false, 'manifest')).toBe(false);
    expect(shouldUseFreeViewCamera(true, false, false, 'fly')).toBe(true);
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
      <SceneProvider
        scene={scene}
        editing={{ enabled: true, mode: 'translate', selectedAnnotation: annotationId, onSelectAnnotation: onSelect }}
      >
        <Probe />
      </SceneProvider>
    );
    await waitFor(() => expect(runtime.store.getState().selectedAnnotation).toBe(annotationId));

    act(() => runtime.selectAnnotation(null));
    expect(onSelect).toHaveBeenLastCalledWith(null);
    expect(runtime.store.getState().selectedAnnotation).toBe(annotationId);

    view.rerender(
      <SceneProvider
        scene={scene}
        editing={{ enabled: true, mode: 'translate', selectedAnnotation: null, onSelectAnnotation: onSelect }}
      >
        <Probe />
      </SceneProvider>
    );
    await waitFor(() => expect(runtime.store.getState().selectedAnnotation).toBeNull());

    view.rerender(
      <SceneProvider scene={scene} editing={{ enabled: true, mode: 'translate', onSelectAnnotation: onSelect }}>
        <Probe />
      </SceneProvider>
    );
    act(() => runtime.selectAnnotation(annotationId));
    expect(runtime.store.getState().selectedAnnotation).toBe(annotationId);
    expect(onSelect).toHaveBeenLastCalledWith(expect.objectContaining({ id: annotationId, type: 'Annotation' }));
  });

  test('hides the selection outline when editing ends without clearing selection', () => {
    expect(shouldShowSelectionOutline(true, { enabled: true, showSelectionOutline: true })).toBe(true);
    expect(shouldShowSelectionOutline(true, { enabled: false, showSelectionOutline: true })).toBe(false);
    expect(shouldShowSelectionOutline(true, { enabled: true, showSelectionOutline: false })).toBe(false);
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

  test('returns canonical authored local TRS values after world-space manipulation', () => {
    const point = [10, 20, 30] as const;
    const local = new Matrix4().fromArray(
      createSceneTransformMatrix(
        [
          { type: 'ScaleTransform', x: 2, y: 3, z: 4 },
          { type: 'RotateTransform', x: 10, y: 20, z: 30 },
          { type: 'TranslateTransform', x: 1, y: 2, z: 3 },
        ],
        point
      )
    );
    const parentWorld = new Matrix4().makeRotationY(Math.PI / 3).setPosition(5, 6, 7);
    const manipulatedWorld = parentWorld.clone().multiply(local);
    const convertedLocal = parentWorld.clone().invert().multiply(manipulatedWorld);

    const value = sceneTransformValueFromMatrix(annotationId, convertedLocal, point);
    value.translation.forEach((component, index) => expect(component).toBeCloseTo(index + 1, 10));
    expect(value.rotation[0]).toBeCloseTo(10, 10);
    expect(value.rotation[1]).toBeCloseTo(20, 10);
    expect(value.rotation[2]).toBeCloseTo(30, 10);
    value.scale.forEach((component, index) => expect(component).toBeCloseTo(index + 2, 10));
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

  test('locks orbit controls during a drag and captures/applies both camera projections', () => {
    const controls = { enabled: true, target: new Vector3(1, 2, 3), saveState: vi.fn() };
    setControlsTransforming(controls, true);
    expect(controls.enabled).toBe(false);
    setControlsTransforming(controls, false);
    expect(controls.enabled).toBe(true);

    const perspective = new PerspectiveCamera(62, 2, 0.2, 800);
    perspective.position.set(4, 5, 6);
    perspective.rotation.set(0.1, 0.2, 0.3);
    perspective.updateMatrixWorld();
    expect(captureSceneView(perspective, controls.target)).toMatchObject({
      projection: 'perspective',
      position: [4, 5, 6],
      target: [1, 2, 3],
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
      viewHeight: 6,
      near: 0.5,
      far: 500,
    });
    expect(captureSceneView(orthographic, controls.target)).toMatchObject({
      projection: 'orthographic',
      position: [3, 4, 5],
      target: [0, 0, 0],
      viewHeight: 6,
      near: 0.5,
      far: 500,
    });

    frameCameraToBounds(perspective, controls, { min: [-2, -1, -3], max: [2, 3, 1], center: [0, 1, -1] }, 1.25);
    expect(controls.target.toArray()).toEqual([0, 1, -1]);
    expect(perspective.position.distanceTo(controls.target)).toBeGreaterThan(4);
  });

  test('keeps the orbit target and zoom range synchronized with edited resource bounds', () => {
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
