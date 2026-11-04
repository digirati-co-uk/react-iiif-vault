import { describe, expect, test } from 'vitest';
import mitt from 'mitt';
import {
  createAtlasStore,
  type AtlasStoreEvents,
} from '../src/canvas-panel/context/atlas-store';
import type { InputShape } from 'polygon-editor';

const box: InputShape = {
  open: false,
  points: [
    [10, 10],
    [100, 10],
    [100, 80],
    [10, 80],
  ],
};
describe('request lifecycle', () => {
  function setup() {
    const events = mitt<AtlasStoreEvents>();
    const store = createAtlasStore({ events });
    return { events, store };
  }
  test('cancel drops a draft, resolves the request, and does not save an empty shape', async () => {
    const { store, events } = setup();
    const updates: unknown[] = [];
    events.on('atlas.polygon-update', (shape) => updates.push(shape));
    const id = store.getState().getRequestId().requestId;
    const result = store.getState().requestAnnotation({ type: 'box', selector: null }, { requestId: id });
    const helper = store.getState().polygons;
    helper.pointerDown([10, 10]);
    helper.pointer([[100, 100]]);
    const count = updates.length;
    store.getState().cancelRequest();
    expect(await result).toBeNull();
    expect(helper.state.transitionPoints).toBeNull();
    expect(helper.state.slowState.noShape).toBe(true);
    expect(updates).toHaveLength(count);
  });
  test('new requests reset bounds, aspect locks and snap sources', async () => {
    const { store } = setup();
    const first = store.getState().getRequestId();
    const pending = store.getState().requestAnnotation(
      {
        type: 'target',
        selector: null,
        bounds: { x: 0, y: 0, width: 100, height: 100 },
        editor: { snap: { enabled: true, sources: [box] } },
      },
      { requestId: first.requestId }
    );
    first.clear();
    await pending;
    const second = store.getState().getRequestId();
    const next = store.getState().requestAnnotation({ type: 'polygon', open: true }, { requestId: second.requestId });
    const helper = store.getState().polygons;
    expect(helper.state.slowState.bounds).toBeNull();
    expect(helper.state.slowState.fixedAspectRatio).toBe(false);
    expect(helper.state.slowState.currentTool).toBe('pen');
    expect(helper.state.snapSources).toEqual([]);
    expect(helper.snap.enabled()).toBe(false);
    store.getState().cancelRequest();
    await next;
  });
  test('save flushes synchronous commands before constructing the annotation response', async () => {
    const { store } = setup();
    const id = store.getState().getRequestId().requestId;
    const pending = store.getState().requestAnnotation({ type: 'polygon', open: true }, { requestId: id });
    const helper = store.getState().polygons;
    helper.addPointAt([0, 0]);
    helper.addPointAt([100, 0]);
    helper.addPointAt([50, 100]);
    helper.finishShape();
    store.getState().completeRequest();
    const response = await pending;
    expect(response?.polygon?.points).toHaveLength(3);
    expect(response?.polygon?.open).toBe(false);
    expect(response?.target?.type).toBe('SvgSelector');
  });
});
