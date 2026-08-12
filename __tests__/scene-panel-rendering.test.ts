import { describe, expect, test } from 'vitest';
import {
  createCanvasImageRequestUrl,
  isGaussianSplat,
  isUsdz,
  resolveLookAtReferenceId,
  selectSceneFrameloop,
} from '../src/scene-panel/rendering';

describe('ScenePanel rendering helpers', () => {
  test('builds bounded IIIF Image API requests for Canvas planes', () => {
    const service = 'https://example.org/iiif/image';
    const resource = { id: 'https://example.org/fallback.jpg', width: 2000 };
    expect(createCanvasImageRequestUrl(service, resource, null, 512)).toBe(`${service}/full/512,/0/default.jpg`);
    expect(createCanvasImageRequestUrl(service, resource, { x: 10, y: 20, width: 400, height: 300 }, 1024)).toBe(
      `${service}/10,20,400,300/400,/0/default.jpg`
    );
    expect(createCanvasImageRequestUrl(null, resource, null, 256)).toBe(resource.id);
  });

  test('distinguishes references from hydrated SpecificResource lookAt targets', () => {
    expect(resolveLookAtReferenceId({ id: 'https://example.org/annotation', type: 'Annotation' })).toBe(
      'https://example.org/annotation'
    );
    expect(resolveLookAtReferenceId({ id: 'vault://specific', type: 'SpecificResource' })).toBeUndefined();
  });

  test('recognizes streamed Gaussian splat model URLs', () => {
    expect(isGaussianSplat({ id: 'https://example.org/nike.splat?download=true' })).toBe(true);
    expect(isGaussianSplat({ id: 'https://example.org/mesh.ply' })).toBe(false);
  });

  test('recognizes USDZ models by media type or URL', () => {
    expect(isUsdz({ id: 'https://example.org/model', format: 'model/vnd.usdz+zip' })).toBe(true);
    expect(isUsdz({ id: 'https://example.org/model.usdz?download=true' })).toBe(true);
    expect(isUsdz({ id: 'https://example.org/model.glb', format: 'model/gltf-binary' })).toBe(false);
  });

  test('keeps nested streaming resources live without discarding the requested idle mode', () => {
    expect(selectSceneFrameloop(false, 0, 'never')).toBe('never');
    expect(selectSceneFrameloop(false, 1, 'never')).toBe('always');
    expect(selectSceneFrameloop(true, 0, 'demand')).toBe('always');
  });
});
