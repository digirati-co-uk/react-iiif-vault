/**
 * @vitest-environment happy-dom
 */

import { Vault4 } from '@iiif/helpers/vault-4';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { describe, expect, test, vi } from 'vitest';
import { getSceneAnnotations, useSceneAnnotations } from '../src/scene-panel/annotations';
import { SceneRuntimeContext } from '../src/scene-panel/context';

function annotation(id: string, target: string) {
  return {
    id,
    type: 'Annotation',
    motivation: ['commenting'],
    body: { type: 'TextualBody', value: id },
    target: { id: target, type: target.includes('/scene') ? 'Scene' : 'Model' },
  };
}

function manifestWithAnnotationPages(external = false) {
  const sceneId = 'https://example.org/scene';
  const modelId = 'https://example.org/model';
  const page = (id: string, items: unknown[]) =>
    external ? { id, type: 'AnnotationPage' } : { id, type: 'AnnotationPage', items };
  return {
    id: 'https://example.org/manifest',
    type: 'Manifest',
    label: { en: ['Annotation discovery'] },
    items: [
      {
        id: sceneId,
        type: 'Scene',
        items: [
          {
            id: `${sceneId}/painting`,
            type: 'AnnotationPage',
            items: [
              {
                id: `${sceneId}/painting/model`,
                type: 'Annotation',
                motivation: ['painting'],
                body: {
                  id: modelId,
                  type: 'Model',
                  format: 'model/gltf-binary',
                  annotations: [
                    page('https://example.org/page/model', [
                      annotation('https://example.org/annotation/model', modelId),
                    ]),
                  ],
                },
                target: { id: sceneId, type: 'Scene' },
              },
            ],
          },
        ],
        annotations: [
          page('https://example.org/page/scene', [annotation('https://example.org/annotation/scene', sceneId)]),
        ],
      },
    ],
    annotations: [
      {
        id: 'https://example.org/page/manifest',
        type: 'AnnotationPage',
        items: [annotation('https://example.org/annotation/manifest', modelId)],
      },
    ],
  };
}

function normalized(input: ReturnType<typeof manifestWithAnnotationPages>) {
  const vault = new Vault4();
  const manifest = vault.loadManifestSync(input.id, input as any)!;
  const scene = vault.get<any>(manifest.items, { parent: manifest })[0];
  return { vault, manifest, scene };
}

describe('Scene annotation discovery', () => {
  test('keeps Scene and Manifest ordering while including painted content annotations', () => {
    const input = manifestWithAnnotationPages();
    const model = (input.items[0].items[0].items[0] as any).body;
    model.annotations.push({ id: 'https://example.org/page/model', type: 'AnnotationPage' });
    const { vault, manifest, scene } = normalized(input);

    expect(getSceneAnnotations(vault, scene, manifest).map(({ id }) => id)).toEqual([
      'https://example.org/annotation/scene',
      'https://example.org/annotation/model',
      'https://example.org/annotation/manifest',
    ]);
  });

  test('loads external Scene and painted-content pages and reports failed pages', async () => {
    const input = manifestWithAnnotationPages(true);
    (input.items[0].annotations as any[]).push({
      id: 'https://example.org/page/failing',
      type: 'AnnotationPage',
    });
    const { vault, manifest, scene } = normalized(input);
    const diagnostic = vi.fn();
    const responses: Record<string, unknown> = {
      'https://example.org/page/scene': {
        id: 'https://example.org/page/scene',
        type: 'AnnotationPage',
        items: [annotation('https://example.org/annotation/scene', scene.id)],
      },
      'https://example.org/page/model': {
        id: 'https://example.org/page/model',
        type: 'AnnotationPage',
        items: [annotation('https://example.org/annotation/model', 'https://example.org/model')],
      },
    };
    vi.spyOn(vault, 'load').mockImplementation(async (id: any) => {
      const key = typeof id === 'string' ? id : id.id;
      if (key === 'https://example.org/page/failing') throw new Error('offline');
      return vault.loadSync(key, responses[key]) as any;
    });

    function Probe() {
      return (
        <span>
          {useSceneAnnotations()
            .map(({ id }) => id)
            .join(',')}
        </span>
      );
    }
    render(
      <SceneRuntimeContext.Provider value={{ vault, manifest, scene, diagnostic } as any}>
        <Probe />
      </SceneRuntimeContext.Provider>
    );

    await screen.findByText(
      'https://example.org/annotation/scene,https://example.org/annotation/model,https://example.org/annotation/manifest'
    );
    expect(vault.load).toHaveBeenCalledWith('https://example.org/page/scene');
    expect(vault.load).toHaveBeenCalledWith('https://example.org/page/model');
    expect(vault.load).not.toHaveBeenCalledWith('https://example.org/page/manifest');
    await waitFor(() =>
      expect(diagnostic).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'annotation-page-load-failed',
          resourceId: 'https://example.org/page/failing',
          cause: expect.any(Error),
        })
      )
    );
  });
});
