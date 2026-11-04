/** @vitest-environment node */
import { afterEach, expect, test, vi } from 'vitest';
import { disposeProtectedModel, loadProtectedModel } from '../src/scene-panel/protected-model-loader';

const root = 'https://models.example/model.gltf';
const viewer = 'https://viewer.example/private.bin';
const texture = 'https://viewer.example/private.png';
const positions = new Float32Array([-1, 0, 0, 1, 0, 0, 0, 2, 0]);
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR4nGP4DwQACfsD/fteaysAAAAASUVORK5CYII=',
  'base64'
);
const json = {
  asset: { version: '2.0' },
  scene: 0,
  scenes: [{ nodes: [0] }],
  nodes: [{ mesh: 0 }],
  meshes: [{ primitives: [{ attributes: { POSITION: 0 }, material: 0 }] }],
  materials: [{ pbrMetallicRoughness: { baseColorTexture: { index: 0 } } }],
  textures: [{ source: 0 }],
  images: [{ uri: texture }],
  buffers: [{ uri: viewer, byteLength: positions.byteLength }],
  bufferViews: [{ buffer: 0, byteLength: positions.byteLength }],
  accessors: [{ bufferView: 0, componentType: 5126, count: 3, type: 'VEC3', min: [-1, 0, 0], max: [1, 2, 0] }],
};
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

test('real glTF parsing receives only private blobs; viewer-origin foreign assets omit credentials and forbid redirects', async () => {
  const nativeFetch = globalThis.fetch;
  const requests: Array<{ url: string; credentials?: RequestCredentials; redirect?: RequestRedirect }> = [];
  vi.stubGlobal('location', { href: 'https://viewer.example/app' });
  vi.stubGlobal('self', globalThis);
  vi.stubGlobal('ProgressEvent', class ProgressEvent {});
  vi.stubGlobal(
    'createImageBitmap',
    vi.fn(async () => ({ width: 1, height: 1, close() {} }))
  );
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, options?: RequestInit) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url.startsWith('blob:')) return nativeFetch(input, options);
      requests.push({ url, credentials: options?.credentials, redirect: options?.redirect });
      if (url === root) return new Response(JSON.stringify(json));
      if (url === viewer) return new Response(positions.buffer);
      if (url === texture)
        return new Response(Uint8Array.from(png).buffer, { headers: { 'Content-Type': 'image/png' } });
      throw new Error(`Unexpected network request: ${url}`);
    })
  );
  const model = await loadProtectedModel(root, new AbortController().signal);
  expect(model.scene.children[0].type).toBe('Mesh');
  expect(requests).toEqual([
    { url: root, credentials: 'include', redirect: 'error' },
    { url: viewer, credentials: 'omit', redirect: 'error' },
    { url: texture, credentials: 'omit', redirect: 'error' },
  ]);
  disposeProtectedModel(model);
});

test('a foreign dependency redirect is rejected before the viewer endpoint or parser can receive it', async () => {
  const requests: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string, options: RequestInit) => {
      requests.push(input);
      if (input === root) return new Response(JSON.stringify({ ...json, images: [] }));
      expect(options).toMatchObject({ credentials: 'omit', redirect: 'error' });
      // Native fetch rejects a redirect under this policy rather than following it.
      throw new TypeError('Redirect forbidden');
    })
  );
  await expect(loadProtectedModel(root, new AbortController().signal)).rejects.toThrow('Redirect forbidden');
  expect(requests).toEqual([root, viewer]);
});
