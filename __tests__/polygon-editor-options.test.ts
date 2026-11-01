import mitt from 'mitt';
import { describe, expect, test } from 'vitest';
import { type AtlasStoreEvents, createAtlasStore } from '../src/canvas-panel/context/atlas-store';
import { polygonRequestOptions } from '../src/utility/polygon-editor-options';

describe('polygonRequestOptions', () => {
  test('layers built-in defaults, store defaults and the request', () => {
    const resolved = polygonRequestOptions(
      { boxPlacement: 'tap', snap: { threshold: 30, grid: { spacing: 10 } } },
      { snap: { enabled: true } }
    );
    expect(resolved.boxPlacement).toBe('tap');
    expect(resolved.dragOffset).toEqual([0, 0]);
    expect(resolved.snap).toMatchObject({ enabled: true, threshold: 30, grid: { spacing: 10 }, points: true });
  });

  test('explicit undefined never hides a lower-priority value', () => {
    const resolved = polygonRequestOptions(
      { boxPlacement: 'tap', snap: { threshold: 30 } },
      { boxPlacement: undefined, snap: { threshold: undefined, enabled: undefined } }
    );
    expect(resolved.boxPlacement).toBe('tap');
    expect(resolved.snap?.threshold).toBe(30);
    expect(resolved.snap?.enabled).toBe(false);
  });
});

describe('editor settings on the store', () => {
  function setup(polygonOptions = {}) {
    const store = createAtlasStore({ events: mitt<AtlasStoreEvents>(), polygonOptions });
    return store;
  }
  async function request(store: ReturnType<typeof setup>, editor?: object) {
    const { requestId } = store.getState().getRequestId();
    const pending = store.getState().requestAnnotation({ type: 'polygon', open: true, editor }, { requestId });
    return { pending, requestId };
  }

  test('box placement and drag offset apply per request and reset afterwards', async () => {
    const store = setup();
    const helper = store.getState().polygons;
    const first = await request(store, { boxPlacement: 'tap', dragOffset: [0, -48] });
    helper.clock.flush();
    expect(helper.state.slowState.boxPlacement).toBe('tap');
    store.getState().cancelRequest();
    await first.pending;

    await request(store);
    helper.clock.flush();
    expect(helper.state.slowState.boxPlacement).toBe('drag');
    store.getState().cancelRequest();
  });

  test('store defaults seed requests that do not override them', async () => {
    const store = setup({ boxPlacement: 'tap' });
    const helper = store.getState().polygons;
    await request(store);
    helper.clock.flush();
    expect(helper.state.slowState.boxPlacement).toBe('tap');
    store.getState().cancelRequest();
  });

  test('configurePolygonEditor patches the active editor without replacing geometry', async () => {
    const store = setup();
    const helper = store.getState().polygons;
    await request(store);
    helper.addPointAt([10, 10]);
    helper.addPointAt([50, 10]);
    store.getState().configurePolygonEditor({ boxPlacement: 'tap', snap: { enabled: true } });
    expect(helper.snap.enabled()).toBe(true);
    expect(helper.state.slowState.boxPlacement).toBe('tap');
    expect(helper.state.polygon.points).toHaveLength(2);
    store.getState().cancelRequest();
  });

  test('stamp tools select their template', () => {
    const store = setup();
    const helper = store.getState().polygons;
    for (const name of ['square', 'triangle', 'pentagon', 'hexagon', 'circle'] as const) {
      store.getState().switchTool[name]();
      helper.clock.flush();
      expect(helper.state.slowState.currentTool).toBe('stamp');
      expect(helper.state.slowState.selectedStamp?.id).toBe(name);
    }
    const custom = {
      id: 'custom',
      open: false,
      points: [
        [0, 0],
        [10, 0],
        [5, 8],
      ] as [number, number][],
    };
    store.getState().selectStamp(custom);
    expect(helper.state.slowState.selectedStamp?.points).toHaveLength(3);
  });
});

describe('tool shortcuts', () => {
  function press(store: ReturnType<typeof createAtlasStore>, key: string) {
    const helper = store.getState().polygons;
    helper.key.down(key);
    helper.key.up(key);
    helper.clock.flush();
    return helper.state.slowState.currentTool;
  }
  const events = () => mitt<AtlasStoreEvents>();

  test('toolMap adds shortcuts to the defaults when shortcuts are enabled', () => {
    const store = createAtlasStore({ events: events(), keyboardShortcutsEnabled: true, toolMap: { X: 'box' } });
    expect(press(store, 'x')).toBe('box');
    store.getState().switchTool.pointer();
    expect(press(store, 'p')).toBe('pen');
  });

  test('shortcuts stay disabled by default, including a supplied toolMap', () => {
    const store = createAtlasStore({ events: events(), toolMap: { X: 'box' } });
    store.getState().switchTool.pointer();
    expect(press(store, 'x')).toBe('pointer');
    expect(press(store, 'p')).toBe('pointer');
  });
});
