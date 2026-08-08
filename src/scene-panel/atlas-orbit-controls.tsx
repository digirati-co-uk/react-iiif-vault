import { useFrame, useThree } from '@react-three/fiber';
import React, { forwardRef, useEffect, useLayoutEffect, useMemo } from 'react';
import { Vector3, type Camera } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { SceneCameraZoomOptions } from './types';

type NormalizedCameraZoomOptions = Required<SceneCameraZoomOptions>;
type WheelInput = Pick<WheelEvent, 'clientX' | 'clientY' | 'deltaMode' | 'deltaY'> & {
  detail?: number;
  wheelDelta?: number;
  wheelDeltaY?: number;
};

type ZoomTransition = {
  appliedFactor: number;
  duration: number;
  easing: (progress: number) => number;
  elapsed: number;
  factor: number;
  x: number;
  y: number;
};

export function easeOutExpo(progress: number) {
  return progress === 1 ? 1 : 1 - 2 ** (-10 * progress);
}

export function normalizeWheelSpin(event: WheelInput) {
  let spin = event.detail || 0;
  if (event.wheelDelta !== undefined) spin = -event.wheelDelta / 120;
  if (event.wheelDeltaY !== undefined) spin = -event.wheelDeltaY / 120;

  let pixels = spin * 10;
  if (event.deltaY !== undefined) pixels = event.deltaY;
  if (pixels && event.deltaMode === 1) pixels *= 40;
  if (pixels && event.deltaMode === 2) pixels *= 800;
  return spin || (pixels < 0 ? -1 : pixels > 0 ? 1 : 0);
}

export function cameraOrbitTarget(camera: Camera) {
  const authored = camera.userData?.rivLookAt;
  return Array.isArray(authored) && authored.length >= 3
    ? new Vector3(Number(authored[0]), Number(authored[1]), Number(authored[2]))
    : new Vector3(0, 0, -1).applyQuaternion(camera.quaternion).add(camera.position);
}

export class AtlasOrbitControlsImpl extends OrbitControls<Camera> {
  zoomDuration = 0.1;
  zoomSensitivity = 1;
  zoomEasing = easeOutExpo;
  private zoomTransition: ZoomTransition | null = null;
  private handleDoubleClick: EventListener = (event) => {
    const mouseEvent = event as MouseEvent;
    if (!this.enabled || !this.enableZoom) return;
    mouseEvent.preventDefault();
    this._handleMouseWheel({ clientX: mouseEvent.clientX, clientY: mouseEvent.clientY, deltaMode: 0, deltaY: -1 });
  };

  constructor(camera: Camera) {
    // OrbitControls otherwise rebuilds the view with the global Y axis and
    // subtly discards an authored camera's roll as soon as it updates.
    const authoredQuaternion = camera.quaternion.clone();
    camera.up.set(0, 1, 0).applyQuaternion(camera.quaternion);
    super(camera);
    camera.quaternion.copy(authoredQuaternion);
    const onPointerDown = (this as any)._onPointerDown;
    (this as any)._onPointerDown = (event: PointerEvent) => {
      this.cancelZoom();
      onPointerDown(event);
    };
  }

  // Keep the original event so Atlas-style wheel normalization can inspect
  // legacy wheel values as well as deltaMode.
  _customWheelEvent(event: WheelEvent) {
    return event;
  }

  _handleMouseWheel(event: WheelInput) {
    const spin = normalizeWheelSpin(event) * Math.max(0, this.zoomSensitivity);
    if (!spin) return;
    const factor = Math.max(0.01, 1 + spin / 20);
    const duration = Math.max(0, this.zoomDuration) * Math.abs(spin);
    if (!duration) {
      this.applyZoom(factor, event.clientX, event.clientY);
      super.update(0);
      return;
    }
    this.zoomTransition = {
      appliedFactor: 1,
      duration,
      easing: this.zoomEasing,
      elapsed: 0,
      factor,
      x: event.clientX,
      y: event.clientY,
    };
  }

  update(deltaTime: number | null = null) {
    const transition = this.zoomTransition;
    if (transition) {
      transition.elapsed = Math.min(
        transition.duration,
        transition.elapsed + Math.min(typeof deltaTime === 'number' ? deltaTime : 1 / 60, 1 / 30)
      );
      const progress = transition.elapsed / transition.duration;
      const eased = Math.max(0, Math.min(1, transition.easing(progress)));
      const factor = 1 + (transition.factor - 1) * eased;
      this.applyZoom(factor / transition.appliedFactor, transition.x, transition.y);
      transition.appliedFactor = factor;
      if (progress === 1) this.zoomTransition = null;
    }
    return super.update(deltaTime);
  }

  reset() {
    this.cancelZoom();
    super.reset();
  }

  connect(element: HTMLElement) {
    super.connect(element);
    element.addEventListener('dblclick', this.handleDoubleClick);
  }

  disconnect() {
    this.domElement?.removeEventListener('dblclick', this.handleDoubleClick);
    this.cancelZoom();
    super.disconnect();
  }

  cancelZoom() {
    this.zoomTransition = null;
  }

  get isZooming() {
    return this.zoomTransition !== null;
  }

  private applyZoom(factor: number, x: number, y: number) {
    if (this.zoomToCursor) (this as any)._updateZoomParameters(x, y);
    (this as any)._dollyOut(1 / factor);
  }
}

type AtlasOrbitControlsProps = {
  cameraZoom: NormalizedCameraZoomOptions;
  makeDefault?: boolean;
  minPolarAngle?: number;
  maxPolarAngle?: number;
};

export const AtlasOrbitControls = forwardRef<AtlasOrbitControlsImpl, AtlasOrbitControlsProps>(
  function AtlasOrbitControls({ cameraZoom, makeDefault, minPolarAngle = 0, maxPolarAngle = Math.PI }, ref) {
    const invalidate = useThree((state) => state.invalidate);
    const camera = useThree((state) => state.camera);
    const gl = useThree((state) => state.gl);
    const events = useThree((state) => state.events);
    const set = useThree((state) => state.set);
    const get = useThree((state) => state.get);
    const controls = useMemo(() => new AtlasOrbitControlsImpl(camera), [camera]);
    const domElement = events.connected || gl.domElement;

    useLayoutEffect(() => {
      controls.target.copy(cameraOrbitTarget(camera));
      controls.saveState();
    }, [camera, controls]);

    useLayoutEffect(() => {
      controls.enableDamping = true;
      controls.minPolarAngle = minPolarAngle;
      controls.maxPolarAngle = maxPolarAngle;
      controls.zoomDuration = cameraZoom.duration;
      controls.zoomSensitivity = cameraZoom.sensitivity;
      controls.zoomEasing = cameraZoom.easing;
      controls.zoomToCursor = cameraZoom.zoomToCursor;
    }, [cameraZoom, controls, maxPolarAngle, minPolarAngle]);

    useFrame((_, delta) => {
      controls.update(delta);
      if (controls.isZooming) invalidate();
    }, -1);

    useEffect(() => {
      controls.connect(domElement as HTMLElement);
      const render = () => invalidate();
      controls.addEventListener('change', render);
      controls.addEventListener('start', render);
      return () => {
        controls.removeEventListener('change', render);
        controls.removeEventListener('start', render);
        controls.dispose();
      };
    }, [controls, domElement, invalidate]);

    useEffect(() => {
      if (!makeDefault) return;
      const previous = get().controls;
      set({ controls: controls as any });
      return () => set({ controls: previous });
    }, [controls, get, makeDefault, set]);

    return <primitive ref={ref} object={controls} />;
  }
);
