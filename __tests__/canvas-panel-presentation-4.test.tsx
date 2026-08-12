/**
 * @vitest-environment happy-dom
 */

import { render } from '@testing-library/react';
import type { Manifest } from '@iiif/parser/presentation-4/types';
import { describe, expect, test } from 'vitest';
import {
  AtlasStoreProvider,
  CanvasContext,
  CanvasPanel,
  Vault,
  VaultProvider,
  VirtualAnnotationProvider,
} from '../src/presentation-4';
import { createPaintingAnnotationsHelper } from '../src/presentation-4-helpers';
import { getRenderingStrategy } from '../src/features/rendering-strategy/get-rendering-strategy';
import {
  getCanvasBackgroundColor,
  getCanvasContainerSize,
  getPlaceholderContainer,
} from '../src/utility/canvas-compat';
import { getContainerSequence } from '../src/utility/container-sequence';

const manifestId = 'https://example.org/presentation-4/manifest';
const canvasId = 'https://example.org/presentation-4/canvas';
const placeholderId = 'https://example.org/presentation-4/placeholder';
const imageId = 'https://example.org/image.jpg';

const manifest: Manifest = {
  '@context': 'http://iiif.io/api/presentation/4/context.json',
  id: manifestId,
  type: 'Manifest',
  label: { en: ['Presentation 4 CanvasPanel'] },
  items: [
    {
      id: canvasId,
      type: 'Canvas',
      width: 100,
      height: 80,
      backgroundColor: '#123456',
      placeholderContainer: {
        id: placeholderId,
        type: 'Canvas',
        width: 25,
        height: 20,
        items: [],
      },
      items: [
        {
          id: `${canvasId}/page`,
          type: 'AnnotationPage',
          items: [
            {
              id: `${canvasId}/painting`,
              type: 'Annotation',
              motivation: ['painting'],
              body: {
                id: imageId,
                type: 'Image',
                width: 30,
                height: 40,
                format: 'image/jpeg',
              },
              target: {
                type: 'SpecificResource',
                source: { id: canvasId, type: 'Canvas' },
                selector: [{ type: 'FragmentSelector', value: 'xywh=10,20,30,40' }],
              },
            },
          ],
        },
      ],
    },
  ],
};

const timelineId = 'https://example.org/presentation-4/timeline';
const timelineManifest: Manifest = {
  '@context': 'http://iiif.io/api/presentation/4/context.json',
  id: `${timelineId}/manifest`,
  type: 'Manifest',
  label: { en: ['Presentation 4 audio'] },
  items: [
    {
      id: timelineId,
      type: 'Timeline',
      duration: 12,
      items: [
        {
          id: `${timelineId}/page`,
          type: 'AnnotationPage',
          items: [
            {
              id: `${timelineId}/painting`,
              type: 'Annotation',
              motivation: ['painting'],
              body: {
                id: 'https://example.org/audio.mp4',
                type: 'Audio',
                format: 'audio/mp4',
                duration: 12,
              },
              target: { id: timelineId, type: 'Timeline' },
            },
          ],
        },
      ],
    },
  ],
};

describe('CanvasPanel Presentation 4 compatibility', () => {
  test('treats a v4 Timeline as a non-spatial CanvasPanel view', () => {
    const vault = new Vault();
    const loaded = vault.loadManifestSync(timelineManifest.id, timelineManifest)!;
    const timeline = vault.get({ id: timelineId, type: 'Timeline' });
    const pages = vault.get(timeline.items.map(({ id }) => ({ id, type: 'AnnotationPage' as const })));
    const annotations = pages.flatMap((page) =>
      vault.get(page.items.map(({ id }) => ({ id, type: 'Annotation' as const })))
    );
    const [items, sequence] = getContainerSequence(vault, loaded, { disablePaging: true });
    const paintables = createPaintingAnnotationsHelper(vault).getPaintables(annotations);
    const strategy = getRenderingStrategy({
      canvas: timeline,
      paintables,
      loadImageService: () => undefined,
      supports: ['media'],
      vault,
    });

    expect(items).toEqual([{ id: timelineId, type: 'Timeline' }]);
    expect(sequence).toEqual([[0]]);
    expect(getCanvasContainerSize(timeline)).toEqual({ width: 1, height: 1 });
    expect(strategy).toMatchObject({
      type: 'media',
      media: { type: 'Sound', duration: 12, url: 'https://example.org/audio.mp4' },
    });
  });

  test('resolves v4 painting targets, background colour, and Canvas placeholders', () => {
    const vault = new Vault();
    vault.loadManifestSync(manifestId, manifest);
    const canvas = vault.get({ id: canvasId, type: 'Canvas' });

    expect(canvas).toBeTruthy();
    expect(getCanvasBackgroundColor(canvas)).toBe('#123456');
    expect(getPlaceholderContainer(canvas)).toEqual({ id: placeholderId, type: 'Canvas' });

    const paintables = createPaintingAnnotationsHelper(vault).getPaintables(canvas);
    const strategy = getRenderingStrategy({
      canvas,
      paintables,
      loadImageService: () => undefined,
      supports: ['images'],
      vault,
    });

    expect(strategy.type).toBe('images');
    expect(strategy.type === 'images' ? strategy.image.target.spatial : undefined).toEqual({
      x: 10,
      y: 20,
      width: 30,
      height: 40,
      unit: 'pixel',
    });
  });

  test('uses the v4 background and placeholder through CanvasPanel components', () => {
    const vault = new Vault();
    vault.loadSync(manifestId, manifest);

    const backgroundRender = render(
      <VaultProvider vault={vault}>
        <CanvasContext canvas={canvasId}>
          <CanvasPanel.CanvasBackground />
        </CanvasContext>
      </VaultProvider>
    );
    expect((backgroundRender.container.querySelector('box') as HTMLElement).style.backgroundColor).toBe('#123456');
    backgroundRender.unmount();

    const placeholderRender = render(
      <AtlasStoreProvider>
        <VaultProvider vault={vault}>
          <VirtualAnnotationProvider>
            <CanvasContext canvas={canvasId}>
              <CanvasPanel.PlaceholderCanvas />
            </CanvasContext>
          </VirtualAnnotationProvider>
        </VaultProvider>
      </AtlasStoreProvider>
    );

    const placeholder = placeholderRender.container.querySelector('world-object');
    expect(placeholder?.getAttribute('width')).toBe('25');
    expect(placeholder?.getAttribute('height')).toBe('20');
  });
});
