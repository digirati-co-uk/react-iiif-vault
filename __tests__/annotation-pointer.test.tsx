import type { BrowserEventManager } from '@atlas-viewer/atlas';
import { cleanup, render, renderHook } from '@testing-library/react';
import mitt from 'mitt';
import type { createHelper } from 'polygon-editor';
import { afterAll, afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import {
  createAtlasStore,
  type AnnotationResponse,
  type AtlasStoreEvents,
} from '../src/canvas-panel/context/atlas-store';
import { SVGAnnotationEditor } from '../src/components/annotations/SVGAnnotationEditor';

const scheduler = vi.hoisted(() => {
  const callbacks = new Map<number, FrameRequestCallback>();
  const originalRequest = window.requestAnimationFrame;
  const originalCancel = window.cancelAnimationFrame;
  let nextId = 0;
  window.requestAnimationFrame = (callback) => {
    callbacks.set(++nextId, callback);
    return nextId;
  };
  window.cancelAnimationFrame = (id) => {
    callbacks.delete(id);
  };
  return {
    callbacks,
    frame() {
      for (const [id, callback] of Array.from(callbacks)) {
        callbacks.delete(id);
        callback(16);
      }
    },
    restore() {
      window.requestAnimationFrame = originalRequest;
      window.cancelAnimationFrame = originalCancel;
    },
  };
});

const editor = vi.hoisted(() => ({ helper: null as ReturnType<typeof createHelper> | null }));

vi.mock('@atlas-viewer/atlas', () => ({
  HTMLPortal: ({ children }: { children: import('react').ReactNode }) => children,
  useAtlas: () => null,
}));
vi.mock('../src/hooks/useSvgEditor', () => ({
  useSvgEditor: () => ({
    helper: editor.helper,
    state: editor.helper!.state.slowState,
    defs: null,
    editor: null,
  }),
}));

interface AnnotationMouseEvent extends MouseEvent {
  atlas: { x: number; y: number };
}

interface EditorHandlers {
  onMouseDown(event: AnnotationMouseEvent): void;
  onMouseMove(event: AnnotationMouseEvent): void;
  onMouseUp(event: AnnotationMouseEvent): void;
  onMouseLeave(): void;
}

function event(x: number, y: number, button = 0): AnnotationMouseEvent {
  return Object.assign(new MouseEvent('mouse', { button, buttons: button === 0 ? 1 : button === 1 ? 4 : 2 }), { atlas: { x, y } });
}

describe('annotation pointer input', () => {
  let store: ReturnType<typeof createAtlasStore>;
  let handlers: EditorHandlers;
  let result: Promise<AnnotationResponse | null>;
  let updates: AtlasStoreEvents['atlas.polygon-update'][];
  let events: ReturnType<typeof mitt<AtlasStoreEvents>>;
  let manager: BrowserEventManager | undefined;

  function open(selector: { x: number; y: number; width: number; height: number } | null = null) {
    events = mitt<AtlasStoreEvents>();
    updates = [];
    events.on('atlas.polygon-update', (shape) => updates.push(structuredClone(shape)));
    store = createAtlasStore({ events });
    const { requestId } = store.getState().getRequestId();
    result = store.getState().requestAnnotation({ type: 'box', selector }, { requestId, toolId: 'box' });
    editor.helper = store.getState().polygons;
    const view = renderHook(() => SVGAnnotationEditor({ image: { width: 1000, height: 1000 } }));
    handlers = view.result.current.props as EditorHandlers;
    expect(scheduler.callbacks.size).toBe(1);
    return view;
  }

  function move(x: number, y: number) {
    handlers.onMouseMove(event(x, y));
    scheduler.frame();
    expect(scheduler.callbacks.size).toBe(1);
  }

  function draw() {
    handlers.onMouseDown(event(100, 100));
    move(120, 120);
    move(180, 160);
    move(220, 180);
    handlers.onMouseUp(event(220, 180));
    scheduler.frame();
  }

  beforeEach(() => expect(scheduler.callbacks.size).toBe(0));
  afterEach(() => {
    manager?.stop();
    manager = undefined;
    vi.clearAllTimers();
    vi.useRealTimers();
    editor.helper?.pointerUp();
    store?.getState().cancelRequest();
    editor.helper?.clock.stop();
    cleanup();
    editor.helper = null;
    expect(scheduler.callbacks.size).toBe(0);
  });
  afterAll(() => scheduler.restore());

  // Use Atlas's installed BrowserEventManager and World dispatch, including its
  // DOM listener and before-frame buffering. Only the renderer/viewport is a stub.
  async function forwardedInput() {
    const atlas = await vi.importActual<typeof import('@atlas-viewer/atlas')>('@atlas-viewer/atlas');
    vi.useFakeTimers();
    const element = document.createElement('div');
    const world = new atlas.World(1000, 1000);
    const object = atlas.WorldObject.createWithProps({ id: 'annotation-editor', width: 1000, height: 1000 });
    const delivered: Array<{ name: string; event: AnnotationMouseEvent; x: number; y: number }> = [];
    for (const name of ['onMouseDown', 'onMouseMove', 'onMouseUp'] as const) {
      object.addEventListener(name.slice(2).toLowerCase() as 'mousedown' | 'mousemove' | 'mouseup', (e: AnnotationMouseEvent) => {
        delivered.push({ name, event: e, x: e.atlas.x, y: e.atlas.y });
        handlers[name](e);
      });
    }
    world.appendChild(object);
    world.activatedEvents.push('onMouseDown', 'onMouseUp');
    let beforeFrame = () => {};
    const runtime = {
      world,
      viewerToWorld: (x: number, y: number) => ({ x, y }),
      registerHook: (name: string, hook: () => void) => {
        if (name === 'useBeforeFrame') beforeFrame = hook;
        return () => {};
      },
      updateNextFrame: () => {},
    } as unknown as InstanceType<typeof atlas.Runtime>;
    manager = new atlas.BrowserEventManager(element, runtime);
    return {
      delivered,
      flushAtlas: () => beforeFrame(),
      send(type: string, x: number, y: number, button: number, buttons: number, flush = true) {
        const input = new PointerEvent(type, { clientX: x, clientY: y, button, buttons, pointerType: 'mouse' });
        element.dispatchEvent(input);
        if (type === 'pointermove' && flush) {
          expect(manager!.pointerMoveEvent).toBe(input);
          beforeFrame();
          const forwarded = delivered.at(-1)!;
          expect(forwarded.name).toBe('onMouseMove');
          expect(forwarded.event).toBe(input);
          expect([forwarded.x, forwarded.y]).toEqual([x, y]);
          expect(input.button).toBe(button);
          expect(input.buttons).toBe(buttons);
          scheduler.frame();
          expect(scheduler.callbacks.size).toBe(1);
        }
        return input;
      },
    };
  }

  // Replay captured scalar inputs through real Atlas forwarding. This is a
  // deterministic regression, not browser evidence of the unrecorded RAF phase.
  test.each([0, 1].flatMap(buttons =>
    (['neither', 'atlas-only', 'helper-only', 'both'] as const).map(phase => ({ buttons, phase }))
  ))(
    '19ms sequence retains release coordinates: buttons=$buttons, phase=$phase',
    async ({ buttons, phase }) => {
      open();
      const input = await forwardedInput();
      input.send('pointerdown', 940, 760, 0, buttons, false);
      input.send('mousedown', 940, 760, 0, buttons, false);
      vi.advanceTimersByTime(10);
      input.send('pointermove', 985, 787.5, -1, buttons, false);
      if (phase === 'atlas-only' || phase === 'both') input.flushAtlas();
      if (phase === 'helper-only' || phase === 'both') scheduler.frame();
      vi.advanceTimersByTime(9);
      input.send('pointerup', 985, 787.5, 0, 0, false);
      input.send('mouseup', 985, 787, 0, 0, false);
      input.flushAtlas();
      scheduler.frame();
      expect(input.delivered.map(({name}) => name)).toContain('onMouseUp');
      expect(store.getState().polygon?.points).toEqual([[940, 760], [940, 787], [985, 787], [985, 760]]);
      expect(updates.at(-1)?.points).toEqual(store.getState().polygon?.points);
      expect(scheduler.callbacks.size).toBe(1);
      store.getState().completeRequest();
      await expect(result).resolves.toMatchObject({ boundingBox: { x: 940, y: 760, width: 45, height: 27 } });
      expect(scheduler.callbacks.size).toBe(0);
    }
  );

  test('empty and zero-area box requests cannot be confirmed', async () => {
    open();
    const completed = vi.fn();
    events.on('atlas.annotation-completed', completed);
    store.getState().completeRequest();
    expect(completed).not.toHaveBeenCalled();
    expect(store.getState().tool.enabled).toBe(true);
    store.getState().polygons.setShape({ open: false, points: [[100, 100], [100, 100], [100, 100], [100, 100]] });
    scheduler.frame();
    store.getState().completeRequest();
    expect(completed).not.toHaveBeenCalled();
    expect(store.getState().tool.enabled).toBe(true);
    store.getState().cancelRequest();
    await expect(result).resolves.toBe(null);
  });

  test.each([
    { name: 'collapsed', points: [[100, 100], [100, 100], [100, 100], [100, 100]] },
    { name: 'vertical', points: [[100, 100], [100, 200], [100, 200], [100, 100]] },
    { name: 'horizontal', points: [[100, 100], [200, 100], [200, 100], [100, 100]] },
    { name: 'nonfinite', points: [[100, 100], [100, 200], [Infinity, 200], [Infinity, 100]] },
    { name: 'NaN', points: [[100, 100], [100, 200], [NaN, 200], [NaN, 100]] },
  ])('$name box cannot be confirmed', ({ points }) => {
    open();
    const completed = vi.fn();
    events.on('atlas.annotation-completed', completed);
    store.setState({ polygon: { points: points as Array<[number, number]>, open: false } });
    store.getState().completeRequest();
    expect(completed).not.toHaveBeenCalled();
    expect(store.getState().tool.enabled).toBe(true);
  });

  test.each([
    ['interior move', 260, 240, [[160, 160], [480, 160], [480, 440], [160, 440]]],
    ['corner resize', 100, 100, [[160, 160], [420, 160], [420, 380], [160, 380]]],
  ] as const)('release finalizes a buffered one-move %s', async (_name, x, y, points) => {
    open({ x: 100, y: 100, width: 320, height: 280 });
    const input = await forwardedInput();
    input.send('mousedown', x, y, 0, 1, false);
    input.send('pointermove', x + 60, y + 60, -1, 1, false);
    input.send('mouseup', x + 60, y + 60, 0, 0, false);
    input.flushAtlas();
    scheduler.frame();
    expect(store.getState().polygon?.points).toEqual(points);
  });

  test('a click does not become a zero-area confirmed box', async () => {
    open();
    const input = await forwardedInput();
    input.send('mousedown', 100, 100, 0, 0, false);
    input.send('mouseup', 100, 100, 0, 0, false);
    scheduler.frame();
    const completed = vi.fn();
    events.on('atlas.annotation-completed', completed);
    store.getState().completeRequest();
    expect(completed).not.toHaveBeenCalled();
    store.getState().cancelRequest();
    await expect(result).resolves.toBe(null);
  });

  test('explicit SVG focus requests no scroll', () => {
    const view = open();
    const dom = render(view.result.current);
    const svg = dom.getByText('Annotation Editor').closest('svg')!;
    const focus = vi.fn();
    Object.defineProperty(svg, 'focus', { value: focus });
    handlers.onMouseDown(event(100, 100));
    expect(focus).toHaveBeenCalledOnce();
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
  });

  test('Atlas forwards primary-held pointermove with button -1 through first draw and confirmation', async () => {
    open();
    const input = await forwardedInput();
    input.send('mousedown', 100, 100, 0, 1);
    expect(editor.helper!.state.pointer).toEqual([100, 100]);
    input.send('pointermove', 120, 120, -1, 1);
    input.send('pointermove', 180, 160, -1, 1);
    input.send('pointermove', 220, 180, -1, 1);
    input.send('mouseup', 220, 180, 0, 0);
    scheduler.frame();
    expect(store.getState().polygon?.points).toEqual([[100, 100], [100, 180], [220, 180], [220, 100]]);
    expect(updates.at(-1)?.points).toEqual(store.getState().polygon?.points);
    store.getState().completeRequest();
    await expect(result).resolves.toMatchObject({ boundingBox: { x: 100, y: 100, width: 120, height: 80 } });
    expect(scheduler.callbacks.size).toBe(0);
  });

  test.each([
    ['interior move', 260, 240, [[160, 160], [480, 160], [480, 440], [160, 440]]],
    ['corner resize', 100, 100, [[160, 160], [420, 160], [420, 380], [160, 380]]],
  ] as const)('Atlas forwarded pointermove supports first-press %s', async (_name, x, y, points) => {
    open({ x: 100, y: 100, width: 320, height: 280 });
    const input = await forwardedInput();
    input.send('mousedown', x, y, 0, 1);
    for (const delta of [20, 40, 60]) input.send('pointermove', x + delta, y + delta, -1, 1);
    input.send('mouseup', x + 60, y + 60, 0, 0);
    scheduler.frame();
    expect(store.getState().polygon?.points).toEqual(points);
  });

  test('Atlas forwarded hover seeds the pointer without drawing; press replaces it', async () => {
    open();
    const input = await forwardedInput();
    input.send('pointermove', 700, 700, -1, 0);
    expect(editor.helper!.state.pointer).toEqual([700, 700]);
    expect(store.getState().polygon?.points).toEqual([]);
    input.send('mousedown', 100, 100, 0, 1);
    expect(editor.helper!.state.pointer).toEqual([100, 100]);
    input.send('pointermove', 120, 120, -1, 1);
    input.send('pointermove', 220, 180, -1, 1);
    input.send('mouseup', 220, 180, 0, 0);
    scheduler.frame();
    expect(store.getState().polygon?.points[0]).toEqual([100, 100]);
  });

  test.each([2, 4])('Atlas forwarded non-primary-only buttons %s do not move a primary drag', async (buttons) => {
    open();
    const input = await forwardedInput();
    input.send('mousedown', 100, 100, 0, 1);
    input.send('pointermove', 900, 900, -1, buttons);
    expect(editor.helper!.state.pointer).toEqual([100, 100]);
    input.send('pointermove', 120, 120, -1, 1);
    input.send('pointermove', 220, 180, -1, 1);
    input.send('mouseup', 220, 180, 0, 0);
    scheduler.frame();
    expect(store.getState().polygon?.points).toEqual([[100, 100], [100, 180], [220, 180], [220, 100]]);
  });

  test('movement uses held buttons even when a legacy caller omits button', () => {
    open();
    const input = Object.assign(new MouseEvent('mousemove', { buttons: 1 }), { atlas: { x: 120, y: 140 } });
    Object.defineProperty(input, 'button', { value: undefined });
    handlers.onMouseMove(input);
    expect(editor.helper!.state.pointer).toEqual([120, 140]);
  });

  test('first press without hover creates a box, publishes its update, and confirms', async () => {
    open();
    draw();
    expect(store.getState().polygon?.points).toEqual([
      [100, 100],
      [100, 180],
      [220, 180],
      [220, 100],
    ]);
    expect(updates.at(-1)?.points).toEqual(store.getState().polygon?.points);
    expect(scheduler.callbacks.size).toBe(1);
    store.getState().completeRequest();
    await expect(result).resolves.toMatchObject({
      requestType: 'box',
      boundingBox: { x: 100, y: 100, width: 120, height: 80 },
    });
    expect(store.getState().tool.enabled).toBe(false);
    expect(scheduler.callbacks.size).toBe(0);
  });

  test('ordinary hover then continuous drag still creates the same box', () => {
    open();
    move(100, 100);
    scheduler.frame();
    draw();
    expect(store.getState().polygon?.points).toEqual([
      [100, 100],
      [100, 180],
      [220, 180],
      [220, 100],
    ]);
  });

  test('the press coordinates replace a stale hover position', () => {
    open();
    move(700, 700);
    scheduler.frame();
    draw();
    expect(store.getState().polygon?.points[0]).toEqual([100, 100]);
  });

  test('first interaction after leaving the editor needs no new hover', () => {
    open();
    move(700, 700);
    handlers.onMouseLeave();
    draw();
    expect(store.getState().polygon?.points[0]).toEqual([100, 100]);
  });

  test('an existing box moves from its interior on the first press', () => {
    open({ x: 100, y: 100, width: 320, height: 280 });
    handlers.onMouseDown(event(260, 240));
    move(280, 260);
    move(300, 280);
    move(320, 300);
    handlers.onMouseUp(event(320, 300));
    scheduler.frame();
    expect(store.getState().polygon?.points).toEqual([
      [160, 160],
      [480, 160],
      [480, 440],
      [160, 440],
    ]);
  });

  test('an existing box resizes from its corner on the first press', () => {
    open({ x: 100, y: 100, width: 320, height: 280 });
    handlers.onMouseDown(event(100, 100));
    move(120, 120);
    move(140, 140);
    move(160, 160);
    handlers.onMouseUp(event(160, 160));
    scheduler.frame();
    expect(store.getState().polygon?.points).toEqual([
      [160, 160],
      [420, 160],
      [420, 380],
      [160, 380],
    ]);
  });

  test.each([1, 2])('button %s neither draws nor changes the pointer or scheduler', (button) => {
    open();
    handlers.onMouseDown(event(100, 100, button));
    handlers.onMouseMove(event(220, 180, button));
    handlers.onMouseUp(event(220, 180, button));
    scheduler.frame();
    expect(editor.helper!.state.pointer).toBe(null);
    expect(store.getState().polygon?.points).toEqual([]);
    expect(scheduler.callbacks.size).toBe(1);
  });

  test('a non-primary release does not end a primary drag', () => {
    open();
    handlers.onMouseDown(event(100, 100));
    move(120, 120);
    handlers.onMouseUp(event(120, 120, 2));
    move(180, 160);
    move(220, 180);
    handlers.onMouseUp(event(220, 180));
    scheduler.frame();
    expect(store.getState().polygon?.points).toEqual([
      [100, 100],
      [100, 180],
      [220, 180],
      [220, 100],
    ]);
  });

  test('repeated drags retain one frame loop and cancellation clears it', async () => {
    open();
    draw();
    for (let i = 0; i < 4; i++) {
      handlers.onMouseDown(event(160, 140));
      expect(scheduler.callbacks.size).toBe(1);
      move(180, 160);
      move(200, 180);
      handlers.onMouseUp(event(200, 180));
      scheduler.frame();
      expect(scheduler.callbacks.size).toBe(1);
    }
    store.getState().cancelRequest();
    await expect(result).resolves.toBe(null);
    expect(scheduler.callbacks.size).toBe(0);
  });
});
