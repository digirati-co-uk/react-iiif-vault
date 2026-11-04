import { LoadingManager, type Object3D, type Texture } from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

/** Dispose only instance-owned protected content, never the shared useGLTF cache. */
export function disposeProtectedModel(gltf: GLTF) {
  const disposed = new Set<any>();
  for (const scene of gltf.scenes)
    scene.traverse((object: Object3D & { geometry?: any; material?: any }) => {
      const dispose = (value: any) => {
        if (value && !disposed.has(value)) {
          disposed.add(value);
          value.dispose?.();
        }
      };
      dispose(object.geometry);
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        if (!material) continue;
        for (const value of Object.values(material)) if ((value as Texture)?.isTexture) dispose(value);
        dispose(material);
      }
    });
}

function modelJson(data: ArrayBuffer) {
  const view = new DataView(data);
  if (data.byteLength >= 20 && view.getUint32(0, true) === 0x46546c67) {
    if (view.getUint32(16, true) !== 0x4e4f534a) throw new Error('Missing glTF JSON chunk');
    return JSON.parse(new TextDecoder().decode(new Uint8Array(data, 20, view.getUint32(12, true))));
  }
  return JSON.parse(new TextDecoder().decode(data));
}

/** Content authorization is cookies/aspects only. This API deliberately accepts no token. */
export async function loadProtectedModel(
  id: string,
  signal: AbortSignal,
  configure?: (loader: GLTFLoader) => void,
  options: { ktx2TranscoderPath?: string; credentials?: 'include' | 'omit' } = {}
): Promise<GLTF> {
  const root = new URL(id, globalThis.location?.href);
  if (!['http:', 'https:'].includes(root.protocol)) throw new Error('Protected model must use HTTP(S)');
  const blobs: string[] = [];
  const manager = new LoadingManager();
  const abort = () => manager.abort();
  signal.addEventListener('abort', abort);
  const loader = new GLTFLoader(manager);
  const draco = new DRACOLoader(manager).setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
  loader.setDRACOLoader(draco).setMeshoptDecoder(MeshoptDecoder).setWithCredentials(false);
  configure?.(loader);
  const fetchContent = async (url: string, credentials: RequestCredentials) => {
    const response = await fetch(url, { credentials, signal, redirect: 'error' });
    if (!response.ok) throw new Error(`Model request failed (${response.status})`);
    return response;
  };
  try {
    const rootCredentials = options.credentials ?? 'include';
    const data = await (await fetchContent(root.href, rootCredentials)).arrayBuffer();
    signal.throwIfAborted();
    const json = modelJson(data);
    const replacements = new Map<string, string>();
    // Own every network request. Three's "anonymous" loaders still send cookies
    // to viewer-origin URLs and follow redirects, so they never receive raw URLs.
    const uris = new Set<string>(
      [...(json.buffers || []), ...(json.images || [])]
        .map((entry: any) => entry.uri)
        .filter((uri: unknown): uri is string => typeof uri === 'string')
        .map((uri: string) => new URL(uri, root).href)
    );
    const snapshot = async (uri: string, credentials: RequestCredentials) => {
      const url = new URL(uri);
      if (url.protocol === 'data:' || url.protocol === 'blob:') return;
      if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Unsupported model dependency URL');
      const blob = await (await fetchContent(uri, credentials)).blob();
      signal.throwIfAborted();
      const local = URL.createObjectURL(blob);
      blobs.push(local);
      replacements.set(uri, local);
    };
    const snapshotAll = async (requests: Array<[string, RequestCredentials]>) => {
      // Wait for siblings before releasing blobs if any request fails.
      const results = await Promise.allSettled(requests.map(([uri, credentials]) => snapshot(uri, credentials)));
      for (const result of results) if (result.status === 'rejected') throw result.reason;
    };
    await snapshotAll([...uris].map((uri) => [uri, new URL(uri).origin === root.origin ? rootCredentials : 'omit']));
    const extensions = json.extensionsUsed || [];
    if (extensions.includes('KHR_draco_mesh_compression')) {
      const base = 'https://www.gstatic.com/draco/versioned/decoders/1.5.7/';
      await snapshotAll(
        ['draco_wasm_wrapper.js', 'draco_decoder.wasm', 'draco_decoder.js'].map((name) => [base + name, 'omit'])
      );
    }
    if (extensions.includes('KHR_texture_basisu')) {
      if (!options.ktx2TranscoderPath) throw new Error('Protected KTX2 model requires a transcoder path');
      const base = new URL(options.ktx2TranscoderPath, globalThis.location?.href).href;
      await snapshotAll(
        ['basis_transcoder.js', 'basis_transcoder.wasm'].map((name) => [new URL(name, base).href, 'omit'])
      );
    }
    manager.setURLModifier((url) => {
      const resolved = new URL(url, root);
      const local = replacements.get(resolved.href);
      if (local) return local;
      if (resolved.protocol === 'data:' || resolved.protocol === 'blob:') return url;
      // Extension-specific network paths must opt into the scoped transport.
      throw new Error('Unsupported external model dependency');
    });
    const parsing = loader.parseAsync(data, new URL('.', root).href);
    let cancelParse: () => void = () => {};
    const cancelled = new Promise<never>((_, reject) => {
      cancelParse = () => reject(signal.reason || new Error('Model load aborted'));
      signal.addEventListener('abort', cancelParse, { once: true });
      if (signal.aborted) cancelParse();
    });
    // Three cannot cancel every decoder/image operation; release any late result.
    void parsing.then(
      (gltf) => {
        if (signal.aborted) disposeProtectedModel(gltf);
      },
      () => {}
    );
    let gltf: GLTF;
    try {
      gltf = await Promise.race([parsing, cancelled]);
    } finally {
      signal.removeEventListener('abort', cancelParse);
    }
    if (signal.aborted) {
      disposeProtectedModel(gltf);
      signal.throwIfAborted();
    }
    return gltf;
  } finally {
    signal.removeEventListener('abort', abort);
    for (const blob of blobs) URL.revokeObjectURL(blob);
    draco.dispose();
  }
}
