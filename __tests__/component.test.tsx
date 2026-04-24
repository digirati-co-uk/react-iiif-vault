/**
 * @vitest-environment happy-dom
 */

import { describe, test, expect } from 'vitest';
import { render, renderHook, waitFor } from '@testing-library/react';
import { useManifest } from '../src';
import { Vault } from '@iiif/helpers/vault';
import { createVaultWrapper } from '../test-utils';
import { RenderImage } from '../src/canvas-panel/render/Image';

type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
};

function readWorldObjectRect(worldObject: Element | null): Rect {
  if (!worldObject) {
    throw new Error('Expected world-object to exist');
  }

  return {
    x: Number(worldObject.getAttribute('x') || 0),
    y: Number(worldObject.getAttribute('y') || 0),
    width: Number(worldObject.getAttribute('width') || 0),
    height: Number(worldObject.getAttribute('height') || 0),
    rotation: Number(worldObject.getAttribute('rotation') || 0),
  };
}

function getAtlasRotatedBounds(rect: Rect): Rect {
  const rotation = ((rect.rotation % 360) + 360) % 360;

  if (rotation !== 90 && rotation !== 270) {
    return rect;
  }

  const centerX = rect.x + rect.width / 2;
  const centerY = rect.y + rect.height / 2;
  const width = rect.height;
  const height = rect.width;

  return {
    x: centerX - width / 2,
    y: centerY - height / 2,
    width,
    height,
    rotation: rect.rotation,
  };
}

function expectRectToEqual(actual: Rect, expected: Rect) {
  expect(actual.x).toBeCloseTo(expected.x);
  expect(actual.y).toBeCloseTo(expected.y);
  expect(actual.width).toBeCloseTo(expected.width);
  expect(actual.height).toBeCloseTo(expected.height);
  expect(actual.rotation).toBeCloseTo(expected.rotation);
}

describe('component-test', () => {
  test('a hook', async () => {
    const vault = new Vault();
    await vault.loadManifest('https://example.org/manifest', {
      id: 'https://example.org/manifest',
      type: 'Manifest',
      label: { en: ['My manifest'] },
    });

    const hook = renderHook(() => useManifest({ id: 'https://example.org/manifest' }), {
      wrapper: createVaultWrapper(vault),
    });

    expect(hook.result.current!.label).toEqual({
      en: ['My manifest'],
    });
  });

  test('RenderImage keeps rotated images in the target bounds', () => {
    const { container } = render(
      <RenderImage
        id="rotated"
        image={
          {
            id: 'https://example.org/image.jpg',
            type: 'Image',
            annotationId: 'https://example.org/annotation',
            annotation: null,
            rotation: 270,
            target: {
              type: 'BoxSelector',
              spatial: { x: 0, y: 0, width: 2105, height: 1523 },
            },
          } as any
        }
      />
    );

    const worldObject = container.querySelector('world-object');
    const rect = readWorldObjectRect(worldObject);

    expectRectToEqual(rect, { x: 291, y: -291, width: 1523, height: 2105, rotation: 270 });
    expectRectToEqual(getAtlasRotatedBounds(rect), { x: 0, y: 0, width: 2105, height: 1523, rotation: 270 });
  });

  test('RenderImage keeps rotated image service tiles in the target bounds', async () => {
    const { container } = render(
      <RenderImage
        id="rotated-service"
        image={
          {
            id: 'https://example.org/image-service/full/max/0/default.jpg',
            type: 'Image',
            annotationId: 'https://example.org/annotation',
            annotation: null,
            rotation: 270,
            width: 1523,
            height: 2105,
            service: {
              id: 'https://example.org/image-service',
              type: 'ImageService3',
              '@context': 'http://iiif.io/api/image/3/context.json',
              profile: 'level2',
              width: 1523,
              height: 2105,
              tiles: [{ width: 512, scaleFactors: [1, 2, 4] }],
            },
            target: {
              type: 'BoxSelector',
              spatial: { x: 0, y: 0, width: 2105, height: 1523 },
            },
          } as any
        }
      />
    );

    await waitFor(() => expect(container.querySelectorAll('world-object')).toHaveLength(2));

    const [wrapper, tileSet] = Array.from(container.querySelectorAll('world-object'));
    const wrapperRect = readWorldObjectRect(wrapper);
    const tileSetRect = readWorldObjectRect(tileSet);

    expectRectToEqual(wrapperRect, { x: 0, y: 0, width: 2105, height: 1523, rotation: 0 });
    expectRectToEqual(tileSetRect, { x: 291, y: -291, width: 1523, height: 2105, rotation: 270 });
    expectRectToEqual(getAtlasRotatedBounds(tileSetRect), {
      x: 0,
      y: 0,
      width: 2105,
      height: 1523,
      rotation: 270,
    });
  });
});
