/**
 * @vitest-environment happy-dom
 */

import { parseSceneTarget } from '@iiif/helpers/scenes';
import { Vault4 } from '@iiif/helpers/vault-4';
import React from 'react';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { act } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import type { Mesh } from 'three';
import { CanvasResource } from '../src/scene-panel/canvas-rendering';
import { SceneRuntimeContext } from '../src/scene-panel/context';

describe('four-corner Scene Canvases', () => {
  test('renders the Canvas background at its WKT corners', async () => {
    const input = {
      id: 'https://example.org/canvas',
      type: 'Canvas',
      width: 100,
      height: 50,
      items: [],
    };
    const vault = new Vault4();
    const canvas = vault.loadSync<any>(input.id, input)!;
    const target = parseSceneTarget({
      type: 'SpecificResource',
      source: { id: 'https://example.org/scene', type: 'Scene' },
      selector: {
        type: 'WktSelector',
        value: 'POLYGON Z ((0 1 0, 0 0 0, 2 0 0, 3 1 0, 0 1 0))',
      },
    });
    const runtime = {
      scene: { id: 'https://example.org/scene', type: 'Scene', items: [] },
      vault,
      diagnostic: vi.fn(),
    } as any;
    let renderer!: Awaited<ReturnType<typeof ReactThreeTestRenderer.create>>;
    await act(async () => {
      renderer = await ReactThreeTestRenderer.create(
        <SceneRuntimeContext.Provider value={runtime}>
          <CanvasResource
            {...({ resource: canvas, clock: { time: 0, playing: false, playbackRate: 1 } } as any)}
            paintable={{ target, timeMode: 'trim' } as any}
          />
        </SceneRuntimeContext.Provider>
      );
    });
    const mesh = renderer.scene.findByType('Mesh').instance as Mesh;

    expect(Array.from(mesh.geometry.getAttribute('position').array)).toEqual([0, 1, 0, 0, 0, 0, 2, 0, 0, 3, 1, 0]);
    expect(mesh.parent!.userData.rivCanvasPoint(50, 25, 0)).toEqual([1.25, 0.5, 0]);
    await act(() => renderer.unmount());
  });
});
