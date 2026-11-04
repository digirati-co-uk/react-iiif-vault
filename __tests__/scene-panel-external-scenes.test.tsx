/** @vitest-environment happy-dom */
import React from 'react';
import { cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { Vault4 } from '@iiif/helpers/vault-4';
import { SceneProvider, useScene } from '../src/scene-panel/context';

afterEach(cleanup);
const sceneId = 'https://example.org/external-scene';
for (const selection of ['only item', 'manifest start', 'nested scene', 'nested canvas', 'embedded canvas']) {
  test(`loads an external Scene selected by ${selection} before readiness`, async () => {
    const vault = new Vault4();
    const external = {
      id: sceneId,
      type: selection.endsWith('canvas') ? 'Canvas' : 'Scene',
      ...(selection === 'embedded canvas'
        ? { width: 100, height: 50, items: [{ id: `${sceneId}/page`, type: 'AnnotationPage' }] }
        : {}),
    };
    const nested = selection.startsWith('nested') || selection === 'embedded canvas';
    const parent = {
      id: 'https://example.org/parent',
      type: 'Scene',
      items: [
        {
          id: 'https://example.org/parent/page',
          type: 'AnnotationPage',
          items: [
            {
              id: 'https://example.org/parent/painting',
              type: 'Annotation',
              motivation: 'painting',
              target: 'https://example.org/parent',
              body: external,
            },
          ],
        },
      ],
    };
    const manifest = {
      id: 'https://example.org/manifest',
      type: 'Manifest',
      ...(selection === 'manifest start' ? { start: external } : {}),
      items: nested
        ? [parent]
        : selection === 'manifest start'
          ? [external, { id: 'other', type: 'Scene', items: [] }]
          : [external],
    };
    const page = { id: `${sceneId}/page`, type: 'AnnotationPage', items: [] };
    const load = vi.spyOn(vault, 'load').mockImplementation(async (id: any) => {
      if (id === sceneId)
        return vault.loadSync(sceneId, { ...external, items: [{ id: page.id, type: 'AnnotationPage' }] });
      if (id === page.id) return vault.loadSync(page.id, page);
      throw new Error(`Unexpected request ${id}`);
    });
    const onReady = vi.fn();
    function Probe() {
      return <span>{useScene().id}</span>;
    }
    const view = render(
      <SceneProvider vault={vault} manifest={manifest as any} onReady={onReady}>
        <Probe />
      </SceneProvider>
    );
    await waitFor(() => expect(view.container.textContent).toBe(nested ? parent.id : sceneId));
    if (selection === 'embedded canvas') expect(load).not.toHaveBeenCalledWith(sceneId);
    else expect(load).toHaveBeenCalledWith(sceneId);
    expect(load).toHaveBeenCalledWith(page.id);
    expect(vault.get<any>(sceneId).items).toEqual([{ id: page.id, type: 'AnnotationPage' }]);
    expect(onReady).toHaveBeenCalledTimes(1);
  });
}

test('retains an embedded Scene when annotation references also mark it external', async () => {
  const vault = new Vault4();
  const id = 'https://example.org/embedded-scene';
  const manifest = {
    id: 'https://example.org/embedded-manifest',
    type: 'Manifest',
    items: [
      {
        id,
        type: 'Scene',
        items: [
          {
            id: `${id}/paintings`,
            type: 'AnnotationPage',
            items: [
              {
                id: `${id}/painting`,
                type: 'Annotation',
                motivation: 'painting',
                body: { id: 'https://example.org/model.glb', type: 'Model', format: 'model/gltf-binary' },
                target: {
                  type: 'SpecificResource',
                  source: { id, type: 'Scene' },
                  selector: [{ type: 'PointSelector', x: 0, y: 0, z: 0 }],
                },
              },
            ],
          },
        ],
      },
    ],
  };
  vault.loadSync(manifest.id, manifest);
  vault.loadSync('https://example.org/notes', {
    id: 'https://example.org/notes',
    type: 'AnnotationPage',
    items: [
      {
        id: 'https://example.org/note',
        type: 'Annotation',
        motivation: 'commenting',
        body: { type: 'TextualBody', value: 'A note' },
        target: {
          type: 'SpecificResource',
          source: { id, type: 'Scene' },
          selector: [{ type: 'PointSelector', x: 0, y: 0, z: 0 }],
        },
      },
    ],
  });
  const load = vi.spyOn(vault, 'load').mockRejectedValue(new Error('Embedded Scene must not be requested'));
  function Probe() {
    return <span>{useScene().id}</span>;
  }
  const view = render(
    <SceneProvider vault={vault} manifest={manifest.id} scene={id}>
      <Probe />
    </SceneProvider>
  );
  await waitFor(() => expect(view.container.textContent).toBe(id));
  expect(load).not.toHaveBeenCalled();
  expect(vault.get<any>(id).items).toHaveLength(1);
});
