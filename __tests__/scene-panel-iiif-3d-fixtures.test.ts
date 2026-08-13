import { createSceneHelper, createSceneTransformMatrix, type ScenePaintable } from '@iiif/helpers/scenes';
import { Vault4 } from '@iiif/helpers/vault-4';
import { Matrix4, Quaternion, Vector3 } from 'three';
import { describe, expect, test } from 'vitest';
import orthographicCamera from '../apps/scene-prototype/public/fixtures/parser/07-orthographic-camera.json';
import rotatedLight from '../apps/scene-prototype/public/fixtures/parser/10-directional-light-rotated.json';
import multipleLights from '../apps/scene-prototype/public/fixtures/parser/11-multiple-lights.json';
import mirroredModel from '../apps/scene-prototype/public/fixtures/parser/13-mirrored-model.json';
import rotatedTranslatedModel from '../apps/scene-prototype/public/fixtures/parser/15-rotated-translated-model.json';
import nestedScenes from '../apps/scene-prototype/public/fixtures/parser-official-3d/uc06_scene_in_scene.json';
import excludedModelFeatures from '../apps/scene-prototype/public/fixtures/parser-official-3d/uc06_multiple_3d_objects.json';

function loadFixture(input: any) {
  const vault = new Vault4();
  const manifest = vault.loadManifestSync(input.id, input)!;
  const items = (vault.get(manifest.items as any, { parent: manifest }) || []) as any[];
  const start = manifest.start && vault.get<any>(manifest.start, { skipSelfReturn: false });
  const scene = start?.type === 'Scene' ? start : items.find((item: any) => item.type === 'Scene');
  if (!scene) throw new Error(`Fixture ${input.id} has no renderable Scene`);
  return { vault, manifest, scene, paintables: createSceneHelper(vault).getPaintables(scene).items };
}

function decompose(paintable: ScenePaintable) {
  const matrix = new Matrix4().fromArray(
    createSceneTransformMatrix(paintable.bodyTransform, paintable.target.point || [0, 0, 0])
  );
  const position = new Vector3();
  const rotation = new Quaternion();
  const scale = new Vector3();
  matrix.decompose(position, rotation, scale);
  return { position, rotation, scale };
}

describe('ScenePanel IIIF 3D fixture contracts', () => {
  test('preserves an authored orthographic camera and its annotation lookAt', () => {
    // IIIF/3d manifests/2_cameras/zz_orthographic_camera.json
    const { paintables } = loadFixture(orthographicCamera);
    const camera = paintables.find((paintable) => paintable.type === 'orthographic-camera');

    expect(camera).toBeDefined();
    expect(camera!.target.point).toEqual([0, 3, -10]);
    expect(camera!.resource).toMatchObject({
      type: 'OrthographicCamera',
      lookAt: { id: 'https://example.org/iiif/3d/anno1', type: 'Annotation' },
    });
  });

  test('preserves authored light kinds, properties, and transforms without inventing a fallback light', () => {
    // IIIF/3d manifests/3_lights/multiple_lights_with_intensities_and_colors.json
    const { paintables } = loadFixture(multipleLights);
    const lights = paintables.filter((paintable) => paintable.type.endsWith('light'));

    expect(lights.map((paintable) => paintable.type)).toEqual(['spot-light', 'ambient-light', 'spot-light']);
    expect(lights.map((paintable) => paintable.resource.color)).toEqual(['#ff0000', '#7aff40', '#0f00ff']);
    expect(lights.map((paintable) => (paintable.resource.intensity as any).value)).toEqual([100, 0.5, 10]);
    expect(decompose(lights[0]).position.toArray()).toEqual([0, 3.5, 3.5]);
    expect(decompose(lights[2]).position.toArray()).toEqual([0, 2.5, 3.5]);

    // IIIF/3d manifests/3_lights/direction_light_transform_rotate.json
    const rotated = loadFixture(rotatedLight).paintables.find((paintable) => paintable.type === 'directional-light')!;
    expect(
      decompose(rotated).rotation.angleTo(new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), Math.PI / 6))
    ).toBeCloseTo(0);
  });

  test('composes target positions with authored rotation, translation, and negative scale in order', () => {
    // IIIF/3d manifests/4_transform_and_position/model_transform_negative_scale_position.json
    const mirrored = loadFixture(mirroredModel).paintables.filter((paintable) => paintable.type === 'model');
    expect(decompose(mirrored[0])).toMatchObject({
      position: expect.objectContaining({ x: -1, y: 0, z: 0 }),
      scale: expect.objectContaining({ x: 1, y: 1, z: 1 }),
    });
    expect(decompose(mirrored[1])).toMatchObject({
      position: expect.objectContaining({ x: 1, y: 0, z: 0 }),
      scale: expect.objectContaining({ x: -1, y: 1, z: 1 }),
    });

    // IIIF/3d manifests/4_transform_and_position/model_transform_rotate_translate_position.json
    const transformed = loadFixture(rotatedTranslatedModel).paintables[0];
    const result = decompose(transformed);
    expect(result.position.toArray()).toEqual([1, 0, 0]);
    expect(result.rotation.angleTo(new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), Math.PI))).toBeCloseTo(0);
  });

  test('keeps repeated nested Scene instances distinct and resolves the child Scene paintables', () => {
    // Representative of IIIF/3d manifests/5_nesting/zz_scene_in_scene.json.
    const { vault, paintables } = loadFixture(nestedScenes);
    expect(paintables.map((paintable) => paintable.type)).toEqual(['scene', 'scene']);
    expect(paintables.map((paintable) => paintable.target.point)).toEqual([
      [-2, 0, 0],
      [2, 0, 0],
    ]);
    expect(new Set(paintables.map((paintable) => paintable.annotationId)).size).toBe(2);

    const child = vault.get<any>(paintables[0].resource.id);
    expect(createSceneHelper(vault).getPaintables(child).items).toEqual([expect.objectContaining({ type: 'model' })]);
  });

  test('exposes model feature exclusions to the rendering layer', () => {
    const { paintables } = loadFixture(excludedModelFeatures);
    const excluded = paintables.find((paintable) => paintable.annotation.exclude?.length);

    expect(excluded).toMatchObject({
      type: 'model',
      resource: { type: 'Model' },
      annotation: { exclude: ['audio', 'lights'] },
    });
  });
});
