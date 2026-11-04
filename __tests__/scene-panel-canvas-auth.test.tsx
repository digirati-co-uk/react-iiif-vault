/** @vitest-environment happy-dom */
import React from 'react';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { act, waitFor } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { Texture, TextureLoader } from 'three';
import { Vault4 } from '@iiif/helpers/vault-4';
import { AuthRContext } from '../src/context/AuthContext';
import { ResourceProvider } from '../src/context/ResourceContext';
import { createAuthStateStore } from '../src/future-helpers/auth';
import { CanvasResource } from '../src/scene-panel/canvas-rendering';
import { SceneRuntimeContext } from '../src/scene-panel/context';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
test('Canvas textures discover shared Auth, gate requests and dispose on revocation', async () => {
  const serviceId = 'https://images.example/canvas-auth';
  const probeId = 'https://images.example/canvas-probe';
  const access = {
    id: 'https://images.example/canvas-access',
    type: 'AuthAccessService2',
    profile: 'active',
    service: [{ id: 'https://images.example/canvas-token', type: 'AuthAccessTokenService2' }],
  };
  const fullService = {
    id: serviceId,
    type: 'ImageService3',
    profile: 'level2',
    width: 100,
    height: 50,
    tiles: [{ width: 256, scaleFactors: [1] }],
    service: [{ id: probeId, type: 'AuthProbeService2', service: [access] }],
  };
  const requests: { url: string; options: any }[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: any, options: any = {}) => {
      const url = String(input);
      requests.push({ url, options });
      if (url === `${serviceId}/info.json`) return { ok: true, json: async () => fullService };
      if (url === probeId)
        return { ok: true, json: async () => ({ status: options.headers?.Authorization ? 200 : 401 }) };
      return { ok: true, blob: async () => new Blob(['private']) };
    })
  );
  const revoke = vi.fn();
  const OriginalURL = URL;
  vi.stubGlobal(
    'URL',
    class extends OriginalURL {
      static createObjectURL() {
        return 'blob:canvas-private';
      }
      static revokeObjectURL = revoke;
    }
  );
  const textures: Texture[] = [];
  const loaded = vi.spyOn(TextureLoader.prototype, 'load').mockImplementation((url, onLoad) => {
    expect(url).toBe('blob:canvas-private');
    const texture = new Texture(document.createElement('img'));
    textures.push(texture);
    vi.spyOn(texture, 'dispose');
    queueMicrotask(() => onLoad?.(texture));
    return texture;
  });
  const vault = new Vault4();
  const canvas = vault.loadSync<any>('canvas-auth', {
    id: 'canvas-auth',
    type: 'Canvas',
    width: 100,
    height: 50,
    items: [
      {
        id: 'page-auth',
        type: 'AnnotationPage',
        items: [
          {
            id: 'painting-auth',
            type: 'Annotation',
            motivation: 'painting',
            target: 'canvas-auth',
            body: {
              id: 'https://images.example/fallback.jpg',
              type: 'Image',
              width: 100,
              height: 50,
              service: [{ id: serviceId, type: 'ImageService3', profile: 'level2' }],
            },
          },
        ],
      },
    ],
  });
  const auth = createAuthStateStore();
  let renderer!: Awaited<ReturnType<typeof ReactThreeTestRenderer.create>>;
  try {
    await act(async () => {
      renderer = await ReactThreeTestRenderer.create(
        <ResourceProvider value={{ canvas: 'unrelated-canvas' }}>
          <AuthRContext.Provider value={auth}>
            <SceneRuntimeContext.Provider value={{ vault, scene: { id: 'scene' }, diagnostic: vi.fn() } as any}>
              <CanvasResource
                {...({
                  resource: canvas,
                  clock: { time: 0, playing: false, playbackRate: 1 },
                  paintable: { target: { source: { type: 'Scene' }, geometry: null }, timeMode: 'trim' },
                } as any)}
              />
            </SceneRuntimeContext.Provider>
          </AuthRContext.Provider>
        </ResourceProvider>
      );
    });
    await waitFor(() => expect(auth.getState().authItems).toHaveLength(1));
    expect(loaded).not.toHaveBeenCalled();
    expect(requests.every(({ url }) => url.endsWith('/info.json') || url === probeId)).toBe(true);
    expect(Object.values(auth.getState().resources)[0].canvasId).toBeUndefined();
    const session = (token: string | null) =>
      auth.setState((state) => ({
        authItems: state.authItems.map((item) => ({
          ...item,
          isPending: false,
          isLoggedIn: !!token,
          session: token ? { token, expires: Date.now() + 60000 } : null,
        })),
      }));
    await act(async () => session('first'));
    await waitFor(() => expect(loaded).toHaveBeenCalledTimes(1));
    await act(async () => session(null));
    expect(textures[0].dispose).toHaveBeenCalled();
    expect(revoke).toHaveBeenCalledWith('blob:canvas-private');
    await act(async () => session('second'));
    await waitFor(() => expect(loaded).toHaveBeenCalledTimes(2));
    for (const { options } of requests.filter(({ url }) => url.includes('/full/'))) {
      expect(options).toMatchObject({ credentials: 'include', redirect: 'error' });
      expect(options.headers).toBeUndefined();
    }
  } finally {
    if (renderer) await act(() => renderer.unmount());
    auth.getState().dispose();
  }
});
