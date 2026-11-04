/** @vitest-environment happy-dom */
import React from 'react';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { ResourceProvider } from '../src/context/ResourceContext';
import { AuthRContext } from '../src/context/AuthContext';
import { createAuthStateStore } from '../src/future-helpers/auth';
import { ModelAuthGate } from '../src/scene-panel/model-auth';
import { SceneProvider, useSceneRuntime } from '../src/scene-panel/context';
import { loadProtectedModel } from '../src/scene-panel/protected-model-loader';

const { mockGl } = vi.hoisted(() => ({ mockGl: {} }));
vi.mock('@react-three/fiber', async (original) => ({
  ...(await original<any>()),
  useThree: (select: any) => select({ gl: mockGl }),
}));
const model = 'https://models.example/ueno.glb';
const probe = 'https://models.example/probe';
const access: any = {
  id: 'https://models.example/access',
  type: 'AuthAccessService2',
  profile: 'active',
  service: [{ id: 'https://models.example/token', type: 'AuthAccessTokenService2' }],
};
const resource = {
  id: model,
  type: 'Model',
  format: 'model/gltf-binary',
  service: [{ id: probe, type: 'AuthProbeService2', service: [access] }],
};
const paintable = { resource, annotationId: 'painting', rawType: 'Model' } as any;
const bytes = (json: any) => new TextEncoder().encode(JSON.stringify(json)).buffer;
const empty = { asset: { version: '2.0' }, scenes: [{ nodes: [] }], scene: 0 };
let stores: ReturnType<typeof createAuthStateStore>[] = [];
afterEach(() => {
  cleanup();
  for (const store of stores) store.getState().dispose();
  stores = [];
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
function store() {
  const value = createAuthStateStore();
  stores.push(value);
  return value;
}
function session(auth: ReturnType<typeof store>, token: string | null) {
  auth.setState((state) => ({
    authItems: state.authItems.map((item) => ({
      ...item,
      isPending: false,
      isLoggedIn: !!token,
      session: token ? { token, expires: Date.now() + 60000 } : null,
    })),
  }));
}
function mount(auth: ReturnType<typeof store>, initial = paintable, loader: 'gltf' | 'unsupported' = 'gltf') {
  let runtime!: ReturnType<typeof useSceneRuntime>;
  function Body({ current }: any) {
    runtime = useSceneRuntime();
    return (
      <ModelAuthGate paintable={current} path="model" loader={loader}>
        <span>visible:{current.resource.id}</span>
      </ModelAuthGate>
    );
  }
  const scene: any = { id: 'https://example.org/scene', type: 'Scene', items: [] };
  const tree = (current: any) => (
    <ResourceProvider value={{ canvas: 'inherited-canvas' }}>
      <AuthRContext.Provider value={auth}>
        <SceneProvider scene={scene} onSelectAnnotation={() => {}}>
          <Body current={current} />
        </SceneProvider>
      </AuthRContext.Provider>
    </ResourceProvider>
  );
  const view = render(tree(initial));
  return { ...view, runtime: () => runtime, choose: (current: any) => view.rerender(tree(current)) };
}

test('real auth store gates GET, revokes and reloads private content after reauthorization', async () => {
  vi.spyOn(KTX2Loader.prototype, 'detectSupport').mockReturnThis();
  const auth = store();
  const requests: { url: string; options: any }[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, options: any) => {
      requests.push({ url, options });
      if (url === probe) return { ok: true, json: async () => ({ status: options.headers.Authorization ? 200 : 401 }) };
      return { ok: true, arrayBuffer: async () => bytes(empty) };
    })
  );
  const view = mount(auth);
  await waitFor(() => expect(auth.getState().authItems).toHaveLength(1));
  await waitFor(() => expect(view.runtime().store.getState().resourceStatuses.model.status).toBe('auth-required'));
  expect(requests.filter((r) => r.url === model)).toHaveLength(0);
  act(() => session(auth, 'first'));
  await view.findByText(`visible:${model}`);
  expect(requests.filter((r) => r.url === model)).toHaveLength(1);
  // Host status updates can change callback/context identity without changing
  // the authorized resource. They must not restart its private transport.
  view.choose(paintable);
  await act(async () => {
    await Promise.resolve();
  });
  expect(requests.filter((r) => r.url === model)).toHaveLength(1);
  act(() => session(auth, null));
  await waitFor(() => expect(view.queryByText(`visible:${model}`)).toBeNull());
  act(() => session(auth, 'second'));
  await view.findByText(`visible:${model}`);
  expect(requests.filter((r) => r.url === model)).toHaveLength(2);
  for (const request of requests.filter((r) => r.url === model)) {
    expect(request.options.credentials).toBe('include');
    expect(request.options.headers).toBeUndefined();
  }
  expect(view.runtime().handle().getSnapshot().errors).toEqual({});
});

test('credential scope snapshots every dependency and rejects unknown network paths', async () => {
  const created: string[] = [];
  vi.spyOn(URL, 'createObjectURL').mockImplementation(() => {
    const value = `blob:private-${created.length}`;
    created.push(value);
    return value;
  });
  const revoked = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  const json = {
    ...empty,
    buffers: [{ uri: 'mesh.bin' }, { uri: 'https://foreign.example/mesh.bin' }],
    images: [{ uri: 'texture.png' }],
  };
  const fetcher = vi.fn(async (url: string, options: any) => {
    expect(options.headers).toBeUndefined();
    expect(options.credentials).toBe(url.startsWith('https://foreign.example/') ? 'omit' : 'include');
    expect(options.redirect).toBe('error');
    return { ok: true, arrayBuffer: async () => bytes(json), blob: async () => new Blob(['data']) };
  });
  vi.stubGlobal('fetch', fetcher);
  vi.spyOn(GLTFLoader.prototype, 'parseAsync').mockImplementation(async function (this: GLTFLoader) {
    expect(this.withCredentials).toBe(false);
    expect(this.manager.resolveURL('https://models.example/mesh.bin')).toBe('blob:private-0');
    expect(this.manager.resolveURL('https://foreign.example/mesh.bin')).toBe('blob:private-1');
    expect(this.manager.resolveURL('https://models.example/texture.png')).toBe('blob:private-2');
    expect(() => this.manager.resolveURL('https://cdn.example/decoder.js')).toThrow(
      'Unsupported external model dependency'
    );
    return { scenes: [] } as any;
  });
  await loadProtectedModel(model, new AbortController().signal);
  expect(fetcher.mock.calls.map(([url]) => url)).toEqual([
    model,
    'https://models.example/mesh.bin',
    'https://foreign.example/mesh.bin',
    'https://models.example/texture.png',
  ]);
  expect(revoked).toHaveBeenCalledTimes(3);
});

test('unsupported protected formats settle with an explicit diagnostic before fetching or invoking a renderer', async () => {
  const fetcher = vi.fn(async (_url: string) => ({ ok: true, json: async () => ({ status: 200 }) }));
  vi.stubGlobal('fetch', fetcher);
  const current = {
    ...paintable,
    resource: { ...resource, id: 'https://models.example/object.splat', format: 'application/octet-stream' },
  };
  const view = mount(store(), current, 'unsupported');
  await waitFor(() => expect(view.runtime().store.getState().resourceStatuses.model.status).toBe('error'));
  expect(view.runtime().store.getState().resourceStatuses.model.error?.code).toBe('unsupported-protected-model-format');
  expect(view.queryByText(`visible:${current.resource.id}`)).toBeNull();
  expect(fetcher.mock.calls.every(([url]) => url === probe)).toBe(true);
});

test('choice changes and unmount abort old model GETs and cannot publish stale success', async () => {
  vi.spyOn(KTX2Loader.prototype, 'detectSupport').mockReturnThis();
  const auth = store();
  const pending: { url: string; signal: AbortSignal; resolve: (response: any) => void }[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, options: any) =>
      url.includes('probe')
        ? Promise.resolve({ ok: true, json: async () => ({ status: 200 }) })
        : new Promise((resolve) => pending.push({ url, signal: options.signal, resolve }))
    )
  );
  const view = mount(auth);
  await waitFor(() => expect(pending).toHaveLength(1));
  const other = { ...paintable, resource: { ...resource, id: 'https://models.example/other.glb' } };
  view.choose(other);
  await waitFor(() => expect(pending).toHaveLength(2));
  expect(pending[0].signal.aborted).toBe(true);
  await act(async () => pending[0].resolve({ ok: true, arrayBuffer: async () => bytes(empty) }));
  expect(view.queryByText(`visible:${model}`)).toBeNull();
  view.unmount();
  expect(pending[1].signal.aborted).toBe(true);
});

test('private failures settle and retry via real probe retry; unprotected content never uses private loader', async () => {
  vi.spyOn(KTX2Loader.prototype, 'detectSupport').mockReturnThis();
  const auth = store();
  let fail = true;
  const fetcher = vi.fn(async (url: string) =>
    url === probe
      ? { ok: true, json: async () => ({ status: 200 }) }
      : { ok: !fail, status: 403, arrayBuffer: async () => bytes(empty) }
  );
  vi.stubGlobal('fetch', fetcher);
  const view = mount(auth);
  await waitFor(() => expect(view.runtime().store.getState().resourceStatuses.model.status).toBe('error'));
  expect(fetcher.mock.calls.filter(([url]) => url === model)).toHaveLength(1);
  fail = false;
  await act(async () => {
    await Object.values(auth.getState().resources)[0].probe.retry();
  });
  await view.findByText(`visible:${model}`);
  view.choose({ ...paintable, resource: { id: 'public.glb', type: 'Model' } });
  await view.findByText('visible:public.glb');
  expect(fetcher.mock.calls.filter(([url]) => url === 'public.glb')).toHaveLength(0);
});

test('a denied substitute stays gated without fetching the original', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: true,
      json: async () => ({
        status: 401,
        substitute: { id: 'https://other.example/sub.glb' },
      }),
    }))
  );
  const view = mount(store());
  await waitFor(() =>
    expect(view.runtime().store.getState().resourceStatuses.model.error?.code).toBe(
      'model-auth-alternative-unsupported'
    )
  );
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(view.queryByText(`visible:${model}`)).toBeNull();
});

test('a successful 302 probe loads only its signed Model location and refreshes it after revocation', async () => {
  vi.spyOn(KTX2Loader.prototype, 'detectSupport').mockReturnThis();
  const auth = store();
  let generation = 0;
  const fetcher = vi.fn(async (url: string, options: RequestInit) => {
    if (url === probe)
      return {
        ok: true,
        json: async () =>
          options.headers && (options.headers as Record<string, string>).Authorization
            ? {
                status: 302,
                location: {
                  id: `https://cdn.example/model.glb?sig=synthetic-${++generation}`,
                  type: 'Model',
                  format: 'model/gltf-binary',
                },
              }
            : { status: 401 },
      };
    expect(url).toMatch(/^https:\/\/cdn\.example\/model\.glb\?sig=synthetic-/);
    expect(options).toMatchObject({ credentials: 'omit', redirect: 'error' });
    expect(options.headers).toBeUndefined();
    return { ok: true, arrayBuffer: async () => bytes(empty) };
  });
  vi.stubGlobal('fetch', fetcher);
  const view = mount(auth);
  await waitFor(() => expect(auth.getState().authItems).toHaveLength(1));
  act(() => session(auth, 'first'));
  await view.findByText(`visible:${model}`);
  expect(Object.values(auth.getState().resources)[0].probe).toMatchObject({
    status: 'success',
    responseStatus: 302,
    shouldDisplayResource: false,
    shouldRedirect: true,
  });
  act(() => session(auth, null));
  await waitFor(() => expect(view.queryByText(`visible:${model}`)).toBeNull());
  act(() => session(auth, 'second'));
  await view.findByText(`visible:${model}`);
  expect(fetcher.mock.calls.filter(([url]) => url.startsWith('https://cdn.example/')).map(([url]) => url)).toEqual([
    'https://cdn.example/model.glb?sig=synthetic-1',
    'https://cdn.example/model.glb?sig=synthetic-2',
  ]);
  expect(fetcher.mock.calls.some(([url]) => url === model)).toBe(false);
});

test.each([
  { id: 'javascript:alert(1)', type: 'Model' },
  { id: 'https://user:password@cdn.example/model.glb', type: 'Model' },
  { id: 'https://cdn.example/model.glb', type: 'Image' },
  { id: 'https://cdn.example/model.glb', type: 'Model', format: 'image/jpeg' },
  { id: 'https://cdn.example/model.glb', type: 'Model', service: resource.service },
  { id: 'https://cdn.example/model.glb', type: 'Model', service: {} },
  { id: 'https://cdn.example/model.glb', type: 'Model', service: [null] },
])('unsafe or unsupported Auth location stays gated: $id $type', async (location) => {
  const fetcher = vi.fn(async (_url: string) => ({ ok: true, json: async () => ({ status: 302, location }) }));
  vi.stubGlobal('fetch', fetcher);
  const view = mount(store());
  await waitFor(() => expect(view.runtime().store.getState().resourceStatuses.model).toBeDefined());
  await waitFor(() =>
    expect(Object.values(view.runtime().store.getState().resourceStatuses)[0].status).not.toBe('loading')
  );
  expect(view.queryByText(`visible:${model}`)).toBeNull();
  expect(fetcher.mock.calls.every(([url]) => url === probe)).toBe(true);
});

test('identical protected URLs in different auth contexts never reuse a loaded private result', async () => {
  vi.spyOn(KTX2Loader.prototype, 'detectSupport').mockReturnThis();
  const first = store();
  const second = store();
  const fetcher = vi.fn(async (url: string, options: any) =>
    url === probe
      ? { ok: true, json: async () => ({ status: options.headers.Authorization ? 200 : 401 }) }
      : { ok: true, arrayBuffer: async () => bytes(empty) }
  );
  vi.stubGlobal('fetch', fetcher);
  const a = mount(first);
  const b = mount(second);
  await waitFor(() => expect(first.getState().authItems).toHaveLength(1));
  await waitFor(() => expect(second.getState().authItems).toHaveLength(1));
  act(() => session(first, 'one'));
  await waitFor(() => expect(a.container.textContent).toBe(`visible:${model}`));
  expect(b.container.textContent).toBe('');
  act(() => session(second, 'two'));
  await waitFor(() => expect(b.container.textContent).toBe(`visible:${model}`));
  expect(fetcher.mock.calls.filter(([url]) => url === model)).toHaveLength(2);
  act(() => session(first, null));
  await waitFor(() => expect(a.container.textContent).toBe(''));
  expect(b.container.textContent).toBe(`visible:${model}`);
  expect(Object.values(first.getState().resources)[0].canvasId).toBeUndefined();
});

test('binary GLB JSON dependencies use the same scoped credential transport', async () => {
  const json = JSON.stringify({ ...empty, buffers: [{ uri: 'external.bin' }] });
  const padded = json.padEnd(Math.ceil(json.length / 4) * 4, ' ');
  const binary = new ArrayBuffer(20 + padded.length);
  const header = new DataView(binary);
  header.setUint32(0, 0x46546c67, true);
  header.setUint32(4, 2, true);
  header.setUint32(8, binary.byteLength, true);
  header.setUint32(12, padded.length, true);
  header.setUint32(16, 0x4e4f534a, true);
  new Uint8Array(binary, 20).set(new TextEncoder().encode(padded));
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:binary-dependency');
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  const fetcher = vi.fn(async () => ({
    ok: true,
    arrayBuffer: async () => binary,
    blob: async () => new Blob(['buffer']),
  }));
  vi.stubGlobal('fetch', fetcher);
  vi.spyOn(GLTFLoader.prototype, 'parseAsync').mockImplementation(async function (this: GLTFLoader, data) {
    expect(data).toBe(binary);
    expect(this.manager.resolveURL('https://models.example/external.bin')).toBe('blob:binary-dependency');
    return { scenes: [] } as any;
  });
  await loadProtectedModel(model, new AbortController().signal);
  expect(fetcher).toHaveBeenCalledWith(
    'https://models.example/external.bin',
    expect.objectContaining({ credentials: 'include', redirect: 'error' })
  );
});

test('real popup/token login expires, hides the model and reauthorization fetches it again', async () => {
  vi.spyOn(KTX2Loader.prototype, 'detectSupport').mockReturnThis();
  vi.spyOn(window, 'open').mockReturnValue({ closed: true } as Window);
  const append = document.body.appendChild.bind(document.body);
  vi.spyOn(document.body, 'appendChild').mockImplementation((node) => {
    if (!(node instanceof HTMLIFrameElement)) return append(node);
    const url = new URL(node.src);
    node.src = 'about:blank';
    append(node);
    queueMicrotask(() =>
      window.dispatchEvent(
        new MessageEvent('message', {
          origin: url.origin,
          source: node.contentWindow,
          data: {
            type: 'AuthAccessToken2',
            messageId: url.searchParams.get('messageId'),
            accessToken: 'short-lived',
            expiresIn: 1,
          },
        })
      )
    );
    return node;
  });
  const fetcher = vi.fn(async (url: string, options: any) =>
    url === probe
      ? { ok: true, json: async () => ({ status: options.headers.Authorization ? 200 : 401 }) }
      : { ok: true, arrayBuffer: async () => bytes(empty) }
  );
  vi.stubGlobal('fetch', fetcher);
  const auth = store();
  const view = mount(auth);
  await waitFor(() => expect(auth.getState().authItems).toHaveLength(1));
  vi.useFakeTimers();
  try {
    act(() => {
      void auth.getState().login();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(501);
    });
    expect(view.container.textContent).toBe(`visible:${model}`);
    expect(fetcher.mock.calls.filter(([url]) => url === model)).toHaveLength(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1001);
    });
    expect(view.container.textContent).toBe('');
    expect(view.runtime().store.getState().resourceStatuses.model.status).toBe('auth-required');
    act(() => {
      void auth.getState().login();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(501);
    });
    expect(view.container.textContent).toBe(`visible:${model}`);
    expect(fetcher.mock.calls.filter(([url]) => url === model)).toHaveLength(2);
  } finally {
    vi.useRealTimers();
  }
});

test('a probe response from a revoked session cannot authorize a model GET', async () => {
  const auth = store();
  let finish!: (value: any) => void;
  const fetcher = vi.fn((url: string, options: any) => {
    if (url !== probe) throw new Error('Denied model must not be fetched');
    if (options.headers.Authorization)
      return new Promise((resolve) => {
        finish = resolve;
      });
    return Promise.resolve({ ok: true, json: async () => ({ status: 401 }) });
  });
  vi.stubGlobal('fetch', fetcher);
  const view = mount(auth);
  await waitFor(() => expect(auth.getState().authItems).toHaveLength(1));
  act(() => session(auth, 'revoked'));
  await waitFor(() => expect(finish).toBeTypeOf('function'));
  act(() => session(auth, null));
  await act(async () => {
    finish({ ok: true, json: async () => ({ status: 200 }) });
  });
  await waitFor(() => expect(view.runtime().store.getState().resourceStatuses.model.status).toBe('auth-required'));
  expect(view.container.textContent).toBe('');
  expect(fetcher.mock.calls.every(([url]) => url === probe)).toBe(true);
});
