/**
 * @vitest-environment happy-dom
 */

import { Vault4 } from '@iiif/helpers/vault-4';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { ContainerContext } from '../src/context/ContainerContext';
import { ManifestContext } from '../src/context/ManifestContext';
import { ResourceProvider, useResourceContext } from '../src/context/ResourceContext';
import { VaultProvider } from '../src/context/VaultContext';
import { getContainerSequence } from '../src/utility/container-sequence';
import { ContainerRouter } from '../src/viewers/ContainerRouter';
import { InnerViewerProvider, SimpleViewerProvider, useSimpleViewer } from '../src/viewers/SimpleViewerContext';
import { SimpleViewerProvider as Presentation4SimpleViewerProvider } from '../src/presentation-4';

const manifest = {
  '@context': 'http://iiif.io/api/presentation/4/context.json',
  id: 'https://example.org/manifest',
  type: 'Manifest',
  label: { en: ['Mixed containers'] },
  items: [
    { id: 'https://example.org/canvas/1', type: 'Canvas', width: 10, height: 10, items: [] },
    { id: 'https://example.org/scene', type: 'Scene', items: [] },
    { id: 'https://example.org/timeline', type: 'Timeline', duration: 10, items: [] },
    { id: 'https://example.org/canvas/2', type: 'Canvas', width: 10, height: 10, items: [] },
  ],
} as const;

function RoutedViewer() {
  const viewer = useSimpleViewer();
  const resources = useResourceContext();
  return (
    <>
      <ContainerRouter
        renderCanvas={({ containers }) => <div>Canvas:{containers.map(({ id }) => id).join(',')}</div>}
        renderScene={({ containers }) => <div>Scene:{containers[0].id}</div>}
        renderTimeline={({ containers }) => <div>Timeline:{containers[0].id}</div>}
      />
      <output>{JSON.stringify(resources)}</output>
      <button onClick={viewer.next}>Next</button>
    </>
  );
}

describe('container routing', () => {
  test('keeps mixed Manifest containers in order and does not page Canvases across them', () => {
    const vault = new Vault4();
    const loaded = vault.loadManifestSync(manifest.id, manifest as any)!;

    expect(getContainerSequence(vault, loaded)).toEqual([
      [
        { id: 'https://example.org/canvas/1', type: 'Canvas' },
        { id: 'https://example.org/scene', type: 'Scene' },
        { id: 'https://example.org/timeline', type: 'Timeline' },
        { id: 'https://example.org/canvas/2', type: 'Canvas' },
      ],
      [[0], [1], [2], [3]],
    ]);
  });

  test('preserves Canvas spreads without spanning Scene or Timeline route boundaries', () => {
    const vault = new Vault4();
    const paged = {
      ...manifest,
      behavior: ['paged'],
      items: [
        { id: 'canvas/1', type: 'Canvas', width: 10, height: 10, items: [] },
        { id: 'canvas/2', type: 'Canvas', width: 10, height: 10, items: [] },
        { id: 'canvas/3', type: 'Canvas', width: 10, height: 10, items: [] },
        { id: 'scene', type: 'Scene', items: [] },
        { id: 'canvas/4', type: 'Canvas', width: 10, height: 10, items: [] },
        { id: 'timeline', type: 'Timeline', duration: 1, items: [] },
        { id: 'canvas/5', type: 'Canvas', width: 10, height: 10, items: [] },
      ],
    };
    const loaded = vault.loadManifestSync(paged.id, paged as any)!;

    expect(getContainerSequence(vault, loaded)[1]).toEqual([[0], [1, 2], [3], [4], [5], [6]]);
  });

  test('can preserve legacy CanvasPanel navigation by excluding Scene routes', () => {
    const vault = new Vault4();
    const loaded = vault.loadManifestSync(manifest.id, manifest as any)!;

    expect(getContainerSequence(vault, loaded, { containerTypes: ['Canvas', 'Timeline'] })[0]).toEqual([
      { id: 'https://example.org/canvas/1', type: 'Canvas' },
      { id: 'https://example.org/timeline', type: 'Timeline' },
      { id: 'https://example.org/canvas/2', type: 'Canvas' },
    ]);
  });

  test('routes and scopes Canvas, Scene, and Timeline while exposing neutral navigation', () => {
    const vault = new Vault4();
    vault.loadManifestSync(manifest.id, manifest as any);

    render(
      <VaultProvider vault={vault} version={4}>
        <ManifestContext manifest={manifest.id}>
          <InnerViewerProvider manifest={manifest.id} pagingEnabled={false}>
            <RoutedViewer />
          </InnerViewerProvider>
        </ManifestContext>
      </VaultProvider>
    );

    expect(screen.getByText('Canvas:https://example.org/canvas/1')).toBeTruthy();
    expect(screen.getByRole('status').textContent).toContain('"canvas":"https://example.org/canvas/1"');

    fireEvent.click(screen.getByText('Next'));
    expect(screen.getByText('Scene:https://example.org/scene')).toBeTruthy();
    expect(screen.getByRole('status').textContent).toContain('"scene":"https://example.org/scene"');

    fireEvent.click(screen.getByText('Next'));
    expect(screen.getByText('Timeline:https://example.org/timeline')).toBeTruthy();
    expect(screen.getByRole('status').textContent).toContain('"timeline":"https://example.org/timeline"');
  });

  test('ContainerContext clears a parent container scope', () => {
    function Scope() {
      return <output>{JSON.stringify(useResourceContext())}</output>;
    }

    render(
      <ResourceProvider value={{ canvas: 'old-canvas' }}>
        <ContainerContext container={{ id: 'scene', type: 'Scene' }}>
          <Scope />
        </ContainerContext>
      </ResourceProvider>
    );

    expect(screen.getByRole('status').textContent).toBe('{"scene":"scene"}');
  });

  test('SimpleViewerProvider loads and routes using its explicit Vault4', async () => {
    const vault = new Vault4({
      customFetcher: async () => manifest as any,
    });

    render(
      <SimpleViewerProvider vault={vault} manifest={manifest.id} startContainer="https://example.org/scene">
        <ContainerRouter renderScene={({ containers }) => <div>Loaded:{containers[0].id}</div>} />
      </SimpleViewerProvider>
    );

    expect(await screen.findByText('Loaded:https://example.org/scene')).toBeTruthy();
    expect(vault.get({ id: manifest.id, type: 'Manifest' })).toBeTruthy();
  });

  test('the Presentation 4 entry point creates a Vault4 for Scene routing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json(manifest))
    );

    render(
      <Presentation4SimpleViewerProvider manifest={manifest.id} startContainer="https://example.org/scene">
        <ContainerRouter renderScene={({ containers }) => <div>Default Vault4:{containers[0].id}</div>} />
      </Presentation4SimpleViewerProvider>
    );

    expect(await screen.findByText('Default Vault4:https://example.org/scene')).toBeTruthy();
    vi.unstubAllGlobals();
  });
});
