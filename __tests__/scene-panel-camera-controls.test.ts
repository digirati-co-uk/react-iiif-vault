/**
 * @vitest-environment happy-dom
 */

import { describe, expect, test, vi } from 'vitest';
import { OrthographicCamera, PerspectiveCamera, Vector3 } from 'three';
import { AtlasOrbitControlsImpl, normalizeWheelSpin } from '../src/scene-panel/atlas-orbit-controls';
import { shouldApplyAuthoredLookAt } from '../src/scene-panel/rendering';

function viewport() {
  const element = document.createElement('div');
  element.getBoundingClientRect = () =>
    ({ left: 0, top: 0, width: 200, height: 200, right: 200, bottom: 200, x: 0, y: 0, toJSON() {} }) as DOMRect;
  document.body.append(element);
  return element;
}

function wheel(element: HTMLElement, deltaY: number, clientX = 100, clientY = 100) {
  element.dispatchEvent(new WheelEvent('wheel', { cancelable: true, clientX, clientY, deltaY }));
}

function finish(controls: AtlasOrbitControlsImpl) {
  for (let index = 0; index < 4; index++) controls.update(1 / 30);
}

describe('Atlas orbit controls', () => {
  test('does not reapply lookAt after the user moves an active authored camera', () => {
    const camera = new PerspectiveCamera();
    const position = [0, 0.68, -0.73] as const;
    const quaternion = [0, 0, 0, 1] as const;
    camera.position.fromArray(position);
    camera.quaternion.fromArray(quaternion);

    expect(shouldApplyAuthoredLookAt(camera, true, position, quaternion)).toBe(true);
    camera.position.x = 0.1;
    expect(shouldApplyAuthoredLookAt(camera, true, position, quaternion)).toBe(false);
    expect(shouldApplyAuthoredLookAt(camera, false, position, quaternion)).toBe(true);
  });

  test('normalizes pixel, line, page, and legacy wheel input', () => {
    expect(normalizeWheelSpin({ clientX: 0, clientY: 0, deltaMode: 0, deltaY: -2 })).toBe(-1);
    expect(normalizeWheelSpin({ clientX: 0, clientY: 0, deltaMode: 1, deltaY: -2 })).toBe(-1);
    expect(normalizeWheelSpin({ clientX: 0, clientY: 0, deltaMode: 2, deltaY: 2 })).toBe(1);
    expect(normalizeWheelSpin({ clientX: 0, clientY: 0, deltaMode: 0, deltaY: 0, wheelDeltaY: 120 })).toBe(-1);
  });

  test('eases perspective zoom and retargets without an input-time jump', () => {
    const element = viewport();
    const camera = new PerspectiveCamera(50, 1, 0.1, 100);
    camera.position.z = 10;
    const controls = new AtlasOrbitControlsImpl(camera);
    controls.zoomToCursor = false;
    controls.zoomEasing = (progress) => progress;
    controls.connect(element);

    wheel(element, -100);
    expect(camera.position.z).toBe(10);
    controls.update(0.02);
    expect(camera.position.z).toBeGreaterThan(9.5);
    expect(camera.position.z).toBeLessThan(10);
    expect(camera.position.z).toBeCloseTo(9.9, 6);

    const beforeRetarget = camera.position.z;
    wheel(element, -100);
    expect(camera.position.z).toBe(beforeRetarget);
    finish(controls);
    expect(camera.position.z).toBeCloseTo(beforeRetarget * 0.95, 6);
    controls.dispose();
  });

  test('eases orthographic zoom and respects native camera limits', () => {
    const element = viewport();
    const camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
    camera.position.z = 10;
    const projection = vi.spyOn(camera, 'updateProjectionMatrix');
    const controls = new AtlasOrbitControlsImpl(camera);
    controls.zoomToCursor = false;
    controls.maxZoom = 1.02;
    controls.connect(element);

    wheel(element, -100);
    expect(camera.zoom).toBe(1);
    finish(controls);
    expect(camera.zoom).toBeCloseTo(1.02, 6);
    expect(projection).toHaveBeenCalled();
    controls.dispose();
  });

  test('keeps an off-centre world point beneath the cursor', () => {
    const element = viewport();
    const camera = new PerspectiveCamera(50, 1, 0.1, 100);
    camera.position.z = 10;
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    const controls = new AtlasOrbitControlsImpl(camera);
    controls.zoomToCursor = true;
    controls.connect(element);
    const point = new Vector3(5 * Math.tan((50 * Math.PI) / 360), 0, 0);
    expect(point.clone().project(camera).x).toBeCloseTo(0.5, 6);

    controls._handleMouseWheel({ clientX: 150, clientY: 100, deltaMode: 0, deltaY: -100 });
    finish(controls);
    expect(point.clone().project(camera).x).toBeCloseTo(0.5, 6);
    controls.dispose();
  });

  test('double-click eases one step towards the clicked world point', () => {
    const element = viewport();
    const camera = new PerspectiveCamera(50, 1, 0.1, 100);
    camera.position.z = 10;
    camera.lookAt(0, 0, 0);
    const controls = new AtlasOrbitControlsImpl(camera);
    controls.zoomToCursor = true;
    controls.connect(element);
    const point = new Vector3(5 * Math.tan((50 * Math.PI) / 360), 0, 0);

    element.dispatchEvent(new MouseEvent('dblclick', { cancelable: true, clientX: 150, clientY: 100 }));
    expect(camera.position.z).toBe(10);
    finish(controls);

    expect(camera.position.distanceTo(controls.target)).toBeCloseTo(9.5, 6);
    expect(point.clone().project(camera).x).toBeCloseTo(0.5, 6);
    controls.dispose();
  });

  test('cancels pending zoom on reset and direct pointer input', () => {
    const element = viewport();
    const camera = new PerspectiveCamera(50, 1, 0.1, 100);
    camera.position.z = 10;
    const controls = new AtlasOrbitControlsImpl(camera);
    controls.zoomToCursor = false;
    controls.connect(element);
    controls.saveState();

    wheel(element, -100);
    controls.reset();
    finish(controls);
    expect(camera.position.z).toBe(10);

    wheel(element, -100);
    controls.enabled = false;
    (controls as any)._onPointerDown({});
    controls.enabled = true;
    finish(controls);
    expect(camera.position.z).toBe(10);
    controls.dispose();
  });

  test('retains perspective distance constraints', () => {
    const element = viewport();
    const camera = new PerspectiveCamera(50, 1, 0.1, 100);
    camera.position.z = 10;
    const controls = new AtlasOrbitControlsImpl(camera);
    controls.zoomToCursor = false;
    controls.minDistance = 9.8;
    controls.connect(element);
    wheel(element, -100);
    finish(controls);
    expect(camera.position.distanceTo(controls.target)).toBeCloseTo(9.8, 6);
    expect(controls.isZooming).toBe(false);
    controls.dispose();
  });
});
