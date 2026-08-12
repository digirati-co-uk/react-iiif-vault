/**
 * @vitest-environment happy-dom
 */

import { act, fireEvent, render } from '@testing-library/react';
import mitt from 'mitt';
import type { RenderState, SlowState } from 'polygon-editor';
import type { ReactNode } from 'react';
import { describe, expect, test, vi } from 'vitest';
import { createAtlasStore, type AtlasStore, type AtlasStoreEvents } from '../src/canvas-panel/context/atlas-store';
import { AtlasStoreReactContext } from '../src/canvas-panel/context/atlas-store-provider';
import { SVGAnnotationEditor } from '../src/components/annotations/SVGAnnotationEditor';
import { ContextBridge, useContextBridge } from '../src/context/ContextBridge';
import { EventEmitterProvider } from '../src/hooks/useEvent';
import { useSvgEditor } from '../src/hooks/useSvgEditor';

vi.mock('@atlas-viewer/atlas', async (importOriginal) => {
  const atlas = await importOriginal<typeof import('@atlas-viewer/atlas')>();

  return {
    ...atlas,
    HTMLPortal: ({ children }: { children: ReactNode }) => children,
  };
});

function NestedBridge({ children, depth = 1 }: { children: ReactNode; depth?: number }) {
  const bridge = useContextBridge();

  return (
    <ContextBridge bridge={bridge}>
      {depth > 1 ? <NestedBridge depth={depth - 1}>{children}</NestedBridge> : children}
    </ContextBridge>
  );
}

function Editor({ name }: { name: string }) {
  const { defs, editor } = useSvgEditor({ image: { width: 1000, height: 1000 } });

  return (
    <svg data-testid={name}>
      <defs>{defs}</defs>
      {editor}
    </svg>
  );
}

function ViewerTree({
  children,
  emitter,
  store,
}: {
  children: ReactNode;
  emitter: ReturnType<typeof mitt<AtlasStoreEvents>>;
  store: ReturnType<typeof createAtlasStore>;
}) {
  return (
    <EventEmitterProvider emitter={emitter}>
      <AtlasStoreReactContext.Provider value={store}>
        <NestedBridge depth={2}>{children}</NestedBridge>
      </AtlasStoreReactContext.Provider>
    </EventEmitterProvider>
  );
}

function startBoxRequest(store: ReturnType<typeof createAtlasStore>) {
  const { requestId } = store.getState().getRequestId();
  const request = store
    .getState()
    .requestAnnotation(
      { type: 'box', selector: { x: 10, y: 20, width: 100, height: 80 }, selectByDefault: true },
      { requestId }
    );

  store.getState().polygons.clock.stop();
  store.setState((state: AtlasStore) => ({
    polygonState: { ...state.polygonState, boxMode: true, showBoundingBox: true },
  }));

  return { request, requestId };
}

function polygonRender(
  store: ReturnType<typeof createAtlasStore>,
  box: { x: number; y: number; width: number; height: number }
) {
  const helper = store.getState().polygons;

  return {
    state: {
      ...helper.state,
      polygon: { ...helper.state.polygon, boundingBox: box },
    } as RenderState,
    slowState: { ...store.getState().polygonState, showBoundingBox: true } as SlowState,
    dt: 16,
  };
}

function boundingBox(svg: HTMLElement) {
  return svg.querySelector('polygon[stroke-dasharray]');
}

describe('multi-viewer SVG editor isolation', () => {
  test('bridges each emitter through nested renderer and popup boundaries', async () => {
    const emitterA = mitt<AtlasStoreEvents>();
    const emitterB = mitt<AtlasStoreEvents>();
    const storeA = createAtlasStore({ events: emitterA });
    const storeB = createAtlasStore({ events: emitterB });
    const requestA = startBoxRequest(storeA);
    const requestB = startBoxRequest(storeB);
    const { getByTestId, unmount } = render(
      <>
        <ViewerTree emitter={emitterA} store={storeA}>
          <Editor name="editor-a" />
        </ViewerTree>
        <ViewerTree emitter={emitterB} store={storeB}>
          <Editor name="editor-b" />
        </ViewerTree>
      </>
    );
    const editorA = getByTestId('editor-a');
    const editorB = getByTestId('editor-b');

    expect(boundingBox(editorA)).not.toBeNull();
    expect(boundingBox(editorB)).not.toBeNull();

    act(() => emitterA.emit('atlas.polygon-render', polygonRender(storeA, { x: 30, y: 40, width: 200, height: 100 })));
    expect(boundingBox(editorA)?.getAttribute('points')).toBe('30,40 230,40 230,140 30,140');
    expect(boundingBox(editorB)?.getAttribute('points')).toBeNull();

    act(() => emitterB.emit('atlas.polygon-render', polygonRender(storeB, { x: 400, y: 300, width: 50, height: 60 })));
    expect(boundingBox(editorA)?.getAttribute('points')).toBe('30,40 230,40 230,140 30,140');
    expect(boundingBox(editorB)?.getAttribute('points')).toBe('400,300 450,300 450,360 400,360');

    act(() => emitterA.emit('atlas.polygon-render', polygonRender(storeA, { x: 70, y: 80, width: 90, height: 100 })));
    expect(boundingBox(editorA)?.getAttribute('points')).toBe('70,80 160,80 160,180 70,180');
    expect(boundingBox(editorB)?.getAttribute('points')).toBe('400,300 450,300 450,360 400,360');

    const markerIds = [editorA, editorB].flatMap((svg) =>
      Array.from(svg.querySelectorAll('marker'), (marker) => marker.id)
    );
    expect(markerIds).toHaveLength(8);
    expect(new Set(markerIds).size).toBe(8);

    for (const svg of [editorA, editorB]) {
      const localMarkerIds = new Set(Array.from(svg.querySelectorAll('marker'), (marker) => marker.id));
      const references = Array.from(svg.querySelectorAll('[marker-start], [marker-mid], [marker-end]')).flatMap(
        (element) =>
          ['marker-start', 'marker-mid', 'marker-end']
            .map((attribute) => element.getAttribute(attribute)?.match(/^url\(#(.+)\)$/)?.[1])
            .filter((id): id is string => Boolean(id))
      );

      expect(references.length).toBeGreaterThan(0);
      expect(references.every((id) => localMarkerIds.has(id))).toBe(true);
    }

    unmount();
    storeA.getState().cancelRequest(requestA.requestId);
    storeB.getState().cancelRequest(requestB.requestId);
    await Promise.all([requestA.request, requestB.request]);
  });

  test('sends document keyboard events only to the focused editor', async () => {
    const emitterA = mitt<AtlasStoreEvents>();
    const emitterB = mitt<AtlasStoreEvents>();
    const storeA = createAtlasStore({ events: emitterA });
    const storeB = createAtlasStore({ events: emitterB });
    const requestA = startBoxRequest(storeA);
    const requestB = startBoxRequest(storeB);
    const keyDownA = vi.spyOn(storeA.getState().polygons.key, 'down');
    const keyDownB = vi.spyOn(storeB.getState().polygons.key, 'down');
    const keyUpA = vi.spyOn(storeA.getState().polygons.key, 'up');
    const keyUpB = vi.spyOn(storeB.getState().polygons.key, 'up');
    const { getAllByTitle, container, unmount } = render(
      <>
        <ViewerTree emitter={emitterA} store={storeA}>
          <SVGAnnotationEditor image={{ width: 1000, height: 1000 }} />
        </ViewerTree>
        <ViewerTree emitter={emitterB} store={storeB}>
          <SVGAnnotationEditor image={{ width: 1000, height: 1000 }} />
        </ViewerTree>
      </>
    );
    const [editorA] = getAllByTitle('Annotation Editor').map((title) => title.closest('svg') as SVGSVGElement);
    const [worldObjectA] = container.querySelectorAll('world-object');

    fireEvent.mouseDown(worldObjectA, { button: 0 });
    expect(document.activeElement).toBe(editorA);

    fireEvent.keyDown(document, { key: 'Shift' });
    fireEvent.keyUp(document, { key: 'Shift' });

    expect(keyDownA).toHaveBeenCalledWith('Shift');
    expect(keyUpA).toHaveBeenCalledWith('Shift');
    expect(keyDownB).not.toHaveBeenCalled();
    expect(keyUpB).not.toHaveBeenCalled();

    unmount();
    storeA.getState().cancelRequest(requestA.requestId);
    storeB.getState().cancelRequest(requestB.requestId);
    await Promise.all([requestA.request, requestB.request]);
  });
});
