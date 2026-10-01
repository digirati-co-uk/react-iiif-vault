import { createSceneTransformMatrix } from '@iiif/helpers/scenes';
import { describe, expect, test } from 'vitest';
import { Euler, Group, Matrix4, Quaternion, Vector3 } from 'three';
import {
  environmentRotationFromMatrix,
  environmentRotationFromObject,
  resolveEnvironmentMapSource,
} from '../src/scene-panel/rendering-media';

describe('ImageBasedLight environment maps', () => {
  test('dispatches equirectangular, six-face cubic, and cubemap KTX2 profiles', () => {
    expect(
      resolveEnvironmentMapSource({ id: 'https://example.org/environment.hdr', profile: 'equirectangular' })
    ).toEqual({ type: 'equirectangular', url: 'https://example.org/environment.hdr' });

    const faces = ['px', 'nx', 'py', 'ny', 'pz', 'nz'].map((face) => `https://example.org/${face}.png`);
    expect(resolveEnvironmentMapSource({ profile: 'cubic', items: faces })).toEqual({
      type: 'cubic-files',
      urls: faces,
    });
    expect(resolveEnvironmentMapSource({ id: 'https://example.org/environment.ktx2', profile: 'cubic' })).toEqual({
      type: 'cubic-ktx2',
      url: 'https://example.org/environment.ktx2',
    });
    expect(resolveEnvironmentMapSource({ id: 'https://example.org/environment.jpg', profile: 'cubic' })).toEqual({
      type: 'unsupported',
      profile: 'cubic',
      url: 'https://example.org/environment.jpg',
    });
    expect(resolveEnvironmentMapSource({ id: 'https://example.org/environment.hdr', profile: 'custom' })).toEqual({
      type: 'unsupported',
      profile: 'custom',
      url: 'https://example.org/environment.hdr',
    });
  });

  test('derives orientation from RotateTransforms and includes nested Scene transforms', () => {
    const matrix = createSceneTransformMatrix([{ type: 'RotateTransform', x: 10, y: 20, z: 30 }]);
    const local = environmentRotationFromMatrix(matrix);
    const authored = new Quaternion();
    new Matrix4().fromArray(matrix).decompose(new Vector3(), authored, new Vector3());
    const represented = new Quaternion().setFromEuler(new Euler(...local, 'XYZ'));
    expect(1 - Math.abs(represented.dot(authored))).toBeLessThan(1e-12);

    const parent = new Group();
    parent.rotation.set(0, Math.PI / 4, 0, 'XYZ');
    const light = new Group();
    light.rotation.set(...local, 'XYZ');
    parent.add(light);
    parent.updateMatrixWorld(true);
    const expected = new Euler().setFromRotationMatrix(light.matrixWorld, 'XYZ');

    const world = environmentRotationFromObject(light);
    expect(world[0]).toBeCloseTo(expected.x);
    expect(world[1]).toBeCloseTo(expected.y);
    expect(world[2]).toBeCloseTo(expected.z);
    expect(world).not.toEqual(local);
  });
});
