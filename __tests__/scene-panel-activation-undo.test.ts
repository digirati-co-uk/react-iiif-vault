import { expect, test } from 'vitest';
import { Vault4 } from '@iiif/helpers/vault-4';
import { createActivationsHelper, type ActivationTransaction } from '@iiif/helpers/activations';
import { planActivationTransaction } from '../src/scene-panel/activation-engine';
import {
  invalidateActivationResource,
  planDeactivation,
  planDeactivationMany,
  recordActivation,
} from '../src/scene-panel/activation-state';
import { createSceneRuntimeStore, type ResourceRuntime, type SceneRuntimeState } from '../src/scene-panel/store';
import type { SceneResourceRegistration } from '../src/scene-panel/types';
import chess from './fixtures/scene-chess-undo.json';

const authored: ResourceRuntime = {
  hidden: false,
  disabled: false,
  selected: false,
  playing: false,
  activeAnimation: null,
  resetVersion: 0,
  transformOverride: null,
  type: 'model',
  interactionMode: [],
};
const transform = (x: number) => [{ type: 'TranslateTransform', x, y: 0, z: 0 }] as any;
const tx = (annotationId: string, actions: string[], transforms: any[] = []) =>
  ({
    annotationId,
    steps: [{ source: { id: 'model' }, actions, transform: transforms, selector: null }],
  }) as unknown as ActivationTransaction;
function setup() {
  const state = createSceneRuntimeStore({ id: 'scene', type: 'Scene' } as any, {
    time: 0,
    playing: false,
    playbackRate: 1,
  }).getState();
  state.resources = { a: { ...authored }, b: { ...authored } };
  state.initialResources = { ...state.resources };
  state.idIndex = { model: ['a', 'b'] };
  const registry = new Map<string, SceneResourceRegistration>(
    ['a', 'b'].map((path) => [
      path,
      {
        path,
        ids: ['model'],
        type: 'model',
        instancePath: path,
        supportedActions: ['show', 'hide', 'enable', 'disable', 'start', 'reset', 'select'],
      },
    ])
  );
  return { state, registry };
}
function apply(
  state: SceneRuntimeState,
  registry: Map<string, SceneResourceRegistration>,
  transaction: ActivationTransaction,
  instancePath?: string
): SceneRuntimeState {
  const result = planActivationTransaction(state, registry, transaction, instancePath);
  if (!result.ok) throw new Error(result.error);
  return {
    ...state,
    ...result.plan,
    activeActivations: recordActivation(state, result.plan, transaction, instancePath, registry),
  };
}
function undo(state: SceneRuntimeState, refs: Parameters<typeof planDeactivationMany>[1]): SceneRuntimeState {
  const result = planDeactivationMany(state, refs);
  if (!result.ok) throw new Error(result.error);
  return { ...state, ...result.plan };
}

test('undo earlier or latest owners preserves remaining visibility, transforms and unrelated fields', () => {
  const { state, registry } = setup();
  const first = apply(state, registry, tx('first', ['hide'], transform(1)));
  const second = apply(first, registry, tx('second', ['show', 'disable'], transform(2)));
  const earlier = undo(second, ['first']);
  expect(earlier.resources).toEqual(second.resources);
  expect(Object.values(earlier.activeActivations).map((x) => x.annotationId)).toEqual(['second']);
  const latest = undo(second, ['second']);
  expect(latest.resources).toEqual(first.resources);
  expect(undo(latest, ['first']).resources).toEqual(state.resources);
  expect(undo(earlier, ['second']).resources).toEqual(state.resources);
});

test('reactivation becomes the latest writer, including no-op writes', () => {
  const { state, registry } = setup();
  const first = tx('first', ['hide'], transform(1));
  const both = apply(apply(state, registry, first), registry, tx('second', ['show'], transform(2)));
  const again = apply(both, registry, first);
  expect(Object.values(again.activeActivations).map((x) => x.annotationId)).toEqual(['second', 'first']);
  expect(undo(again, ['first']).resources).toEqual(both.resources);
  expect(undo(again, ['second']).resources).toEqual(again.resources);
  const noOp = apply(apply(state, registry, tx('hide', ['hide'])), registry, tx('hide-again', ['hide']));
  expect(undo(noOp, ['hide']).resources).toEqual(noOp.resources);
});

test('different field owners and repeated instances undo independently', () => {
  const { state, registry } = setup();
  const both = apply(apply(state, registry, tx('visible', ['hide']), 'a'), registry, tx('disabled', ['disable']), 'a');
  const result = undo(both, [{ id: 'visible', path: 'a' }]);
  expect(result.resources.a).toMatchObject({ hidden: false, disabled: true });
  expect(result.resources.b).toEqual(authored);
  const scoped = apply(apply(state, registry, tx('shared', ['hide']), 'a'), registry, tx('shared', ['hide']), 'b');
  expect(undo(scoped, [{ id: 'shared', path: 'a' }]).resources).toEqual({
    a: authored,
    b: { ...authored, hidden: true },
  });
  expect(undo(scoped, ['shared']).resources).toEqual(state.resources);
});

test('bulk undo is atomic for external writes, unsafe transactions and missing refs', () => {
  const { state, registry } = setup();
  const both = apply(apply(state, registry, tx('one', ['hide']), 'a'), registry, tx('two', ['disable']), 'b');
  both.resources.b = { ...both.resources.b, disabled: false };
  const before = JSON.stringify(both);
  expect(planDeactivationMany(both, ['one', 'two'])).toMatchObject({
    ok: false,
    error: expect.stringContaining('changed after'),
  });
  expect(JSON.stringify(both)).toBe(before);
  for (const action of ['start', 'reset', 'select']) {
    const unsafe = apply(both, registry, tx('unsafe', [action]), 'b');
    expect(planDeactivationMany(unsafe, ['one', 'unsafe']).ok).toBe(false);
  }
  expect(planDeactivationMany(both, ['one', 'missing']).ok).toBe(false);
  expect(planDeactivationMany(both, []).ok).toBe(false);
});

test('external mutations are refused even when undoing a masked earlier owner', () => {
  const { state, registry } = setup();
  const both = apply(
    apply(state, registry, tx('one', ['hide'], transform(1))),
    registry,
    tx('two', ['show'], transform(2))
  );
  both.resources.a = { ...both.resources.a, transformOverride: transform(3) };
  expect(planDeactivation(both, 'one').ok).toBe(false);
  expect(planDeactivation(both, 'two').ok).toBe(false);
});

test('registration invalidation discards all stale owners while retaining sibling effects', () => {
  const { state, registry } = setup();
  const both = apply(apply(state, registry, tx('one', ['hide'])), registry, tx('two', ['show']));
  both.activeActivations = invalidateActivationResource(both.activeActivations, 'a');
  both.resources.a = { ...authored, disabled: true };
  const result = undo(both, ['one', 'two']);
  expect(result.resources.a).toEqual(both.resources.a);
  expect(result.resources.b).toEqual(authored);
});

// Verbatim activating annotations 0, 1 and 33 from the installed P4 demos chess.json.
test('real Chess List bodies undo earlier/latest moves and an entire group atomically', () => {
  const vault = new Vault4();
  const scene = vault.loadSync('https://example.org/chess', {
    id: 'https://example.org/chess',
    type: 'Scene',
    annotations: [{ id: 'https://example.org/page', type: 'AnnotationPage', items: chess }],
  } as any) as any;
  const helper = createActivationsHelper(vault);
  const transactions = helper.getAllActivatingAnnotations(scene).map((a) => helper.parseActivatingAnnotation(a)!);
  expect(transactions).toHaveLength(3);
  expect(transactions.every((t) => t.steps.length === 32)).toBe(true);
  const { state } = setup();
  state.resources = {};
  state.idIndex = {};
  const registry = new Map<string, SceneResourceRegistration>();
  for (const step of transactions[0].steps) {
    const id = step.source!.id;
    state.resources[id] = { ...authored };
    state.idIndex[id] = [id];
    registry.set(id, { path: id, ids: [id], type: 'model', supportedActions: ['show', 'hide'] });
  }
  state.initialResources = { ...state.resources };
  const [a, b, c] = transactions;
  const first = apply(state, registry, a);
  const second = apply(first, registry, b);
  const third = apply(second, registry, c);
  expect(undo(second, [b.annotationId]).resources).toEqual(first.resources);
  expect(undo(second, [a.annotationId]).resources).toEqual(second.resources);
  expect(undo(third, [a.annotationId, c.annotationId]).resources).toEqual(second.resources);
  expect(
    undo(
      third,
      transactions.map((t) => t.annotationId)
    ).resources
  ).toEqual(state.resources);
});
