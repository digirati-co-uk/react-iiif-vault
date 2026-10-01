import { createSceneTransformMatrix, parseSceneTarget } from '@iiif/helpers/scenes';
import { describe, expect, test, vi } from 'vitest';
import { Euler, Group, Matrix4, PerspectiveCamera, Quaternion, Scene, Vector3 } from 'three';
import { canvasQuadCorners, canvasQuadPoint, createCanvasQuadGeometry } from '../src/scene-panel/canvas-rendering';
import { applyLookAtPreservingRoll, resolveLookAtPoint } from '../src/scene-panel/spatial-target';

function runtime(resolvePoint: (id: string) => readonly [number, number, number] | null = vi.fn(() => null)) {
  return {
    scene: { id: 'https://example.org/scene' },
    vault: { get: () => undefined },
    resolvePoint,
  };
}

describe('Scene spatial targets', () => {
  test('resolves direct point and WKT lookAt selectors', () => {
    const scene = new Scene();
    expect(resolveLookAtPoint({ type: 'PointSelector', x: 1, y: 2, z: 3 }, runtime(), scene)).toEqual([1, 2, 3]);
    expect(
      resolveLookAtPoint(
        {
          id: 'https://example.org/selector',
          type: 'WktSelector',
          value: 'POLYGON Z ((2 4 6, 6 4 6, 6 8 10, 2 8 10, 2 4 6))',
        },
        runtime(),
        scene
      )
    ).toEqual([4, 6, 8]);
  });

  test('uses registered Annotation bounds and maps Canvas coordinates into the Scene', () => {
    const resolvePoint = vi.fn((id: string) => (id === 'https://example.org/annotation' ? ([7, 8, 9] as const) : null));
    const scene = new Scene();
    const canvas = new Group();
    canvas.userData.iiifIds = ['https://example.org/canvas'];
    canvas.position.set(10, 20, 30);
    canvas.rotation.z = Math.PI / 2;
    scene.add(canvas);
    scene.updateMatrixWorld(true);

    expect(
      resolveLookAtPoint({ id: 'https://example.org/annotation', type: 'Annotation' }, runtime(resolvePoint), scene)
    ).toEqual([7, 8, 9]);
    expect(
      resolveLookAtPoint(
        {
          type: 'SpecificResource',
          source: { id: 'https://example.org/canvas', type: 'Canvas' },
          selector: { type: 'PointSelector', x: 2, y: 3, z: 4 },
        },
        runtime(),
        scene
      )
    ).toEqual([13, 22, 34]);

    const coordinates = new Group();
    coordinates.position.x = 1;
    coordinates.userData.rivCanvasPoint = (x: number, y: number, z: number) => [x * 2, y * 3, z];
    canvas.add(coordinates);
    scene.updateMatrixWorld(true);
    expect(
      resolveLookAtPoint(
        {
          type: 'SpecificResource',
          source: { id: 'https://example.org/canvas', type: 'Canvas' },
          selector: { type: 'PointSelector', x: 2, y: 3, z: 4 },
        },
        runtime(),
        scene
      )
    ).toEqual([1, 25, 34]);
  });

  test('preserves authored camera roll after lookAt replaces pitch and yaw', () => {
    const camera = new PerspectiveCamera();
    camera.position.set(1, 2, 3);
    const authored = new Quaternion().setFromEuler(new Euler(0, 0, Math.PI / 4, 'XYZ'));
    const expected = camera.clone();
    expected.lookAt(4, 5, 6);
    expected.rotateZ(Math.PI / 4);

    applyLookAtPreservingRoll(camera, [4, 5, 6], authored.toArray());

    expect(1 - Math.abs(camera.quaternion.dot(expected.quaternion))).toBeLessThan(1e-12);

    const mixedAuthored = new Quaternion();
    new Matrix4()
      .fromArray(
        createSceneTransformMatrix([
          { type: 'RotateTransform', x: (0.3 * 180) / Math.PI, y: (0.5 * 180) / Math.PI, z: (0.7 * 180) / Math.PI },
        ])
      )
      .decompose(new Vector3(), mixedAuthored, new Vector3());
    expected.lookAt(4, 5, 6);
    expected.rotateZ(0.7);
    applyLookAtPreservingRoll(camera, [4, 5, 6], mixedAuthored.toArray());
    expect(1 - Math.abs(camera.quaternion.dot(expected.quaternion))).toBeLessThan(1e-12);
  });

  test('maps an IIIF four-corner WKT Canvas target to quad vertices and UVs', () => {
    const target = parseSceneTarget({
      type: 'SpecificResource',
      source: { id: 'https://example.org/scene', type: 'Scene' },
      selector: {
        type: 'WktSelector',
        value: 'POLYGON Z ((0 1 0, 0 0 0, 2 0 0, 3 1 0, 0 1 0))',
      },
    });
    const corners = canvasQuadCorners(target.geometry)!;
    const geometry = createCanvasQuadGeometry(corners);

    expect(corners).toEqual([
      [0, 1, 0],
      [0, 0, 0],
      [2, 0, 0],
      [3, 1, 0],
    ]);
    expect(canvasQuadPoint(corners, 100, 100, 50, 50)).toEqual([1.25, 0.5, 0]);
    expect(Array.from(geometry.getAttribute('position').array)).toEqual(corners.flat());
    expect(Array.from(geometry.getAttribute('uv').array)).toEqual([0, 1, 0, 0, 1, 0, 1, 1]);
    expect(Array.from(geometry.getIndex()!.array)).toEqual([0, 1, 2, 0, 2, 3]);
    geometry.dispose();
  });
});
