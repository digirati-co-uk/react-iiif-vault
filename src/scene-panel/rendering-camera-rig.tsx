import {
  FirstPersonControls,
  FlyControls,
  OrthographicCamera,
  PerspectiveCamera,
  PointerLockControls,
} from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import React, { useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { Euler, Quaternion, Vector3 } from 'three';
import { useSceneRuntime, useSceneStore } from './context';
import type { SceneBounds, SceneView } from './types';
import { AtlasOrbitControls, cameraOrbitTarget } from './atlas-orbit-controls';
import { ContinuousFramesContext } from './render-context';

function degreesToRadians(value: number) {
  return (value * Math.PI) / 180;
}

function radiansToDegrees(value: number) {
  return (value * 180) / Math.PI;
}

export function FreeViewCamera({ active }: { active: boolean }) {
  const projection = useSceneStore((state) => state.freeProjection);
  const freeViewActive = useSceneStore((state) => state.freeViewActive);
  const authoredCameraActive = useSceneStore((state) => !!state.activeCamera && !state.freeViewActive);
  const runtime = useSceneRuntime();
  const camera = useThree((state) => state.camera) as any;
  const controls = useThree((state) => state.controls) as any;
  const aspect = useThree((state) => (state.size.height ? state.size.width / state.size.height : 1));
  const lastAuthoredView = useRef<SceneView>(captureSceneView(camera, controls?.target));
  if (!camera.userData.rivSceneFreeView) lastAuthoredView.current = captureSceneView(camera, controls?.target);
  const view = lastAuthoredView.current;
  const enabled = active && !(authoredCameraActive && runtime.cameraControls.mode === 'manifest');
  const activeProjection = enabled && !camera.userData.rivSceneFreeView ? view.projection : projection;
  const quaternion = useMemo(
    () =>
      new Quaternion()
        .setFromEuler(new Euler(...(view.rotation.map(degreesToRadians) as [number, number, number]), 'ZYX'))
        .toArray(),
    [view]
  );
  const viewHeight = view.viewHeight || 2;
  useLayoutEffect(() => {
    if (!enabled) return;
    if (projection !== view.projection) runtime.store.setState({ freeProjection: view.projection });
    if (authoredCameraActive || freeViewActive) {
      controls?.target?.fromArray(view.target);
      controls?.saveState?.();
    }
  }, [authoredCameraActive, controls, enabled, freeViewActive, projection, runtime.store, view]);
  return (
    <>
      <PerspectiveCamera
        makeDefault={enabled && activeProjection === 'perspective'}
        userData={{ rivSceneFreeView: true }}
        position={view.position}
        quaternion={quaternion}
        up={view.up}
        near={view.near}
        far={view.far}
        fov={view.fieldOfView || 50}
      />
      <OrthographicCamera
        makeDefault={enabled && activeProjection === 'orthographic'}
        userData={{ rivSceneFreeView: true, rivViewHeight: viewHeight }}
        position={view.position}
        quaternion={quaternion}
        up={view.up}
        near={view.near}
        far={view.far}
        top={viewHeight / 2}
        bottom={-viewHeight / 2}
        left={(-viewHeight * aspect) / 2}
        right={(viewHeight * aspect) / 2}
      />
    </>
  );
}

export function CameraInteraction() {
  const runtime = useSceneRuntime();
  const cameraZoom = runtime.cameraZoom;
  const acquireContinuousFrames = useContext(ContinuousFramesContext);
  const camera = useThree((state) => state.camera);
  const flyElement = useThree((state) => state.events.connected || state.gl.domElement) as HTMLElement;
  const invalidate = useThree((state) => state.invalidate);
  const freeView = useSceneStore((state) => state.freeViewActive);
  const active = useSceneStore((state) => (state.activeCamera ? state.resources[state.activeCamera] : null));
  const resetVersion = useSceneStore((state) => state.viewResetVersion);
  const controls = useRef<any>(null);
  useEffect(() => controls.current?.reset?.(), [resetVersion]);
  const mode = resolveCameraInteractionMode(
    runtime.cameraControls.mode,
    freeView,
    active?.interactionMode ||
      (!freeView && Array.isArray(runtime.scene.interactionMode) ? runtime.scene.interactionMode : [])
  );
  useLayoutEffect(() => {
    if (cameraInteractionNeedsContinuousFrames(mode)) return acquireContinuousFrames();
  }, [acquireContinuousFrames, mode]);
  useEffect(() => {
    if (mode !== 'fly' || !flyElement) return;
    let previous: [number, number] | null = null;
    const down = (event: PointerEvent) => {
      if (event.button === 0) previous = [event.clientX, event.clientY];
    };
    const move = (event: PointerEvent) => {
      if (!previous) {
        if (!runtime.cameraControls.dragToLook) previous = [event.clientX, event.clientY];
        return;
      }
      const deltaX = event.clientX - previous[0];
      const deltaY = event.clientY - previous[1];
      previous = [event.clientX, event.clientY];
      applyFlyLookDelta(
        camera,
        deltaX,
        deltaY,
        flyLookSpeed(runtime.cameraControls.lookSpeed, runtime.cameraControls.invertLook)
      );
      invalidate();
    };
    const up = () => {
      previous = null;
    };
    const moveTarget = runtime.cameraControls.dragToLook ? flyElement.ownerDocument : flyElement;
    flyElement.addEventListener('pointerdown', down);
    moveTarget.addEventListener('pointermove', move as EventListener);
    moveTarget.addEventListener('pointerup', up);
    moveTarget.addEventListener('pointercancel', up);
    if (!runtime.cameraControls.dragToLook) flyElement.addEventListener('pointerleave', up);
    return () => {
      flyElement.removeEventListener('pointerdown', down);
      moveTarget.removeEventListener('pointermove', move as EventListener);
      moveTarget.removeEventListener('pointerup', up);
      moveTarget.removeEventListener('pointercancel', up);
      flyElement.removeEventListener('pointerleave', up);
    };
  }, [camera, flyElement, invalidate, mode, runtime.cameraControls]);
  if (!freeView && active?.disabled) return null;
  if (mode === 'locked') return null;
  if (mode === 'fly')
    return (
      <FlyControls
        ref={controls}
        makeDefault
        movementSpeed={runtime.cameraControls.movementSpeed}
        rollSpeed={0}
        dragToLook={runtime.cameraControls.dragToLook}
        autoForward={runtime.cameraControls.autoForward}
      />
    );
  if (mode === 'free') return <FirstPersonControls ref={controls} makeDefault />;
  if (mode === 'free-direction') return <PointerLockControls ref={controls} />;
  return (
    <AtlasOrbitControls
      ref={controls}
      makeDefault
      cameraZoom={cameraZoom}
      minPolarAngle={mode === 'hemisphere-orbit' ? 0 : undefined}
      maxPolarAngle={mode === 'hemisphere-orbit' ? Math.PI / 2 : undefined}
    />
  );
}

export function flyLookSpeed(speed: number, inverted: boolean) {
  return inverted ? speed : -speed;
}

export function applyFlyLookDelta(camera: { quaternion: Quaternion }, x: number, y: number, speed: number) {
  const rotation = new Euler().setFromQuaternion(camera.quaternion, 'YXZ');
  const verticalLimit = Math.PI / 2 - 0.001;
  rotation.y += x * speed;
  rotation.x = Math.max(-verticalLimit, Math.min(verticalLimit, rotation.x + y * speed));
  camera.quaternion.setFromEuler(rotation);
}

export function cameraInteractionNeedsContinuousFrames(mode: string) {
  return mode === 'fly' || mode === 'free';
}

export function resolveCameraInteractionMode(
  override: 'manifest' | 'orbit' | 'fly',
  freeView: boolean,
  authoredModes: readonly string[]
) {
  if (override === 'fly') return 'fly';
  if (override === 'orbit' || freeView) return 'orbit';
  return (
    authoredModes.find((value) => ['locked', 'orbit', 'hemisphere-orbit', 'free', 'free-direction'].includes(value)) ||
    'orbit'
  );
}

export function shouldUseFreeViewCamera(
  hasAuthoredCamera: boolean,
  freeViewActive: boolean,
  override: 'manifest' | 'orbit' | 'fly'
) {
  return !hasAuthoredCamera || freeViewActive || override !== 'manifest';
}

export function SceneViewBridge() {
  const runtime = useSceneRuntime();
  const camera = useThree((state) => state.camera) as any;
  const controls = useThree((state) => state.controls) as any;
  const invalidate = useThree((state) => state.invalidate);
  const projection = useSceneStore((state) => state.freeProjection);
  const resourcesReady = useSceneStore((state) => state.resourcesReady);
  const orbitTargetId = typeof runtime.orbitTarget === 'string' ? runtime.orbitTarget : undefined;
  const orbitTargetX = typeof runtime.orbitTarget === 'string' ? undefined : runtime.orbitTarget?.[0];
  const orbitTargetY = typeof runtime.orbitTarget === 'string' ? undefined : runtime.orbitTarget?.[1];
  const orbitTargetZ = typeof runtime.orbitTarget === 'string' ? undefined : runtime.orbitTarget?.[2];
  const pendingView = useRef<{ view: SceneView; transition: boolean } | null>(null);
  const pendingFrame = useRef<{ bounds: SceneBounds; padding: number } | null>(null);
  const transition = useRef<{
    elapsed: number;
    duration: number;
    fromPosition: Vector3;
    toPosition: Vector3;
    fromQuaternion: Quaternion;
    toQuaternion: Quaternion;
    fromTarget: Vector3;
    toTarget: Vector3;
  } | null>(null);

  useLayoutEffect(() => {
    if (!controls?.target || runtime.cameraControls.mode === 'fly') return;
    const target = orbitTargetId
      ? resourcesReady
        ? runtime.resolvePoint(orbitTargetId)
        : null
      : orbitTargetX === undefined || orbitTargetY === undefined || orbitTargetZ === undefined
        ? null
        : ([orbitTargetX, orbitTargetY, orbitTargetZ] as const);
    if (!target) return;
    const toTarget = new Vector3(...target);
    if (runtime.transitionDuration) {
      const targetCamera = camera.clone();
      targetCamera.lookAt(toTarget);
      transition.current = {
        elapsed: 0,
        duration: runtime.transitionDuration,
        fromPosition: camera.position.clone(),
        toPosition: camera.position.clone(),
        fromQuaternion: camera.quaternion.clone(),
        toQuaternion: targetCamera.quaternion.clone(),
        fromTarget: controls.target.clone(),
        toTarget,
      };
    } else {
      transition.current = null;
      controls.target.copy(toTarget);
      camera.lookAt(controls.target);
      camera.updateMatrixWorld();
      controls.saveState?.();
    }
    invalidate();
  }, [
    camera,
    controls,
    invalidate,
    orbitTargetId,
    orbitTargetX,
    orbitTargetY,
    orbitTargetZ,
    resourcesReady,
    runtime.cameraControls.mode,
    runtime.resolvePoint,
    runtime.transitionDuration,
  ]);

  const setView = useCallback(
    (view: SceneView, options?: { transition?: boolean }) => {
      runtime.store.setState({ freeViewActive: true, freeProjection: view.projection });
      const rendererControlled = camera.userData.rivSceneFreeView || camera.userData.rivSceneCustomView;
      if (
        (view.projection === 'perspective' && !(camera as any).isPerspectiveCamera) ||
        (view.projection === 'orthographic' && !(camera as any).isOrthographicCamera) ||
        !rendererControlled
      ) {
        pendingView.current = { view, transition: options?.transition === true };
        return;
      }
      if (options?.transition) {
        const target = new Vector3(...view.target);
        transition.current = {
          elapsed: 0,
          duration: runtime.transitionDuration || 0.6,
          fromPosition: camera.position.clone(),
          toPosition: new Vector3(...view.position),
          fromQuaternion: camera.quaternion.clone(),
          toQuaternion: new Quaternion().setFromEuler(
            new Euler(...(view.rotation.map(degreesToRadians) as [number, number, number]), 'ZYX')
          ),
          fromTarget: controls?.target?.clone?.() || cameraOrbitTarget(camera),
          toTarget: target,
        };
        applySceneView(camera, controls, {
          ...view,
          position: camera.position.toArray(),
          rotation: captureRotation(camera),
        });
        invalidate();
      } else {
        transition.current = null;
        applySceneView(camera, controls, view);
        invalidate();
      }
    },
    [camera, controls, invalidate, runtime]
  );
  const frame = useCallback(
    (bounds: SceneBounds, options?: { padding?: number }) => {
      const padding = Math.max(1, options?.padding ?? 1.25);
      runtime.store.setState({ freeViewActive: true });
      if (!camera.userData.rivSceneFreeView && !camera.userData.rivSceneCustomView) {
        pendingFrame.current = { bounds, padding };
        return;
      }
      frameCameraToBounds(camera, controls, bounds, padding);
      invalidate();
    },
    [camera, controls, invalidate, runtime.store]
  );

  useLayoutEffect(() => {
    const rendererControlled = camera.userData.rivSceneFreeView || camera.userData.rivSceneCustomView;
    if (pendingView.current && rendererControlled) {
      const pending = pendingView.current;
      pendingView.current = null;
      setView(pending.view, { transition: pending.transition });
    }
    if (pendingFrame.current && rendererControlled) {
      const pending = pendingFrame.current;
      pendingFrame.current = null;
      frameCameraToBounds(camera, controls, pending.bounds, pending.padding);
      invalidate();
    }
  }, [camera, controls, invalidate, projection, setView]);

  useEffect(
    () =>
      runtime.registerViewController({
        getView: () => captureSceneView(camera, controls?.target),
        setView,
        frame,
      }),
    [camera, controls, frame, runtime, setView]
  );

  useFrame((_, delta) => {
    const value = transition.current;
    if (!value) return;
    value.elapsed = Math.min(value.duration, value.elapsed + Math.min(delta, 1 / 30));
    const progress = value.duration ? value.elapsed / value.duration : 1;
    const eased = progress * progress * (3 - 2 * progress);
    camera.position.lerpVectors(value.fromPosition, value.toPosition, eased);
    camera.quaternion.slerpQuaternions(value.fromQuaternion, value.toQuaternion, eased);
    controls?.target?.lerpVectors(value.fromTarget, value.toTarget, eased);
    if (progress === 1) {
      transition.current = null;
      controls?.saveState?.();
    } else invalidate();
  });
  return null;
}

export function captureSceneView(camera: any, target?: Vector3 | readonly [number, number, number]): SceneView {
  const resolvedTarget = target
    ? target instanceof Vector3
      ? target
      : new Vector3(...target)
    : cameraOrbitTarget(camera);
  const view: SceneView = {
    projection: camera.isOrthographicCamera ? 'orthographic' : 'perspective',
    position: camera.getWorldPosition(new Vector3()).toArray(),
    rotation: captureRotation(camera),
    target: resolvedTarget.toArray(),
    up: camera.up.toArray(),
    near: Number(camera.near),
    far: Number(camera.far),
  };
  if (camera.isOrthographicCamera)
    view.viewHeight = Number(camera.userData.rivViewHeight || (camera.top - camera.bottom) / camera.zoom);
  else view.fieldOfView = Number(camera.fov);
  return view;
}

function captureRotation(camera: any): [number, number, number] {
  const rotation = new Euler().setFromQuaternion(camera.getWorldQuaternion(new Quaternion()), 'ZYX');
  return [rotation.x, rotation.y, rotation.z].map(radiansToDegrees) as [number, number, number];
}

export function applySceneView(camera: any, controls: any, view: SceneView) {
  camera.position.fromArray(view.position);
  camera.rotation.set(...(view.rotation.map(degreesToRadians) as [number, number, number]), 'ZYX');
  if (view.up) camera.up.fromArray(view.up);
  camera.near = Math.max(0.0001, view.near);
  camera.far = Math.max(camera.near + 0.0001, view.far);
  if (camera.isPerspectiveCamera && view.fieldOfView !== undefined) camera.fov = view.fieldOfView;
  if (camera.isOrthographicCamera && view.viewHeight !== undefined) {
    const aspect = Math.abs((camera.right - camera.left) / (camera.top - camera.bottom)) || 1;
    camera.top = view.viewHeight / 2;
    camera.bottom = -view.viewHeight / 2;
    camera.left = (-view.viewHeight * aspect) / 2;
    camera.right = (view.viewHeight * aspect) / 2;
    camera.zoom = 1;
    camera.userData.rivViewHeight = view.viewHeight;
  }
  controls?.target?.fromArray(view.target);
  controls?.saveState?.();
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
}

export function frameCameraToBounds(camera: any, controls: any, bounds: SceneBounds, padding = 1.25) {
  const center = new Vector3(...bounds.center);
  const size = new Vector3().subVectors(new Vector3(...bounds.max), new Vector3(...bounds.min));
  const aspect = camera.isPerspectiveCamera
    ? Number(camera.aspect || 1)
    : Math.abs((camera.right - camera.left) / (camera.top - camera.bottom)) || 1;
  const oldTarget = controls?.target || cameraOrbitTarget(camera);
  const direction = camera.position.clone().sub(oldTarget).normalize();
  if (!direction.lengthSq()) direction.set(0, 0, 1);
  if (camera.isOrthographicCamera) {
    const height = Math.max(size.y, size.x / aspect, 0.001) * padding;
    const distance = Math.max(camera.position.distanceTo(oldTarget), size.length(), 1);
    camera.position.copy(center).addScaledVector(direction, distance);
    camera.top = height / 2;
    camera.bottom = -height / 2;
    camera.left = (-height * aspect) / 2;
    camera.right = (height * aspect) / 2;
    camera.zoom = 1;
    camera.userData.rivViewHeight = height;
  } else {
    const vertical = Math.max(degreesToRadians(Number(camera.fov || 50)), 0.001);
    const distance =
      padding * Math.max(size.y / (2 * Math.tan(vertical / 2)), size.x / (2 * Math.tan(vertical / 2) * aspect), 0.5);
    camera.position.copy(center).addScaledVector(direction, distance);
    camera.near = Math.max(distance / 100, 0.001);
    camera.far = Math.max(distance * 100, 100);
  }
  camera.lookAt(center);
  controls?.target?.copy(center);
  controls?.saveState?.();
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
}

export function syncOrbitTargetToBounds(camera: any, controls: any, bounds: SceneBounds) {
  if (!controls?.target) return;
  const center = new Vector3(...bounds.center);
  const extent = new Vector3().subVectors(new Vector3(...bounds.max), new Vector3(...bounds.min)).length();
  controls.target.copy(center);
  controls.maxDistance = Math.max(camera.position.distanceTo(center), extent, 0.001) * 10;
  controls.saveState?.();
}

export function CameraTransition() {
  const duration = useSceneRuntime().transitionDuration;
  const activePath = useSceneStore((state) => state.activeCamera);
  const camera = useThree((state) => state.camera) as any;
  const controls = useThree((state) => state.controls) as any;
  const invalidate = useThree((state) => state.invalidate);
  const previousCamera = useRef<any>(camera);
  const previousPath = useRef<string | null>(activePath);
  const previousTarget = useRef(new Vector3());
  const transition = useRef<null | {
    elapsed: number;
    fromPosition: Vector3;
    toPosition: Vector3;
    fromQuaternion: Quaternion;
    toQuaternion: Quaternion;
    fromTarget: Vector3;
    toTarget: Vector3;
    fromZoom: number;
    toZoom: number;
  }>(null);

  useLayoutEffect(() => {
    if (previousCamera.current === camera) return;
    const shouldAnimate = duration > 0 && !!previousPath.current && !!activePath && previousPath.current !== activePath;
    if (shouldAnimate) {
      const fromPosition = previousCamera.current.getWorldPosition(new Vector3());
      const fromQuaternion = previousCamera.current.getWorldQuaternion(new Quaternion());
      const toPosition = camera.position.clone();
      const toQuaternion = camera.quaternion.clone();
      const toTarget = cameraOrbitTarget(camera);
      camera.position.copy(fromPosition);
      camera.quaternion.copy(fromQuaternion);
      transition.current = {
        elapsed: 0,
        fromPosition,
        toPosition,
        fromQuaternion,
        toQuaternion,
        fromTarget: previousTarget.current.clone(),
        toTarget,
        fromZoom: Number(previousCamera.current.zoom || 1),
        toZoom: Number(camera.zoom || 1),
      };
      controls?.target?.copy(previousTarget.current);
      invalidate();
    }
    previousCamera.current = camera;
    previousPath.current = activePath;
    if (!transition.current && controls?.target) previousTarget.current.copy(controls.target);
  }, [activePath, camera, controls, duration, invalidate]);

  useFrame((_, delta) => {
    const value = transition.current;
    if (!value) {
      // Controls mutate their target outside React. Retain the last viewed
      // point so a later authored-camera transition starts without a jump.
      if (controls?.target) previousTarget.current.copy(controls.target);
      return;
    }
    // A demand-rendered canvas may report the whole idle period as its first
    // delta. Clamp it so a transition requested after idling is still visible.
    value.elapsed = Math.min(duration, value.elapsed + Math.min(delta, 1 / 30));
    const progress = duration ? value.elapsed / duration : 1;
    const eased = progress * progress * (3 - 2 * progress);
    camera.position.lerpVectors(value.fromPosition, value.toPosition, eased);
    camera.quaternion.slerpQuaternions(value.fromQuaternion, value.toQuaternion, eased);
    camera.zoom = value.fromZoom + (value.toZoom - value.fromZoom) * eased;
    camera.updateProjectionMatrix?.();
    if (controls?.target) controls.target.lerpVectors(value.fromTarget, value.toTarget, eased);
    if (progress === 1) {
      previousTarget.current.copy(value.toTarget);
      transition.current = null;
      controls?.saveState?.();
    } else invalidate();
  });
  return null;
}

export function CameraPresenceCue({ enabled }: { enabled: boolean }) {
  const ready = useSceneStore((state) => state.resourcesReady);
  const camera = useThree((state) => state.camera);
  const controls = useThree((state) => state.controls) as any;
  const invalidate = useThree((state) => state.invalidate);
  const animation = useRef<null | { elapsed: number; position: Vector3; target: Vector3; right: Vector3 }>(null);
  const played = useRef(false);
  useEffect(() => {
    if (!enabled || !ready || played.current) return;
    played.current = true;
    const frameTarget = camera.userData.rivSceneFrameTarget;
    const target = Array.isArray(frameTarget)
      ? new Vector3(Number(frameTarget[0]), Number(frameTarget[1]), Number(frameTarget[2]))
      : controls?.target?.clone?.() || new Vector3(0, 0, -1).applyQuaternion(camera.quaternion).add(camera.position);
    controls?.target?.copy(target);
    controls?.saveState?.();
    animation.current = {
      elapsed: -0.12,
      position: camera.position.clone(),
      target,
      right: new Vector3(1, 0, 0).applyQuaternion(camera.quaternion),
    };
    invalidate();
  }, [camera, controls, enabled, invalidate, ready]);
  useFrame((_, delta) => {
    const value = animation.current;
    if (!value) return;
    value.elapsed += Math.min(delta, 1 / 30);
    if (value.elapsed < 0) {
      invalidate();
      return;
    }
    const progress = Math.min(1, value.elapsed / 1.05);
    const distance = value.position.distanceTo(value.target);
    const arc = Math.sin(progress * Math.PI);
    camera.position
      .copy(value.position)
      .addScaledVector(value.right, arc * distance * 0.06)
      .lerp(value.target, arc * 0.018);
    camera.lookAt(value.target);
    if (progress === 1) {
      camera.position.copy(value.position);
      camera.lookAt(value.target);
      controls?.target?.copy(value.target);
      controls?.saveState?.();
      animation.current = null;
    } else invalidate();
  });
  return null;
}
