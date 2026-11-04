import type { ActivationTransaction } from "@iiif/helpers/activations";
import { planActivationTransaction, type ActivationPlan } from "./activation-engine";
import type { ResourceRuntime, SceneRuntimeState } from "./store";
import type { SceneAnnotationRef, SceneResourceRegistration } from "./types";

type Field = "hidden" | "disabled" | "transformOverride";
export type ActivationRecord = {
  annotationId: string;
  instancePath?: string;
  canDeactivate: boolean;
  cameraSelectionOnly?: boolean;
  cameraReplacementOnly?: boolean;
  fields: Record<string, Partial<Pick<ResourceRuntime, Field>>>;
  resourcePaths?: readonly string[];
};
const keyFor = (id: string, path?: string) => JSON.stringify([id, path || null]);

function cameraSelectionOnly(
  current: SceneRuntimeState,
  transaction: ActivationTransaction,
  instancePath?: string,
  registry?: ReadonlyMap<string, SceneResourceRegistration>,
) {
  if (transaction.steps.length !== 1) return false;
  const step = transaction.steps[0];
  if (step.actions.length !== 1 || step.actions[0] !== "select" || step.transform.length) return false;
  const id = step.source?.id || (typeof step.sourceRef === "string" ? step.sourceRef : (step.sourceRef as any)?.id);
  const paths = (current.idIndex[id] || []).filter(
    (path) => !instancePath || registry?.get(path)?.instancePath === instancePath,
  );
  return paths.length === 1 && current.resources[paths[0]]?.type.endsWith("camera");
}

/** Authored camera scopes may reveal/enable their one camera before selecting it. */
function cameraReplacementOnly(
  current: SceneRuntimeState,
  transaction: ActivationTransaction,
  instancePath?: string,
  registry?: ReadonlyMap<string, SceneResourceRegistration>,
) {
  if (transaction.steps.length !== 1) return false;
  const step = transaction.steps[0];
  if (
    !step.actions.includes("select") ||
    step.actions.some((action) => !["show", "enable", "select"].includes(action)) ||
    step.transform.length
  )
    return false;
  return cameraSelectionOnly(
    current,
    { ...transaction, steps: [{ ...step, actions: ["select"] }] },
    instancePath,
    registry,
  );
}

/** Replace authored camera-only actions atomically, preserving all unrelated field owners. */
export function planCameraActivationReplacement(
  current: SceneRuntimeState,
  registry: ReadonlyMap<string, SceneResourceRegistration>,
  previous: SceneAnnotationRef,
  next: ActivationTransaction,
  instancePath?: string,
) {
  const id = typeof previous === "string" ? previous : previous.id;
  const path = typeof previous === "string" ? undefined : previous.path;
  const entries = Object.entries(current.activeActivations).filter(
    ([, entry]) => entry.annotationId === id && (!path || entry.instancePath === path),
  );
  if (
    entries.length !== 1 ||
    !(entries[0][1].cameraReplacementOnly || entries[0][1].cameraSelectionOnly) ||
    !cameraReplacementOnly(current, next, instancePath, registry)
  )
    return {
      ok: false as const,
      error: "Only camera-only interactions can replace a non-reversible interaction.",
    };
  const result = planActivationTransaction(current, registry, next, instancePath);
  if (!result.ok) return result;
  const nextActivations = recordActivation(current, result.plan, next, instancePath, registry);
  const previousKey = entries[0][0];
  // Pure selections may already have been dropped by recordActivation. Reapplying
  // the same scoped transaction is a new write, not an instruction to undo itself.
  if (!nextActivations[previousKey] || previousKey === keyFor(next.annotationId, instancePath))
    return { ok: true as const, plan: { ...result.plan, activeActivations: nextActivations } };
  const undone = planDeactivationMany(
    {
      ...current,
      ...result.plan,
      activeActivations: {
        ...nextActivations,
        [previousKey]: { ...nextActivations[previousKey], canDeactivate: true },
      },
    },
    [previous],
  );
  if (!undone.ok) return undone;
  return { ok: true as const, plan: { ...result.plan, ...undone.plan } };
}

export function recordActivation(
  current: SceneRuntimeState,
  plan: ActivationPlan,
  transaction: ActivationTransaction,
  instancePath?: string,
  registry?: ReadonlyMap<string, SceneResourceRegistration>,
) {
  const fields: ActivationRecord["fields"] = {};
  const resourcePaths = new Set<string>();
  // Include no-op writes too: an authored-visible `show` still owns visibility.
  for (const step of transaction.steps) {
    const id = step.source?.id || (typeof step.sourceRef === "string" ? step.sourceRef : (step.sourceRef as any)?.id);
    for (const path of current.idIndex[id] || []) {
      // Selection can clone unrelated resources; ownership comes from the step's actual scope.
      if (instancePath && registry?.get(path)?.instancePath !== instancePath) continue;
      resourcePaths.add(path);
      const value: Partial<Pick<ResourceRuntime, Field>> = (fields[path] ||= {});
      if (step.actions.some((action) => action === "show" || action === "hide"))
        value.hidden = plan.resources[path].hidden;
      if (step.actions.some((action) => action === "enable" || action === "disable"))
        value.disabled = plan.resources[path].disabled;
      if (step.transform.length) value.transformOverride = plan.resources[path].transformOverride;
    }
  }
  const canDeactivate =
    plan.activeCamera === current.activeCamera &&
    transaction.steps.every((step) =>
      step.actions.every((action) => ["show", "hide", "enable", "disable"].includes(action)),
    );
  const cameraOnly = cameraSelectionOnly(current, transaction, instancePath, registry);
  // Only one authored camera can be selected. Superseded pure selections no
  // longer describe an active effect; mixed transactions retain their ownership.
  const retained =
    cameraOnly || plan.activeCamera !== current.activeCamera
      ? Object.fromEntries(Object.entries(current.activeActivations).filter(([, entry]) => !entry.cameraSelectionOnly))
      : current.activeActivations;
  // Object property replacement does not change insertion order. Re-applying is a new write.
  const ordered = { ...retained };
  delete ordered[keyFor(transaction.annotationId, instancePath)];
  return {
    ...ordered,
    [keyFor(transaction.annotationId, instancePath)]: {
      annotationId: transaction.annotationId,
      instancePath,
      canDeactivate,
      cameraSelectionOnly: cameraOnly,
      cameraReplacementOnly: cameraReplacementOnly(current, transaction, instancePath, registry),
      fields,
      resourcePaths: [...resourcePaths],
    },
  };
}

/** A replacement registration starts at authored state, so old effects cannot own its fields. */
export function invalidateActivationResource(records: SceneRuntimeState["activeActivations"], path: string) {
  return Object.fromEntries(
    Object.entries(records).flatMap(([key, entry]) => {
      const paths = entry.resourcePaths || Object.keys(entry.fields);
      if (!paths.includes(path)) return [[key, entry]];
      const remaining = paths.filter((candidate) => candidate !== path);
      if (!remaining.length) return [];
      const fields = { ...entry.fields };
      delete fields[path];
      return [[key, { ...entry, fields, resourcePaths: remaining }]];
    }),
  );
}

/** Undo one activation, retaining the writes of every remaining ledger owner. */
export function planDeactivation(current: SceneRuntimeState, annotation: SceneAnnotationRef) {
  return planDeactivationMany(current, [annotation]);
}

/** Preflight the entire set before publishing any changes. Ledger insertion order is write order. */
export function planDeactivationMany(
  current: SceneRuntimeState,
  annotations: readonly SceneAnnotationRef[],
): { ok: true; plan: Pick<SceneRuntimeState, "resources" | "activeActivations"> } | { ok: false; error: string } {
  if (!annotations.length) return { ok: false, error: "No activations specified." };
  const ledger = Object.entries(current.activeActivations);
  const removed = new Set<string>();
  for (const annotation of annotations) {
    const id = typeof annotation === "string" ? annotation : annotation.id;
    const path = typeof annotation === "string" ? undefined : annotation.path;
    const matches = ledger.filter(([, entry]) => entry.annotationId === id && (!path || entry.instancePath === path));
    if (!matches.length) return { ok: false, error: "Activation is not active." };
    for (const [key, entry] of matches) {
      if (!entry.canDeactivate)
        return {
          ok: false,
          error: "Activation contains playback, reset or selection actions; scoped deactivation is not supported.",
        };
      removed.add(key);
    }
  }
  const touched = new Map<string, Set<Field>>();
  for (const [key, entry] of ledger) {
    if (!removed.has(key)) continue;
    for (const [path, fields] of Object.entries(entry.fields)) {
      const names = touched.get(path) || new Set<Field>();
      for (const field of Object.keys(fields) as Field[]) names.add(field);
      touched.set(path, names);
    }
  }
  const resources = { ...current.resources };
  for (const [path, fields] of touched) {
    const initial = current.initialResources[path];
    const resource = current.resources[path];
    // Registrations must invalidate their ownership; stale records must never write a replacement.
    if (!initial || !resource) return { ok: false, error: "The affected resource is no longer registered." };
    for (const field of fields) {
      let expected = initial[field];
      let restored = initial[field];
      for (const [key, entry] of ledger) {
        const writes = entry.fields[path];
        if (!writes || !(field in writes)) continue;
        expected = writes[field] as typeof expected;
        if (!removed.has(key)) restored = writes[field] as typeof restored;
      }
      if (resource[field] !== expected) return { ok: false, error: "The affected resource changed after activation." };
      if (current.activeCamera === path && restored !== resource[field])
        return {
          ok: false,
          error: "The affected camera is now active; its authored state cannot be restored separately.",
        };
      resources[path] = { ...resources[path], [field]: restored };
    }
  }
  return {
    ok: true,
    plan: {
      resources,
      activeActivations: Object.fromEntries(ledger.filter(([key]) => !removed.has(key))),
    },
  };
}
