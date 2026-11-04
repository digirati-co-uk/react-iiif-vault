/** @vitest-environment happy-dom */
import React, { Suspense } from 'react';
import { render, waitFor, cleanup } from '@testing-library/react';
import { ErrorBoundary } from 'react-error-boundary';
import { Group } from 'three';
import { afterEach, expect, test, vi } from 'vitest';
import { clearFailedModelLoad, useModelGLTF } from '../src/scene-panel/rendering-model';
import { useGLTF } from '@react-three/drei';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  useGLTF.clear('/retry.glb');
  useGLTF.clear('/shared.glb');
});

test('remount retries a rejected GLTF without evicting successful shared models', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  const attempts = new Map<string, number>();
  const load = vi.fn((url: string, onLoad: (result: any) => void, _progress: unknown, onError?: (cause: Error) => void) => {
    const count = (attempts.get(url) || 0) + 1;
    attempts.set(url, count);
    queueMicrotask(() => {
      if (url === '/retry.glb' && count === 1) onError?.(new Error('offline'));
      else
        onLoad({
          scene: new Group(),
          scenes: [],
          animations: [],
          cameras: [],
          asset: { version: '2.0' },
          parser: {},
        } as any);
    });
  });
  function Probe({ url }: { url: string }) {
    useModelGLTF(url, (loader) => { loader.load = load; });
    return <span>{url} ready</span>;
  }
  function Viewer({ url }: { url: string }) {
    return (
      <ErrorBoundary onError={() => clearFailedModelLoad(url)} fallback={<span>failed</span>}>
        <Suspense fallback={<span>loading</span>}>
          <Probe url={url} />
        </Suspense>
      </ErrorBoundary>
    );
  }
  const shared = render(<Viewer url="/shared.glb" />);
  await shared.findByText('/shared.glb ready');
  shared.unmount();
  const failed = render(<Viewer url="/retry.glb" />);
  await failed.findByText('failed');
  failed.unmount();
  const retry = render(<Viewer url="/retry.glb" />);
  await retry.findByText('/retry.glb ready');
  retry.unmount();
  clearFailedModelLoad('/shared.glb');
  const reused = render(<Viewer url="/shared.glb" />);
  await reused.findByText('/shared.glb ready');
  await waitFor(() => expect(load).toHaveBeenCalledTimes(3));
  expect(attempts.get('/retry.glb')).toBe(2);
  expect(attempts.get('/shared.glb')).toBe(1);
});
