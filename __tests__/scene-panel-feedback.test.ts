import { expect, test } from 'vitest';
import { Group, Vector3 } from 'three';
import { pointFramingBounds } from '../src/scene-panel/point-framing';
import { invalidateActivationResource, recordActivation, planDeactivation } from '../src/scene-panel/activation-state';
import { planActivationTransaction } from '../src/scene-panel/activation-engine';
import { createSceneRuntimeStore, runtimeSnapshot } from '../src/scene-panel/store';

test('point framing retains the transformed world anchor and uses model scale', () => {
  const parent = new Group();
  parent.position.set(10, 20, 30);
  parent.rotation.z = Math.PI / 2;
  parent.scale.set(2, 3, 4);
  const child = new Group();
  child.position.set(1, 0, 0);
  parent.add(child);
  child.updateWorldMatrix(true, false);
  const center = new Vector3(1, 0, 0).applyMatrix4(child.matrixWorld).toArray();
  const bounds = pointFramingBounds(
    { min: center, max: center, center },
    { min: [-100, -100, -100], max: [100, 100, 100], center: [0, 0, 0] }
  );
  expect(bounds.center[0]).toBeCloseTo(10);
  expect(bounds.center[1]).toBeCloseTo(24);
  expect(bounds.max[0] - bounds.min[0]).toBeCloseTo(Math.sqrt(120000) / 2);
  expect(pointFramingBounds({ min: [0, 0, 0], max: [0, 0, 0], center: [0, 0, 0] }, null).max).toEqual([0.5, 0.5, 0.5]);
});

function setup(actions = ['show', 'enable']) {
  const state = createSceneRuntimeStore({ id: 'scene', type: 'Scene' } as any, {
    time: 0,
    playing: false,
    playbackRate: 1,
  }).getState();
  const resource = {
    hidden: true,
    disabled: true,
    selected: false,
    playing: false,
    activeAnimation: null,
    resetVersion: 0,
    transformOverride: null,
    type: 'model',
    interactionMode: [],
  };
  state.resources = { model: resource, unrelated: { ...resource } };
  state.initialResources = { ...state.resources };
  state.idIndex = { model: ['model'] };
  state.selectedAnnotation = 'note';
  state.activeCamera = null;
  const registry = new Map([
    ['model', { path: 'model', ids: ['model'], type: 'model', supportedActions: ['show', 'enable', 'start', 'reset'] }],
  ]);
  const transaction = {
    annotationId: 'activation',
    steps: [{ source: { id: 'model' }, actions, transform: [], selector: null }],
  } as any;
  const result = planActivationTransaction(state, registry, transaction);
  if (!result.ok) throw new Error(result.error);
  const activeActivations = recordActivation(state, result.plan, transaction);
  return { ...state, ...result.plan, activeActivations };
}

test('deactivation restores authored fields and preserves selection and unrelated writes', () => {
  const state = setup();
  state.resources.unrelated = { ...state.resources.unrelated, hidden: false };
  expect(runtimeSnapshot(state).activeActivations).toEqual([
    { annotationId: 'activation', instancePath: undefined, canDeactivate: true },
  ]);
  const result = planDeactivation(state, 'activation');
  expect(result.ok).toBe(true);
  if (result.ok) {
    expect(result.plan.resources.model).toMatchObject({ hidden: true, disabled: true });
    expect(result.plan.resources.unrelated.hidden).toBe(false);
    expect(result.plan).not.toHaveProperty('selectedAnnotation');
    expect(result.plan).not.toHaveProperty('activeCamera');
    expect(result.plan.activeActivations).toEqual({});
  }
});
test('unsafe actions and subsequent writes fail; overlapping ownership is retained', () => {
  expect(planDeactivation(setup(['start']), 'activation').ok).toBe(false);
  expect(planDeactivation(setup(['reset']), 'activation').ok).toBe(false);
  const state = setup();
  state.resources.model = { ...state.resources.model, hidden: true };
  expect(planDeactivation(state, 'activation').ok).toBe(false);
  const overlap = setup();
  overlap.activeActivations.other = { ...Object.values(overlap.activeActivations)[0], annotationId: 'other' };
  const result = planDeactivation(overlap, 'activation');
  expect(result.ok).toBe(true);
  if (result.ok) {
    expect(result.plan.resources).toEqual(overlap.resources);
    expect(Object.keys(result.plan.activeActivations)).toEqual(['other']);
  }
});

test('scoped deactivation restores authored transforms and keeps other instances active', () => {
  const state = setup();
  const transform = [{ type: 'TranslateTransform', x: 10, y: 20, z: 30 }] as any;
  state.resources.model = { ...state.resources.model, transformOverride: transform };
  state.activeActivations = {
    first: {
      annotationId: 'activation',
      instancePath: 'scene/first',
      canDeactivate: true,
      fields: { model: { transformOverride: transform } },
    },
    second: {
      annotationId: 'activation',
      instancePath: 'scene/second',
      canDeactivate: true,
      fields: { unrelated: { hidden: true } },
    },
  };
  const result = planDeactivation(state, { id: 'activation', path: 'scene/first' });
  expect(result.ok).toBe(true);
  if (result.ok) {
    expect(result.plan.resources.model.transformOverride).toBeNull();
    expect(Object.keys(result.plan.activeActivations)).toEqual(['second']);
    expect(result.plan.resources.model.hidden).toBe(false);
  }
});

test('deactivation refuses to restore a camera that became active after the transaction', () => {
  const state = setup(['show']);
  state.resources.model = { ...state.resources.model, type: 'perspective-camera' };
  state.activeCamera = 'model';
  const before = state.resources.model;
  expect(planDeactivation(state, 'activation')).toMatchObject({
    ok: false,
    error: expect.stringContaining('camera is now active'),
  });
  expect(state.resources.model).toBe(before);
});

test('non-camera selection does not give a scoped transaction ownership of sibling instances', () => {
  const state = setup(['show']);
  const model = { ...state.initialResources.model };
  state.resources = { a: model, b: { ...model } };
  state.initialResources = { ...state.resources };
  state.idIndex = { shared: ['a', 'b'] };
  state.activeActivations = {};
  const registry = new Map(
    ['a', 'b'].map((path) => [
      path,
      { path, ids: ['shared'], type: 'model', instancePath: path, supportedActions: ['show', 'select'] },
    ])
  );
  const safe = {
    annotationId: 'safe-b',
    steps: [{ source: { id: 'shared' }, actions: ['show'], transform: [], selector: null }],
  } as any;
  const first = planActivationTransaction(state, registry, safe, 'b');
  if (!first.ok) throw new Error(first.error);
  const withB = {
    ...state,
    ...first.plan,
    activeActivations: recordActivation(state, first.plan, safe, 'b', registry),
  };
  const unsafe = {
    annotationId: 'select-a',
    steps: [{ source: { id: 'shared' }, actions: ['show', 'select'], transform: [], selector: null }],
  } as any;
  const second = planActivationTransaction(withB, registry, unsafe, 'a');
  if (!second.ok) throw new Error(second.error);
  const both = {
    ...withB,
    ...second.plan,
    activeActivations: recordActivation(withB, second.plan, unsafe, 'a', registry),
  };
  expect(Object.values(both.activeActivations).find((entry) => entry.annotationId === 'select-a')?.fields).toEqual({
    a: { hidden: false },
  });
  expect(planDeactivation(both, 'safe-b').ok).toBe(true);
});

test('unregistering and replacing an authored resource discards obsolete activation ownership', () => {
  const state = setup(['show']);
  const records = invalidateActivationResource(state.activeActivations, 'model');
  expect(records).toEqual({});
  const replacement = { ...state, resources: { ...state.initialResources }, activeActivations: records };
  expect(runtimeSnapshot(replacement).activeActivations).toEqual([]);
  expect(replacement.resources.model.hidden).toBe(true);
});
