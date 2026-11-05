/** @vitest-environment happy-dom */
import React from 'react';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { act } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { Vault4 } from '@iiif/helpers/vault-4';
import { CanvasResource } from '../src/scene-panel/canvas-rendering';
import { SceneRuntimeContext } from '../src/scene-panel/context';

afterEach(() => { vi.restoreAllMocks(); });
for (const [mode, time, expected, rate] of [
  ['trim', 8, 9, 1],
  ['scale', 8, 11, 2],
  ['loop', 14, 9, 1],
  ['trim', 17, 13, 1],
] as const) {
  test(`Canvas video preserves source interval during ${mode} at ${time}`, async () => {
    const vault = new Vault4();
    const canvas = vault.loadSync<any>('canvas', {
      id: 'canvas',
      type: 'Canvas',
      width: 100,
      height: 50,
      duration: 30,
      items: [
        {
          id: 'page',
          type: 'AnnotationPage',
          items: [
            {
              id: 'painting',
              type: 'Annotation',
              motivation: 'painting',
              timeMode: mode,
              target: {
                type: 'SpecificResource',
                source: { id: 'canvas', type: 'Canvas' },
                selector: { type: 'FragmentSelector', value: mode === 'scale' ? 't=6,9' : 't=6,25' },
              },
              body: {
                type: 'SpecificResource',
                source: { id: 'https://example.org/video.mp4', type: 'Video', width: 100, height: 50, duration: 30 },
                selector: { type: 'FragmentSelector', value: 't=7,13' },
              },
            },
          ],
        },
      ],
    });
    const videos: HTMLVideoElement[] = [];
    const create = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation(((tag: string, options: any) => {
      const element = create(tag, options);
      if (tag === 'video') videos.push(element as HTMLVideoElement);
      return element;
    }) as typeof document.createElement);
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
    vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {});
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
    let renderer!: Awaited<ReturnType<typeof ReactThreeTestRenderer.create>>;
    await act(async () => {
      renderer = await ReactThreeTestRenderer.create(
        <SceneRuntimeContext.Provider value={{ vault, scene: { id: 'scene' }, diagnostic: vi.fn() } as any}>
          <CanvasResource
            {...({
              resource: canvas,
              clock: { time, playing: false, playbackRate: 1 },
              paintable: { target: { source: { type: 'Scene' }, geometry: null }, timeMode: 'trim' },
            } as any)}
          />
        </SceneRuntimeContext.Provider>
      );
    });
    expect(videos).toHaveLength(1);
    expect(videos[0].currentTime).toBe(expected);
    expect(videos[0].playbackRate).toBe(rate);
    await act(() => renderer.unmount());
  });
}
