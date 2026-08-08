import { describe, expect, test, vi } from 'vitest';
import type { ActivationTransaction } from '@iiif/helpers/activations';
import { createSceneClock } from '../src/scene-panel/clock';
import { planActivationTransaction } from '../src/scene-panel/activation-engine';
import { createSceneRuntimeStore } from '../src/scene-panel/store';
import { getLocalMediaTime, isTemporallyVisible } from '../src/scene-panel/timing';

const scene = { id: 'https://example.org/scene', type: 'Scene', duration: 10 } as any;

describe('ScenePanel clock and timing', () => {
  test('clamps, stops at duration, seeks, and publishes snapshots', () => {
    const clock = createSceneClock(10) as any;
    const listener = vi.fn();
    clock.subscribe(listener);
    clock.play();
    clock.advance(12);
    expect(clock.getSnapshot()).toEqual({ time: 10, playing: false, playbackRate: 1 });
    clock.seek(-5);
    clock.setPlaybackRate(2);
    expect(clock.getSnapshot()).toEqual({ time: 0, playing: false, playbackRate: 2 });
    expect(listener).toHaveBeenCalled();
  });

  test('treats invalid durations as an inert zero-length clock', () => {
    const clock = createSceneClock(Number.NaN) as any;
    clock.play();
    clock.seek(4);
    expect(clock.getSnapshot()).toEqual({ time: 0, playing: false, playbackRate: 1 });
    clock.setDuration(Number.POSITIVE_INFINITY);
    clock.play();
    clock.advance(2);
    expect(clock.getSnapshot()).toMatchObject({ time: 2, playing: true });
  });

  test('uses half-open visibility and all three media time modes', () => {
    expect(isTemporallyVisible(2, { start: 2, end: 4 })).toBe(true);
    expect(isTemporallyVisible(4, { start: 2, end: 4 })).toBe(false);
    expect(getLocalMediaTime(8, { start: 2, end: 12 }, 20, 'trim')).toBe(6);
    expect(getLocalMediaTime(7, { start: 2, end: 12 }, 20, 'scale')).toBe(10);
    expect(getLocalMediaTime(9, { start: 2, end: 12 }, 5, 'loop')).toBe(2);
    expect(getLocalMediaTime(20, { start: 2 }, 5, 'extension')).toBe(5);
  });
});

describe('atomic Scene activations', () => {
  const transaction = (actions: string[]): ActivationTransaction => ({
    annotationId: 'activation',
    annotation: { id: 'activation', type: 'Annotation' } as any,
    triggerIds: ['trigger'],
    steps: [
      {
        source: { id: 'camera-annotation', type: 'Annotation' },
        sourceRef: { id: 'camera-annotation', type: 'Annotation' },
        selector: null,
        transform: [],
        actions,
        aggregatePath: [],
      },
    ],
  });

  test('preflights the whole transaction and returns one immutable patch', () => {
    const state = createSceneRuntimeStore(scene, { time: 0, playing: false, playbackRate: 1 }).getState();
    state.resources = {
      camera: {
        hidden: true,
        disabled: true,
        selected: false,
        playing: false,
        activeAnimation: null,
        resetVersion: 0,
        transformOverride: null,
        type: 'perspective-camera',
        interactionMode: [],
      },
    };
    state.idIndex = { 'camera-annotation': ['camera'] };
    const registry = new Map([
      [
        'camera',
        {
          path: 'camera',
          ids: ['camera-annotation'],
          type: 'perspective-camera',
          supportedActions: ['show', 'enable', 'select'],
        },
      ],
    ]);
    const result = planActivationTransaction(state, registry, transaction(['show', 'enable', 'select']));
    expect(result).toMatchObject({
      ok: true,
      plan: { activeCamera: 'camera', resources: { camera: { hidden: false, disabled: false, selected: true } } },
    });
    expect(state.resources.camera).toMatchObject({ hidden: true, disabled: true, selected: false });
  });

  test('rolls back when any action is unsupported', () => {
    const state = createSceneRuntimeStore(scene, { time: 0, playing: false, playbackRate: 1 }).getState();
    state.resources = {
      camera: {
        hidden: true,
        disabled: false,
        selected: false,
        playing: false,
        activeAnimation: null,
        resetVersion: 0,
        transformOverride: null,
        type: 'perspective-camera',
        interactionMode: [],
      },
    };
    state.idIndex = { 'camera-annotation': ['camera'] };
    const registry = new Map([
      [
        'camera',
        { path: 'camera', ids: ['camera-annotation'], type: 'perspective-camera', supportedActions: ['show'] },
      ],
    ]);
    expect(planActivationTransaction(state, registry, transaction(['show', 'explode']))).toEqual({
      ok: false,
      error: 'Unsupported activation action: explode',
    });
    expect(state.resources.camera.hidden).toBe(true);
  });

  test('falls back to the default camera when an activation hides the active authored camera', () => {
    const state = createSceneRuntimeStore(scene, { time: 0, playing: false, playbackRate: 1 }).getState();
    state.resources = {
      camera: {
        hidden: false,
        disabled: false,
        selected: true,
        playing: false,
        activeAnimation: null,
        resetVersion: 0,
        transformOverride: null,
        type: 'perspective-camera',
        interactionMode: [],
      },
    };
    state.activeCamera = 'camera';
    state.idIndex = { 'camera-annotation': ['camera'] };
    const registry = new Map([
      [
        'camera',
        { path: 'camera', ids: ['camera-annotation'], type: 'perspective-camera', supportedActions: ['hide'] },
      ],
    ]);
    const result = planActivationTransaction(state, registry, transaction(['hide']));
    expect(result).toMatchObject({ ok: true, plan: { activeCamera: null, resources: { camera: { hidden: true } } } });
  });

  test('preserves the active camera when an activation only changes a model', () => {
    const state = createSceneRuntimeStore(scene, { time: 0, playing: false, playbackRate: 1 }).getState();
    state.activeCamera = 'camera';
    state.resources = {
      model: {
        hidden: true,
        disabled: false,
        selected: false,
        playing: false,
        activeAnimation: null,
        resetVersion: 0,
        transformOverride: null,
        type: 'model',
        interactionMode: [],
      },
    };
    state.idIndex = { model: ['model'] };
    const registry = new Map([['model', { path: 'model', ids: ['model'], type: 'model', supportedActions: ['show'] }]]);
    const activation = transaction(['show']);
    activation.steps[0].source = { id: 'model', type: 'Model' } as any;
    activation.steps[0].sourceRef = { id: 'model', type: 'Model' };

    expect(planActivationTransaction(state, registry, activation)).toMatchObject({
      ok: true,
      plan: { activeCamera: 'camera', resources: { model: { hidden: false } } },
    });
  });

  test('keeps explicit camera reset actions effective', () => {
    const state = createSceneRuntimeStore(scene, { time: 0, playing: false, playbackRate: 1 }).getState();
    state.activeCamera = 'camera';
    state.resources = {
      camera: {
        hidden: false,
        disabled: false,
        selected: true,
        playing: false,
        activeAnimation: null,
        resetVersion: 2,
        transformOverride: [{ type: 'TranslateTransform', x: 1, y: 2, z: 3 }],
        type: 'perspective-camera',
        interactionMode: ['orbit'],
      },
    };
    state.idIndex = { camera: ['camera'] };
    const registry = new Map([
      ['camera', { path: 'camera', ids: ['camera'], type: 'perspective-camera', supportedActions: ['reset'] }],
    ]);
    const activation = transaction(['reset']);
    activation.steps[0].source = { id: 'camera', type: 'PerspectiveCamera' } as any;
    activation.steps[0].sourceRef = { id: 'camera', type: 'PerspectiveCamera' };

    expect(planActivationTransaction(state, registry, activation)).toMatchObject({
      ok: true,
      plan: {
        activeCamera: 'camera',
        resources: { camera: { resetVersion: 3, transformOverride: null } },
      },
    });
  });

  test('retains an AnimationSelector for named glTF actions', () => {
    const state = createSceneRuntimeStore(scene, { time: 0, playing: false, playbackRate: 1 }).getState();
    state.resources = {
      model: {
        hidden: false,
        disabled: false,
        selected: false,
        playing: false,
        activeAnimation: null,
        resetVersion: 0,
        transformOverride: null,
        type: 'model',
        interactionMode: [],
      },
    };
    state.idIndex = { model: ['model'] };
    const registry = new Map([
      ['model', { path: 'model', ids: ['model'], type: 'model', supportedActions: ['start'] }],
    ]);
    const named = transaction(['start']);
    named.steps[0].source = { id: 'model', type: 'Model' } as any;
    named.steps[0].sourceRef = { id: 'model', type: 'Model' };
    named.steps[0].selector = { type: 'AnimationSelector', value: 'Walk' } as any;
    const result = planActivationTransaction(state, registry, named);
    expect(result).toMatchObject({
      ok: true,
      plan: { resources: { model: { playing: true, activeAnimation: 'Walk' } } },
    });
  });

  test('applies and resets an activation transform override', () => {
    const state = createSceneRuntimeStore(scene, { time: 0, playing: false, playbackRate: 1 }).getState();
    state.resources = {
      model: {
        hidden: false,
        disabled: false,
        selected: false,
        playing: false,
        activeAnimation: null,
        resetVersion: 0,
        transformOverride: null,
        type: 'model',
        interactionMode: [],
      },
    };
    state.idIndex = { model: ['model'] };
    const registry = new Map([
      ['model', { path: 'model', ids: ['model'], type: 'model', supportedActions: ['show', 'reset'] }],
    ]);
    const moved = transaction(['show']);
    moved.steps[0].source = { id: 'model', type: 'Model' } as any;
    moved.steps[0].sourceRef = { id: 'model', type: 'Model' };
    moved.steps[0].transform = [{ type: 'TranslateTransform', x: 1, y: 2, z: 3 }];
    const moveResult = planActivationTransaction(state, registry, moved);
    expect(moveResult).toMatchObject({
      ok: true,
      plan: { resources: { model: { transformOverride: [{ type: 'TranslateTransform', x: 1, y: 2, z: 3 }] } } },
    });

    const reset = transaction(['reset']);
    reset.steps[0].source = { id: 'model', type: 'Model' } as any;
    reset.steps[0].sourceRef = { id: 'model', type: 'Model' };
    const resetResult = planActivationTransaction(
      { ...state, resources: (moveResult as any).plan.resources },
      registry,
      reset
    );
    expect(resetResult).toMatchObject({
      ok: true,
      plan: { resources: { model: { transformOverride: null, resetVersion: 1 } } },
    });
  });
});
