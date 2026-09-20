import React from 'react';
import { render, renderHook } from '@testing-library/react';
import { expect, test } from 'vitest';
import * as root from '../src';
import * as p4 from '../src/presentation-4';
import * as canvasPanel from '../src/canvas-panel';
import * as utils from '../src/utils';
import legacyExports from './fixtures/legacy-public-exports.json';
import { ImageService } from '../src/components/ImageService';
import { ResourceProvider } from '../src/context/ResourceContext';

// Snapshot of main's public values: a type-only re-export must not hide a component.
test('retains every main-branch runtime export and component identity', () => {
  for (const [name, entry] of Object.entries({ root, canvasPanel, utils })) {
    expect(Object.keys(entry)).toEqual(expect.arrayContaining(legacyExports[name as keyof typeof legacyExports]));
  }
  for (const entry of [root, p4]) {
    expect(entry.ImageService).toBe(ImageService);
    expect(entry.ResourceProvider).toBe(ResourceProvider);
  }
  expect(root.seraliseSupportedSelector).toBe(root.serialiseSupportedSelector);
  expect(p4.seraliseSupportedSelector).toBe(p4.serialiseSupportedSelector);
  function Probe() {
    return <span>{root.useResourceContext().canvas}</span>;
  }
  const view = render(<root.ResourceProvider value={{ canvas: 'legacy' }}><Probe /></root.ResourceProvider>);
  expect(view.container.textContent).toBe('legacy');
  view.unmount();
});

test('retains optional Vault3 arguments and the legacy collection property', () => {
  const vault = new root.Vault();
  vault.loadSync('https://example.org/collection', { id: 'https://example.org/collection', type: 'Collection', items: [] });
  function wrapper({ children }: { children: React.ReactNode }) {
    return <root.VaultProvider vault={vault}>{children}</root.VaultProvider>;
  }
  const result = renderHook(() => ({
    vault: root.useExistingVault(undefined),
    collection: root.useExternalCollection('https://example.org/collection'),
  }), { wrapper });
  expect(result.result.current.vault).toBe(vault);
  expect(result.result.current.collection.manifest).toBe(result.result.current.collection.collection);
  expect(result.result.current.collection.manifest?.id).toBe('https://example.org/collection');
  result.unmount();
});

test.each([3, 4] as const)('retains sequence navigation through the deprecated v%s hook', (version) => {
  const vault = version === 3 ? new root.Vault() : new p4.Vault();
  const manifest = 'https://example.org/manifest';
  const canvas = 'https://example.org/canvas';
  const type = version === 3 ? 'Canvas' : 'Timeline';
  vault.loadSync(manifest, {
    '@context': `http://iiif.io/api/presentation/${version}/context.json`,
    id: manifest, type: 'Manifest', items: [{ id: canvas, type, duration: 12, items: [] }],
  });
  const useLegacySequence = version === 3 ? root.useCanvasSequence : p4.useCanvasSequence;
  const result = renderHook(() => ({
    legacy: useLegacySequence({}),
    current: root.useContainerSequence({}),
  }), {
    wrapper: ({ children }) => <root.VaultProvider vault={vault} resources={{ manifest }}>{children}</root.VaultProvider>,
  });
  expect(result.result.current.legacy.items).toEqual([{ id: canvas, type }]);
  expect(result.result.current.legacy.items).toEqual(result.result.current.current.items);
  expect(result.result.current.legacy.visibleItems).toEqual([canvas]);
  result.unmount();
});
