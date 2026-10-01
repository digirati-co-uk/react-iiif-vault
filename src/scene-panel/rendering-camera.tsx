import { OrthographicCamera, PerspectiveCamera } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import React, { useCallback, useContext, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Matrix4, Object3D, Quaternion, Vector3 } from 'three';
import { useSceneRuntime, useSceneStore } from './context';
import { ResourceBoundsContext } from './render-context';
import type { SceneResourceRendererProps, SceneResourceState } from './types';
import { applyLookAtPreservingRoll, resolveLookAtPoint } from './spatial-target';

export function shouldApplyAuthoredLookAt(
  camera: { position: Vector3; quaternion: Quaternion },
  active: boolean,
  position: readonly [number, number, number],
  quaternion: readonly [number, number, number, number]
) {
  return (
    !active ||
    (camera.position.distanceToSquared(new Vector3(...position)) < 1e-12 &&
      1 - Math.abs(camera.quaternion.dot(new Quaternion(...quaternion))) < 1e-8)
  );
}

export function CameraResource({
  resource,
  path,
  matrix,
  state,
  objectRef,
  decorate,
}: SceneResourceRendererProps & {
  objectRef: React.MutableRefObject<Object3D | null>;
  decorate?: (object: Object3D) => React.ReactNode;
}) {
  const runtime = useSceneRuntime();
  const refreshResourceBounds = runtime.refreshResourceBounds;
  const active = useSceneStore((state) => state.activeCamera === path);
  const freeViewActive = useSceneStore((state) => state.freeViewActive);
  const camera = useRef<any>(null);
  const [decoratedObject, setDecoratedObject] = useState<Object3D | null>(null);
  const setCameraRef = useCallback(
    (value: any) => {
      camera.current = value;
      objectRef.current = value;
      setDecoratedObject(value);
    },
    [objectRef]
  );
  const controls = useThree((state) => state.controls) as any;
  const sceneGraph = useThree((state) => state.scene);
  const boundsVersion = useContext(ResourceBoundsContext)?.version;
  const resetVersion = (state as SceneResourceState & { resetVersion?: number }).resetVersion;
  const aspect = useThree((state) => (state.size.height ? state.size.width / state.size.height : 1));
  const positive = (value: unknown, fallback: number) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  };
  const near = positive(resource.near, 0.1);
  const far = Math.max(near + 0.001, positive(resource.far, 2000));
  const matrixKey = matrix.join(',');
  const transform = useMemo(() => {
    const position = new Vector3();
    const quaternion = new Quaternion();
    new Matrix4().fromArray([...matrix]).decompose(position, quaternion, new Vector3());
    return {
      position: position.toArray() as [number, number, number],
      quaternion: quaternion.toArray() as [number, number, number, number],
    };
  }, [matrixKey]);
  const makeDefault = active && !freeViewActive && runtime.cameraControls.mode === 'manifest';
  useLayoutEffect(() => {
    if (!camera.current) return;
    objectRef.current = camera.current;
    setCameraResourceIds(camera.current, resource.id);
    camera.current.position.fromArray(transform.position);
    camera.current.quaternion.fromArray(transform.quaternion);
    camera.current.userData.rivLookAt = null;
    queueMicrotask(() => refreshResourceBounds(path));
    return () => {
      if (objectRef.current === camera.current) objectRef.current = null;
    };
  }, [objectRef, path, refreshResourceBounds, resetVersion, resource.id, transform]);
  useLayoutEffect(() => {
    if (!camera.current || !resource.lookAt) return;
    let mounted = true;
    const orient = () => {
      if (!mounted) return;
      const point = resolveLookAtPoint(resource.lookAt, runtime, sceneGraph);
      if (point && camera.current) {
        // Bounds changes retry unresolved lookAt references. Once the user
        // has moved an active camera, hydration must not restore its authored view.
        const applyLookAt = shouldApplyAuthoredLookAt(
          camera.current,
          makeDefault,
          transform.position,
          transform.quaternion
        );
        camera.current.userData.rivLookAt = [...point];
        if (applyLookAt) applyLookAtPreservingRoll(camera.current, point, transform.quaternion);
        if (makeDefault && applyLookAt) {
          controls?.target?.set(...point);
          controls?.saveState?.();
        }
      }
    };
    orient();
    queueMicrotask(orient);
    return () => {
      mounted = false;
    };
  }, [boundsVersion, controls, makeDefault, resetVersion, resource.lookAt, runtime, sceneGraph, transform]);
  const decoration = decoratedObject ? decorate?.(decoratedObject) : null;
  if (resource.type === 'OrthographicCamera') {
    const height = positive(resource.viewHeight, 2);
    return (
      <>
        <OrthographicCamera
          ref={setCameraRef}
          makeDefault={makeDefault}
          position={transform.position}
          quaternion={transform.quaternion}
          near={near}
          far={far}
          top={height / 2}
          bottom={-height / 2}
          left={(-height * aspect) / 2}
          right={(height * aspect) / 2}
        />
        {decoration}
      </>
    );
  }
  return (
    <>
      <PerspectiveCamera
        ref={setCameraRef}
        makeDefault={makeDefault}
        position={transform.position}
        quaternion={transform.quaternion}
        near={near}
        far={far}
        fov={Math.max(1, Math.min(179, positive(resource.fieldOfView, 50)))}
      />
      {decoration}
    </>
  );
}

export function setCameraResourceIds(camera: Object3D, resourceId: string) {
  camera.userData.iiifIds = [resourceId];
}

export { resolveLookAtReferenceId } from './spatial-target';
