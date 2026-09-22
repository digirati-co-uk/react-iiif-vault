import React, { useEffect, StrictMode } from 'react';
import { act, render, waitFor } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { ReactAtlas, staticPreset, type WorldObject, type Preset } from '@atlas-viewer/atlas';
import { Vault, VaultProvider, CanvasContext } from '../src/core';
import { CanvasPanel, AtlasStoreProvider, VirtualAnnotationProvider } from '../src';
import {
  CanvasStrategyProvider,
  RenderCanvasScene,
  RenderImage,
  RenderComplexTimelineScene,
  ScenePresentationProvider,
  useComplexTimelineStore,
  useStrategy,
} from '../src/canvas-panel/scene';
import type { ComplexTimelineStrategy } from '../src/features/rendering-strategy/strategies';
import type { ComplexTimelineStore } from '../src/future-helpers/complex-timeline-store';
import type { StoreApi } from 'zustand';

const canvasId = 'https://example.org/scene/canvas';
function makeVault() {
  const vault = new Vault();
  vault.loadSync(canvasId, {
    id: canvasId,
    type: 'Canvas',
    width: 100,
    height: 80,
    items: [
      {
        id: canvasId + '/page',
        type: 'AnnotationPage',
        items: [
          {
            id: canvasId + '/painting',
            type: 'Annotation',
            motivation: 'painting',
            target: canvasId,
            body: { id: 'https://example.org/image.jpg', type: 'Image', width: 100, height: 80, format: 'image/jpeg' },
          },
        ],
      },
    ],
  });
  return vault;
}
function nativePreset() {
  return staticPreset({
    viewport: { width: 100, height: 80 } as any,
    forceRefresh: () => {},
    containerElement: document.createElement('div'),
  });
}
function stop(preset: Preset) {
  ReactAtlas.unmountComponentAtNode(preset.runtime);
  preset.unmount();
}

test('legacy and scene image compositions reconcile identical Atlas geometry and crops', async () => {
  const vault = makeVault();
  const native = nativePreset();
  const legacy = nativePreset();
  const wrap = (children: React.ReactNode) => (
    <VaultProvider vault={vault}>
      <CanvasContext canvas={canvasId}>{children}</CanvasContext>
    </VaultProvider>
  );
  await act(async () => {
    ReactAtlas.render(
      wrap(
        <CanvasStrategyProvider>
          <RenderCanvasScene x={15} y={20} />
        </CanvasStrategyProvider>
      ),
      native.runtime
    );
  });
  await act(async () => {
    ReactAtlas.render(
      wrap(
        <VirtualAnnotationProvider>
          <AtlasStoreProvider>
            <CanvasPanel.RenderCanvas x={15} y={20} />
          </AtlasStoreProvider>
        </VirtualAnnotationProvider>
      ),
      legacy.runtime
    );
  });
  await waitFor(() => expect(native.runtime.world.getObjects().length).toBe(1));
  await waitFor(() => expect(legacy.runtime.world.getObjects().length).toBe(1));
  const one = native.runtime.world.getObjects()[0] as WorldObject;
  const two = legacy.runtime.world.getObjects()[0] as WorldObject;
  expect(Array.from(one.points)).toEqual(Array.from(two.points));
  expect(Array.from(one.points).slice(1)).toEqual([15, 20, 115, 100]);
  expect(Array.from(one.layers[0].points)).toEqual(Array.from(two.layers[0].points));
  const crop = { x: 0, y: 0, width: 40, height: 30 };
  await act(async () => {
    ReactAtlas.render(
      <RenderImage
        id="origin-crop"
        image={
          {
            id: 'image.jpg',
            annotationId: 'a',
            annotation: null,
            type: 'Image',
            target: { type: 'BoxSelector', spatial: { x: 0, y: 0, width: 100, height: 80 } },
          } as any
        }
        selector={{ type: 'BoxSelector', spatial: crop }}
      />,
      native.runtime
    );
  });
  await waitFor(() => {
    const object = native.runtime.world.getObjects().filter(Boolean)[0] as WorldObject;
    expect((object.layers[0] as any).cropData).toEqual(crop);
  });
  await act(async () => {
    stop(native);
    stop(legacy);
  });
});

test('strategy callbacks replace and clean up, with image-only defaults', () => {
  const vault = makeVault();
  const firstCleanup = vi.fn();
  const secondCleanup = vi.fn();
  const first = vi.fn(() => firstCleanup);
  const second = vi.fn(() => secondCleanup);
  const onChoice = vi.fn();
  const replacementChoice = vi.fn();
  let strategy: string;
  function Inspect() {
    strategy = useStrategy().strategy.type;
    return null;
  }
  const tree = (registerActions: typeof first, onChoiceChange: typeof onChoice) => (
    <VaultProvider vault={vault}>
      <CanvasContext canvas={canvasId}>
        <CanvasStrategyProvider registerActions={registerActions} onChoiceChange={onChoiceChange}>
          <Inspect />
        </CanvasStrategyProvider>
      </CanvasContext>
    </VaultProvider>
  );
  const view = render(tree(first, onChoice));
  expect(strategy!).toBe('images');
  expect(first).toHaveBeenCalled();
  view.rerender(tree(second, replacementChoice));
  expect(firstCleanup).toHaveBeenCalled();
  expect(second).toHaveBeenCalled();
  expect(replacementChoice).toHaveBeenCalled();
  view.unmount();
  expect(secondCleanup).toHaveBeenCalled();
});

test('timeline survives annotation updates and strict effects, disposes on unmount', async () => {
  const vault = makeVault();
  const stores: StoreApi<ComplexTimelineStore>[] = [];
  function Capture() {
    const store = useComplexTimelineStore();
    useEffect(() => {
      stores.push(store);
    }, [store]);
    return null;
  }
  const strategy: ComplexTimelineStrategy = {
    type: 'complex-timeline',
    duration: 10,
    items: [],
    highlights: [],
    keyframes: [],
  };
  const tree = (value: ComplexTimelineStrategy) => (
    <StrictMode>
      <VaultProvider vault={vault}>
        <CanvasContext canvas={canvasId}>
          <RenderComplexTimelineScene strategy={value}>
            <Capture />
          </RenderComplexTimelineScene>
        </CanvasContext>
      </VaultProvider>
    </StrictMode>
  );
  const view = render(tree(strategy));
  await waitFor(() => expect(stores.length).toBeGreaterThan(0));
  const store = stores[stores.length - 1];
  act(() => {
    store.getState().setTime(4);
    store.getState().play();
  });
  view.rerender(tree({ ...strategy, annotations: { pages: [] } }));
  expect(stores[stores.length - 1]).toBe(store);
  expect(store.getState().primeTime).toBe(4);
  expect(store.getState().isPlaying).toBe(true);
  view.unmount();
  expect(store.getState().clockRunning).toBe(false);
  expect(store.getState().isPlaying).toBe(false);
});
