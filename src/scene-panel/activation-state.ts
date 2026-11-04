import type { ActivationTransaction } from '@iiif/helpers/activations';
import { planActivationTransaction, type ActivationPlan } from './activation-engine';
import type { ResourceRuntime, SceneRuntimeState } from './store';
import type { SceneAnnotationRef, SceneResourceRegistration } from './types';

type Field = 'hidden' | 'disabled' | 'transformOverride';
export type ActivationRecord = {
  annotationId: string;
  instancePath?: string;
  canDeactivate: boolean;
  cameraSelectionOnly?: boolean;
  fields: Record<string, Partial<Pick<ResourceRuntime, Field>>>;
  resourcePaths?: readonly string[];
};
const keyFor = (id: string, path?: string) => JSON.stringify([id, path || null]);

function cameraSelectionOnly(
  current: SceneRuntimeState,
  transaction: ActivationTransaction,
  instancePath?: string,
  registry?: ReadonlyMap<string, SceneResourceRegistration>
) {
  if (transaction.steps.length !== 1) return false;
  const step = transaction.steps[0];
  if (step.actions.length !== 1 || step.actions[0] !== 'select' || step.transform.length) return false;
  const id = step.source?.id || (typeof step.sourceRef === 'string' ? step.sourceRef : (step.sourceRef as any)?.id);
  const paths = (current.idIndex[id] || []).filter(
    (path) => !instancePath || registry?.get(path)?.instancePath === instancePath
  );
  return paths.length === 1 && current.resources[paths[0]]?.type.endsWith('camera');
}

/** Replace only a pure authored camera selection; failure leaves the previous camera and ledger intact. */
export function planCameraActivationReplacement(
  current: SceneRuntimeState,
  registry: ReadonlyMap<string, SceneResourceRegistration>,
  previous: SceneAnnotationRef,
  next: ActivationTransaction,
  instancePath?: string
) {
  const id = typeof previous === 'string' ? previous : previous.id;
  const path = typeof previous === 'string' ? undefined : previous.path;
  const entries = Object.entries(current.activeActivations).filter(
    ([, entry]) => entry.annotationId === id && (!path || entry.instancePath === path)
  );
  if (
    entries.length !== 1 ||
    !entries[0][1].cameraSelectionOnly ||
    !cameraSelectionOnly(current, next, instancePath, registry)
  )
    return {
      ok: false as const,
      error: 'Only camera-selection-only interactions can replace a non-reversible interaction.',
    };
  const result = planActivationTransaction(current, registry, next, instancePath);
  if (!result.ok) return result;
  const retained = { ...current.activeActivations };
  delete retained[entries[0][0]];
  return {
    ok: true as const,
    plan: {
      ...result.plan,
      activeActivations: recordActivation(
        { ...current, activeActivations: retained },
        result.plan,
        next,
        instancePath,
        registry
      ),
    },
  };
}

export function recordActivation(
  current: SceneRuntimeState,
  plan: ActivationPlan,
  transaction: ActivationTransaction,
  instancePath?: string,
  registry?: ReadonlyMap<string, SceneResourceRegistration>
) {
  const fields: ActivationRecord['fields'] = {};
  const resourcePaths = new Set<string>();
  // Include no-op writes too: an authored-visible `show` still owns visibility.
  for (const step of transaction.steps) {
    const id = step.source?.id || (typeof step.sourceRef === 'string' ? step.sourceRef : (step.sourceRef as any)?.id);
    for (const path of current.idIndex[id] || []) {
      // Selection can clone unrelated resources; ownership comes from the step's actual scope.
      if (instancePath && registry?.get(path)?.instancePath !== instancePath) continue;
      resourcePaths.add(path);
      const value: Partial<Pick<ResourceRuntime, Field>> = (fields[path] ||= {});
      if (step.actions.some((action) => action === 'show' || action === 'hide'))
        value.hidden = plan.resources[path].hidden;
      if (step.actions.some((action) => action === 'enable' || action === 'disable'))
        value.disabled = plan.resources[path].disabled;
      if (step.transform.length) value.transformOverride = plan.resources[path].transformOverride;
    }
  }
  const canDeactivate =
    plan.activeCamera === current.activeCamera &&
    transaction.steps.every((step) =>
      step.actions.every((action) => ['show', 'hide', 'enable', 'disable'].includes(action))
    );
  const cameraOnly = cameraSelectionOnly(current, transaction, instancePath, registry);
  // Only one authored camera can be selected. Superseded pure selections no
  // longer describe an active effect; mixed transactions retain their ownership.
  const retained =
    cameraOnly || plan.activeCamera !== current.activeCamera
      ? Object.fromEntries(Object.entries(current.activeActivations).filter(([, entry]) => !entry.cameraSelectionOnly))
      : current.activeActivations;
  return {
    ...retained,
    [keyFor(transaction.annotationId, instancePath)]: {
      annotationId: transaction.annotationId,
      instancePath,
      canDeactivate,
      cameraSelectionOnly: cameraOnly,
      fields,
      resourcePaths: [...resourcePaths],
    },
  };
}

/** A replacement registration starts at authored state, so old effects cannot own its fields. */
export function invalidateActivationResource(records: SceneRuntimeState['activeActivations'], path: string) {
  return Object.fromEntries(
    Object.entries(records).flatMap(([key, entry]) => {
      const paths = entry.resourcePaths || Object.keys(entry.fields);
      if (!paths.includes(path)) return [[key, entry]];
      const remaining = paths.filter((candidate) => candidate !== path);
      if (!remaining.length) return [];
      const fields = { ...entry.fields };
      delete fields[path];
      return [[key, { ...entry, fields, resourcePaths: remaining }]];
    })
  );
}

/** Restore authored values, never guess an inverse for playback, reset or selection. */
export function planDeactivation(
  current: SceneRuntimeState,
  annotation: SceneAnnotationRef
): { ok: true; plan: Pick<SceneRuntimeState, 'resources' | 'activeActivations'> } | { ok: false; error: string } {
  const id = typeof annotation === 'string' ? annotation : annotation.id;
  const path = typeof annotation === 'string' ? undefined : annotation.path;
  const entries = Object.entries(current.activeActivations).filter(
    ([, entry]) => entry.annotationId === id && (!path || entry.instancePath === path)
  );
  if (!entries.length) return { ok: false, error: 'Activation is not active.' };
  const removed = new Set(entries.map(([key]) => key));
  if (entries.some(([, entry]) => !entry.canDeactivate))
    return {
      ok: false,
      error: 'Activation contains playback, reset or selection actions; scoped deactivation is not supported.',
    };
  const resources = { ...current.resources };
  for (const [, entry] of entries)
    for (const [resourcePath, fields] of Object.entries(entry.fields)) {
      const initial = current.initialResources[resourcePath];
      if (!initial || !resources[resourcePath]) continue;
      if (
        current.activeCamera === resourcePath &&
        Object.keys(fields).some((field) => initial[field as Field] !== resources[resourcePath][field as Field])
      )
        return {
          ok: false,
          error: 'The affected camera is now active; its authored state cannot be restored separately.',
        };
      for (const field of Object.keys(fields) as Field[]) {
        if (
          Object.entries(current.activeActivations).some(
            ([key, other]) => !removed.has(key) && field in (other.fields[resourcePath] || {})
          )
        )
          return { ok: false, error: 'Another active activation affects the same resource field.' };
        if (resources[resourcePath][field] !== fields[field])
          return { ok: false, error: 'The affected resource changed after activation.' };
        resources[resourcePath] = { ...resources[resourcePath], [field]: initial[field] };
      }
    }
  return {
    ok: true,
    plan: {
      resources,
      activeActivations: Object.fromEntries(
        Object.entries(current.activeActivations).filter(([key]) => !removed.has(key))
      ),
    },
  };
}
