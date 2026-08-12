import { KNOWN_ACTIVATION_ACTIONS, type ActivationTransaction } from '@iiif/helpers/activations';
import type { Transform } from '@iiif/parser/presentation-4/types';
import type { SceneRuntimeState } from './store';
import type { SceneResourceRegistration } from './types';

const KNOWN_ACTIONS = new Set<string>(KNOWN_ACTIVATION_ACTIONS);

export type ActivationPlan = Pick<
  SceneRuntimeState,
  'resources' | 'activeCamera' | 'selectedAnnotation' | 'selectedAnnotationPath'
>;

/** Preflight every action and return one immutable state patch. */
export function planActivationTransaction(
  current: SceneRuntimeState,
  registry: ReadonlyMap<string, SceneResourceRegistration>,
  transaction: ActivationTransaction,
  instancePath?: string
): { ok: true; plan: ActivationPlan } | { ok: false; error: string } {
  const planned: Array<{
    path: string;
    actions: readonly string[];
    animation: string | null;
    transform: readonly Transform[];
  }> = [];
  for (const step of transaction.steps) {
    const sourceId =
      step.source?.id || (typeof step.sourceRef === 'string' ? step.sourceRef : (step.sourceRef as any)?.id);
    const paths = sourceId
      ? (current.idIndex[sourceId] || []).filter(
          (path) => !instancePath || registry.get(path)?.instancePath === instancePath
        )
      : [];
    if (!paths.length) return { ok: false, error: `Activation source not rendered: ${sourceId || 'unknown'}` };
    for (const path of paths) {
      const registration = registry.get(path);
      for (const action of step.actions) {
        if (!KNOWN_ACTIONS.has(action) || !registration?.supportedActions?.includes(action)) {
          return { ok: false, error: `Unsupported activation action: ${action}` };
        }
      }
      const selectors = Array.isArray(step.selector) ? step.selector : step.selector ? [step.selector] : [];
      const animationSelector = selectors.find((selector: any) => selector?.type === 'AnimationSelector') as
        | { value?: string; name?: string; id?: string }
        | undefined;
      planned.push({
        path,
        actions: step.actions,
        animation: animationSelector?.value || animationSelector?.name || animationSelector?.id || null,
        transform: step.transform,
      });
    }
  }

  const resources = { ...current.resources };
  let activeCamera = current.activeCamera;
  let selectedAnnotation = current.selectedAnnotation;
  let selectedAnnotationPath = current.selectedAnnotationPath;
  for (const { path, actions, animation, transform } of planned) {
    let value = { ...resources[path] };
    if (transform.length) value.transformOverride = transform;
    for (const action of actions) {
      if (action === 'show') value.hidden = false;
      if (action === 'hide') {
        value.hidden = true;
        if (activeCamera === path) activeCamera = null;
      }
      if (action === 'enable') value.disabled = false;
      if (action === 'disable') value.disabled = true;
      if (action === 'start') {
        value.playing = true;
        value.activeAnimation = animation;
      }
      if (action === 'stop') {
        value.playing = false;
        value.activeAnimation = animation;
      }
      if (action === 'reset') {
        value.playing = false;
        value.activeAnimation = animation;
        value.resetVersion += 1;
        value.transformOverride = null;
      }
      if (action === 'select') {
        if (value.type.endsWith('camera')) activeCamera = path;
        else {
          for (const [candidate, resource] of Object.entries(resources))
            resources[candidate] = { ...resource, selected: false };
          value = { ...value, selected: true };
          selectedAnnotation = registry.get(path)?.annotationId || registry.get(path)?.ids[0] || selectedAnnotation;
          selectedAnnotationPath = path;
        }
        value.selected = true;
      }
    }
    resources[path] = value;
  }
  return { ok: true, plan: { resources, activeCamera, selectedAnnotation, selectedAnnotationPath } };
}
