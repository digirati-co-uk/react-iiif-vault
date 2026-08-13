import type { ScenePaintable } from '@iiif/helpers/scenes';
import { useFrame, useThree } from '@react-three/fiber';
import React, { useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AudioListener, Box3, Group, Matrix4, Object3D, Quaternion, Vector3 } from 'three';
import { useSceneRuntime, useSceneStore } from './context';
import { ResourceBoundsContext } from './render-context';
import type { SceneBounds } from './types';
import { syncOrbitTargetToBounds } from './rendering-camera-rig';

export function ResourceStatusLifecycle({ path, paintable }: { path: string; paintable: ScenePaintable }) {
  const { setResourceStatus, removeResourceStatus } = useSceneRuntime();
  useLayoutEffect(() => {
    setResourceStatus(path, {
      annotationId: paintable.annotationId,
      resourceId: paintable.resource.id,
      resourceType: paintable.rawType,
      status: 'loading',
    });
    return () => removeResourceStatus(path);
  }, [paintable.annotationId, paintable.rawType, paintable.resource.id, path, removeResourceStatus, setResourceStatus]);
  return null;
}

export function SceneAudioListener({ listener }: { listener: AudioListener }) {
  const camera = useThree((state) => state.camera);
  useEffect(() => {
    camera.add(listener);
    return () => {
      camera.remove(listener);
    };
  }, [camera, listener]);
  return null;
}

export function InitialSceneBounds({
  children,
  frame,
  padding,
  onBounds,
}: {
  children: React.ReactNode;
  frame: boolean;
  padding: number;
  onBounds(bounds: Box3): void;
}) {
  const group = useRef<any>(null);
  const camera = useThree((state) => state.camera);
  const controls = useThree((state) => state.controls) as any;
  const invalidate = useThree((state) => state.invalidate);
  const boundsVersion = useContext(ResourceBoundsContext)?.version;
  const ready = useSceneStore((state) => state.resourcesReady);
  const authoredCameraActive = useSceneStore((state) => !!state.activeCamera);
  const framed = useRef(false);
  const framedCamera = useRef<any>(null);
  const framedBounds = useRef<SceneBounds | null>(null);
  const syncedControls = useRef<any>(null);
  const center = useRef<Vector3 | null>(null);

  useLayoutEffect(
    () => () => {
      delete camera.userData.rivSceneFrameTarget;
    },
    [camera]
  );

  useLayoutEffect(() => {
    if (framedCamera.current !== camera) {
      if (!framedCamera.current?.userData?.rivSceneFreeView) framed.current = false;
      framedCamera.current = camera;
      framedBounds.current = null;
      syncedControls.current = null;
    }
    if (!frame || authoredCameraActive) {
      framed.current = false;
      framedBounds.current = null;
      syncedControls.current = null;
      delete camera.userData.rivSceneFrameTarget;
    }
    if (group.current) {
      group.current.updateWorldMatrix(true, true);
      const registeredBounds = group.current.children.length ? sceneBoundsFromObject(group.current) : null;
      const bounds = registeredBounds
        ? new Box3(new Vector3(...registeredBounds.min), new Vector3(...registeredBounds.max))
        : new Box3();
      if (registeredBounds) {
        onBounds(bounds);
        center.current = bounds.getCenter(new Vector3());
        if (ready && !framed.current) {
          const canFrame = frame && !authoredCameraActive;
          if (canFrame && (camera as any).isPerspectiveCamera) {
            framedBounds.current = registeredBounds;
            const size = bounds.getSize(new Vector3());
            const radius = Math.max(size.x, size.y, size.z);
            const vertical = radius / (2 * Math.tan((Math.PI * Number((camera as any).fov || 50)) / 360));
            const distance = padding * Math.max(vertical, vertical / Number((camera as any).aspect || 1));
            camera.position.set(center.current.x, center.current.y, center.current.z + distance);
            camera.lookAt(center.current);
            camera.userData.rivSceneFrameTarget = center.current.toArray();
            camera.near = Math.max(distance / 100, 0.001);
            camera.far = Math.max(distance * 100, 100);
            camera.updateProjectionMatrix();
          }
          framed.current = true;
        }
        const initialBounds = framedBounds.current;
        if (initialBounds && controls?.target && syncedControls.current !== controls) {
          syncOrbitTargetToBounds(camera, controls, initialBounds);
          syncedControls.current = controls;
        }
      } else if (ready) {
        framed.current = false;
        framedBounds.current = null;
        syncedControls.current = null;
        delete camera.userData.rivSceneFrameTarget;
      }
    }
    invalidate();
  }, [authoredCameraActive, boundsVersion, camera, controls, frame, invalidate, onBounds, padding, ready]);

  return <group ref={group}>{children}</group>;
}

export function StageBackground({
  floorY,
  floorColor,
  floorOpacity,
  gridColor,
  size,
}: {
  floorY: number;
  floorColor: string;
  floorOpacity: number;
  gridColor: string;
  size: number;
}) {
  return (
    <group position={[0, floorY, 0]} userData={{ rivSceneStage: true }}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[size, size]} />
        <meshBasicMaterial color={floorColor} transparent opacity={floorOpacity} depthWrite={false} />
      </mesh>
      <gridHelper
        args={[size, 20, gridColor, gridColor]}
        position={[0, 0.001, 0]}
        material-transparent
        material-opacity={0.32}
      />
    </group>
  );
}

export function ResourceTransform({
  matrix,
  children,
  objectRef,
  path,
  decorate,
}: {
  matrix: readonly number[];
  children: React.ReactNode;
  objectRef: React.MutableRefObject<Object3D | null>;
  path: string;
  decorate?: (object: Object3D) => React.ReactNode;
}) {
  const runtime = useSceneRuntime();
  const duration = runtime.transitionDuration;
  const invalidate = useThree((value) => value.invalidate);
  const group = useRef<Group | null>(null);
  const [decoratedObject, setDecoratedObject] = useState<Group | null>(null);
  const setGroup = useCallback(
    (value: Group | null) => {
      group.current = value;
      objectRef.current = value;
      setDecoratedObject(value);
    },
    [objectRef]
  );
  const initialized = useRef(false);
  const target = useMemo(() => {
    const position = new Vector3();
    const quaternion = new Quaternion();
    const scale = new Vector3();
    new Matrix4().fromArray([...matrix]).decompose(position, quaternion, scale);
    return { position, quaternion, scale };
  }, [matrix]);
  const transition = useRef<null | {
    elapsed: number;
    fromPosition: Vector3;
    toPosition: Vector3;
    fromQuaternion: Quaternion;
    toQuaternion: Quaternion;
    fromScale: Vector3;
    toScale: Vector3;
  }>(null);

  useLayoutEffect(() => {
    const object = group.current;
    if (!object) return;
    const unchanged =
      object.position.distanceToSquared(target.position) < 1e-12 &&
      object.scale.distanceToSquared(target.scale) < 1e-12 &&
      1 - Math.abs(object.quaternion.dot(target.quaternion)) < 1e-8;
    if (!initialized.current || !duration || unchanged) {
      object.position.copy(target.position);
      object.quaternion.copy(target.quaternion);
      object.scale.copy(target.scale);
      initialized.current = true;
      transition.current = null;
      invalidate();
      queueMicrotask(() => runtime.refreshResourceBounds(path));
      return;
    }
    transition.current = {
      elapsed: 0,
      fromPosition: object.position.clone(),
      toPosition: target.position.clone(),
      fromQuaternion: object.quaternion.clone(),
      toQuaternion: target.quaternion.clone(),
      fromScale: object.scale.clone(),
      toScale: target.scale.clone(),
    };
    invalidate();
  }, [duration, invalidate, target]);

  useFrame((_, delta) => {
    const value = transition.current;
    const object = group.current;
    if (!value || !object) return;
    value.elapsed = Math.min(duration, value.elapsed + Math.min(delta, 1 / 30));
    const progress = duration ? value.elapsed / duration : 1;
    const eased = progress * progress * (3 - 2 * progress);
    object.position.lerpVectors(value.fromPosition, value.toPosition, eased);
    object.quaternion.slerpQuaternions(value.fromQuaternion, value.toQuaternion, eased);
    object.scale.lerpVectors(value.fromScale, value.toScale, eased);
    if (progress === 1) {
      transition.current = null;
      runtime.refreshResourceBounds(path);
    } else invalidate();
  });

  return (
    <>
      <group ref={setGroup}>{children}</group>
      {decoratedObject ? decorate?.(decoratedObject) : null}
    </>
  );
}

export function sceneBoundsFromObject(
  object: Object3D | null,
  fallback?: readonly [number, number, number] | null
): SceneBounds | null {
  if (!object) return fallback ? sceneBoundsFromPoint(fallback) : null;
  object.updateWorldMatrix(true, true);
  const bounds = new Box3();
  object.traverse((child: any) => {
    for (let parent: Object3D | null = child; parent && parent !== object; parent = parent.parent) {
      if (parent.userData.rivSceneEditorHelper) return;
    }
    const geometry = child.geometry;
    if (!geometry) return;
    if (!geometry.boundingBox) geometry.computeBoundingBox();
    if (geometry.boundingBox) bounds.union(geometry.boundingBox.clone().applyMatrix4(child.matrixWorld));
  });
  if (bounds.isEmpty()) {
    const point = fallback
      ? new Vector3(...fallback).applyMatrix4(object.matrixWorld)
      : object.getWorldPosition(new Vector3());
    return sceneBoundsFromPoint(point.toArray());
  }
  const min = bounds.min.toArray();
  const max = bounds.max.toArray();
  return { min, max, center: bounds.getCenter(new Vector3()).toArray() };
}

function sceneBoundsFromPoint(point: readonly [number, number, number]): SceneBounds {
  const value = [...point] as [number, number, number];
  return { min: [...value], max: [...value], center: value };
}

export function ResourceVisibility({ visible, children }: { visible: boolean; children: React.ReactNode }) {
  const duration = useSceneRuntime().transitionDuration;
  const invalidate = useThree((value) => value.invalidate);
  const group = useRef<Group>(null);
  const amount = useRef(visible ? 1 : 0);
  const [mounted, setMounted] = useState(visible);
  useEffect(() => {
    if (visible) setMounted(true);
    invalidate();
  }, [invalidate, visible]);
  useFrame((_, delta) => {
    if (!mounted || amount.current === Number(visible)) return;
    const step = duration ? Math.min(delta, 1 / 30) / duration : 1;
    amount.current = visible ? Math.min(1, amount.current + step) : Math.max(0, amount.current - step);
    const eased = amount.current * amount.current * (3 - 2 * amount.current);
    group.current?.scale.setScalar(Math.max(eased, 0.0001));
    group.current?.traverse((object: any) => {
      if (!object.isLight) return;
      if (object.userData.rivSceneBaseIntensity === undefined) object.userData.rivSceneBaseIntensity = object.intensity;
      object.intensity = object.userData.rivSceneBaseIntensity * eased;
    });
    if (!visible && amount.current === 0) setMounted(false);
    else invalidate();
  });
  if (!mounted) return null;
  return (
    <group ref={group} scale={Math.max(amount.current, 0.0001)}>
      {children}
    </group>
  );
}

export function UnsupportedResource() {
  return (
    <mesh>
      <boxGeometry args={[0.25, 0.25, 0.25]} />
      <meshBasicMaterial color="#ff4d4f" wireframe />
    </mesh>
  );
}
