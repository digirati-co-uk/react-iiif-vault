import { createActivationsHelper, type ActivationTransaction } from '@iiif/helpers/activations';
import { parseSceneTarget } from '@iiif/helpers/scenes';
import { isVault4, Vault4 } from '@iiif/helpers/vault-4';
import { addMappings, importEntities } from '@iiif/helpers/vault/actions';
import type {
  AnnotationNormalized,
  ManifestNormalized,
  SceneNormalized,
} from '@iiif/parser/presentation-4-normalized/types';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { useStore } from 'zustand';
import { ReactVaultContext, VaultProvider } from '../context/VaultContext';
import { ResourceProvider } from '../context/ResourceContext';
import { createSceneClock, type InternalSceneClock } from './clock';
import { easeOutExpo } from './atlas-orbit-controls';
import { planActivationTransaction } from './activation-engine';
import {
  createSceneRuntimeStore,
  runtimeSnapshot,
  type ResourceRuntime,
  type SceneRuntimeState,
  type SceneRuntimeStore,
} from './store';
import type {
  ActivationResult,
  SceneClock,
  SceneDiagnostic,
  SceneInput,
  ScenePanelHandle,
  SceneProviderProps,
  SceneResourceRegistration,
  SceneResourceRenderer,
  SceneResourceDecoratorProps,
  AnnotationMarkerProps,
  AnnotationPopoverProps,
  SceneCameraZoomOptions,
  SceneCameraControlsOptions,
  SceneBounds,
  SceneResourceStatus,
  SceneView,
  SceneAnnotationRef,
} from './types';

type RegistryEntry = SceneResourceRegistration;
type TemporalActivation = { transaction: ActivationTransaction; start: number; end?: number; instant?: number };
type SceneViewController = {
  getView(): SceneView;
  setView(view: SceneView, options?: { transition?: boolean }): void;
  frame(bounds: SceneBounds, options?: { padding?: number }): void;
};
export const DEFAULT_KTX2_TRANSCODER_PATH = 'https://cdn.jsdelivr.net/npm/three@0.185.1/examples/jsm/libs/basis/';

export type SceneRuntimeContextValue = {
  vault: Vault4;
  scene: SceneNormalized;
  store: SceneRuntimeStore;
  clock: SceneClock;
  renderers: readonly SceneResourceRenderer[];
  resourceDecorator?: (props: SceneResourceDecoratorProps) => React.ReactNode;
  annotations: 'auto' | 'none';
  transitionDuration: number;
  stage: false | { backgroundColor: string; floorColor: string; floorOpacity: number; gridColor: string; size: number };
  debugLights: boolean;
  selectionEnabled: boolean;
  annotationMarkerSize: number;
  annotationMarker?: React.ComponentType<AnnotationMarkerProps> | false;
  annotationPopover?: React.ComponentType<AnnotationPopoverProps> | false;
  cameraCue: boolean;
  cameraPadding: number;
  cameraZoom: Required<SceneCameraZoomOptions>;
  cameraControls: Required<SceneCameraControlsOptions>;
  ktx2TranscoderPath: string;
  register(registration: SceneResourceRegistration): () => void;
  activate(target: string | { id: string; path?: string }): ActivationResult;
  activateMany(ids: readonly string[], instancePath?: string): ActivationResult;
  selectAnnotation(annotation: SceneAnnotationRef | null): void;
  selectCamera(id: string): void;
  reset(): void;
  resetView(): void;
  resolvePoint(id: string): readonly [number, number, number] | null;
  tick(previous: number, current: number): void;
  diagnostic(diagnostic: SceneDiagnostic): void;
  setResourceStatus(path: string, status: Omit<SceneResourceStatus, 'path'>): void;
  removeResourceStatus(path: string): void;
  refreshResourceBounds(path: string): void;
  registerViewController(controller: SceneViewController): () => void;
  handle(): ScenePanelHandle;
};

export const SceneRuntimeContext = createContext<SceneRuntimeContextValue | null>(null);

export function useSceneRuntime() {
  const value = useContext(SceneRuntimeContext);
  if (!value) throw new Error('Scene components must be rendered inside SceneProvider');
  return value;
}

export function useSceneStore<T>(selector: (state: SceneRuntimeState) => T): T {
  const { store } = useSceneRuntime();
  return useStore(store, selector);
}

export function useScene(): SceneNormalized {
  return useSceneRuntime().scene;
}

function idOf(input: string | { id: string }) {
  return typeof input === 'string' ? input : input.id;
}

function isEmbedded(input: unknown): input is { id: string; type: string } {
  return (
    !!input &&
    typeof input === 'object' &&
    typeof (input as { id?: unknown }).id === 'string' &&
    Object.keys(input).length > 2
  );
}

async function loadManifest(vault: Vault4, input: SceneProviderProps['manifest']) {
  if (!input) return null;
  if (isEmbedded(input)) return vault.loadManifestSync(input.id, input as any) as ManifestNormalized | undefined;
  const existing = vault.get<ManifestNormalized>(idOf(input as any));
  return existing || vault.loadManifest(idOf(input as any));
}

async function loadScene(vault: Vault4, input: SceneInput | string) {
  const id = idOf(input as any);
  if (isEmbedded(input)) {
    const incoming = new Vault4();
    const scene = incoming.loadSync<SceneNormalized>(id, input);
    if (scene) {
      vault.batch(() => {
        vault.dispatch(addMappings({ mapping: incoming.getState().iiif.mapping }));
        vault.dispatch(importEntities({ entities: incoming.getState().iiif.entities }));
        const current = vault.get<SceneNormalized>(id);
        for (const key of new Set([...Object.keys(current || {}), ...Object.keys(scene)]))
          vault.modifyEntityField({ id, type: 'Scene' }, key, (scene as any)[key]);
      });
    }
    const resolved = vault.get<SceneNormalized>(id);
    return resolved?.type === 'Scene' ? resolved : undefined;
  }
  const existing = vault.get<SceneNormalized>(id);
  const scene = existing || (await vault.load<SceneNormalized>(id));
  return scene?.type === 'Scene' ? scene : undefined;
}

async function selectScene(
  vault: Vault4,
  props: Pick<SceneProviderProps, 'manifest' | 'scene' | 'startScene'>
): Promise<{ scene: SceneNormalized | null; manifest: ManifestNormalized | null; required: boolean }> {
  const manifest = (await loadManifest(vault, props.manifest)) || null;
  if (props.scene) return { scene: (await loadScene(vault, props.scene)) || null, manifest, required: false };
  if (props.startScene) return { scene: (await loadScene(vault, props.startScene)) || null, manifest, required: false };
  if (!manifest) return { scene: null, manifest, required: false };

  if (manifest.start) {
    const start = vault.get<any>(manifest.start, { skipSelfReturn: false });
    const source =
      start?.type === 'SpecificResource'
        ? vault.get<any>(start.source, { parent: start, skipSelfReturn: false })
        : start;
    if (source?.type === 'Scene') return { scene: source, manifest, required: false };
  }
  const scenes = ((vault.get<any>(manifest.items as any, { parent: manifest }) || []) as any[]).filter(
    (item) => item?.type === 'Scene'
  );
  return { scene: scenes.length === 1 ? scenes[0] : null, manifest, required: scenes.length > 1 };
}

export function SceneProvider(props: SceneProviderProps) {
  const parentVault = useContext(ReactVaultContext).vault;
  const vault = useMemo(
    () => props.vault || (isVault4(parentVault) ? parentVault : new Vault4()),
    [props.vault, parentVault]
  );
  const contents = <SceneProviderInner {...props} vault={vault} />;
  return parentVault === vault ? (
    contents
  ) : (
    <VaultProvider vault={vault} version={4}>
      {contents}
    </VaultProvider>
  );
}

function SceneProviderInner(props: SceneProviderProps & { vault: Vault4 }) {
  const [mounted, setMounted] = useState(false);
  const [selection, setSelection] = useState<{ scene: SceneNormalized; manifest: ManifestNormalized | null } | null>(
    null
  );
  const [error, setError] = useState<SceneDiagnostic | null>(null);
  const onReady = useRef(props.onReady);
  const onDiagnostic = useRef(props.onDiagnostic);
  onReady.current = props.onReady;
  onDiagnostic.current = props.onDiagnostic;

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    let active = true;
    setSelection(null);
    setError(null);
    selectScene(props.vault, props)
      .then((result) => {
        if (!active) return;
        if (!result.scene) {
          const diagnostic: SceneDiagnostic = {
            code: result.required ? 'scene-selection-required' : 'scene-not-found',
            severity: 'error',
            message: result.required
              ? 'This Manifest contains multiple Scenes; pass scene or startScene.'
              : 'The requested Scene could not be loaded.',
          };
          onDiagnostic.current?.(diagnostic);
          setError(diagnostic);
          return;
        }
        setSelection({ scene: result.scene, manifest: result.manifest });
        onReady.current?.(result.scene);
      })
      .catch((cause) => {
        if (!active) return;
        const diagnostic = {
          code: 'scene-load-failed',
          severity: 'error' as const,
          message: 'The Scene failed to load.',
          cause,
        };
        onDiagnostic.current?.(diagnostic);
        setError(diagnostic);
      });
    return () => {
      active = false;
    };
  }, [props.vault, props.manifest, props.scene, props.startScene]);

  if (error)
    return <>{props.errorFallback !== undefined ? props.errorFallback : <p role="alert">{error.message}</p>}</>;
  if (!selection)
    return (
      <>
        {!mounted && props.ssrFallback !== undefined ? (
          props.ssrFallback
        ) : props.loadingFallback !== undefined ? (
          props.loadingFallback
        ) : (
          <div
            className="riv-scene-loading riv-scene-loading-standalone"
            role="status"
            aria-live="polite"
            aria-label="Loading 3D scene"
          >
            <span className="riv-scene-spinner" aria-hidden="true" />
            <span>Loading 3D scene…</span>
          </div>
        )}
      </>
    );
  return (
    <ErrorBoundary
      onError={(cause) =>
        onDiagnostic.current?.({
          code: 'scene-runtime-failed',
          severity: 'error',
          message: 'The Scene runtime could not be initialized.',
          cause,
        })
      }
      fallbackRender={() => (
        <>
          {props.errorFallback !== undefined ? (
            props.errorFallback
          ) : (
            <p role="alert">The Scene runtime could not be initialized.</p>
          )}
        </>
      )}
    >
      <LoadedSceneProvider {...props} {...selection} />
    </ErrorBoundary>
  );
}

function selectionState(state: SceneRuntimeState, id: string | null, requestedPath?: string) {
  const selectedAnnotationPath = id
    ? requestedPath && state.idIndex[id]?.includes(requestedPath)
      ? requestedPath
      : state.idIndex[id]?.[0] || null
    : null;
  return {
    selectedAnnotation: id,
    selectedAnnotationPath,
    resources: Object.fromEntries(
      Object.entries(state.resources).map(([path, resource]) => [
        path,
        resource.selected === (path === selectedAnnotationPath)
          ? resource
          : { ...resource, selected: path === selectedAnnotationPath },
      ])
    ),
  };
}

function LoadedSceneProvider(
  props: Omit<SceneProviderProps, 'vault' | 'scene' | 'manifest'> & {
    vault: Vault4;
    scene: SceneNormalized;
    manifest: ManifestNormalized | null;
  }
) {
  const vaultState = useSyncExternalStore(
    (listener) => props.vault.getStore().subscribe(listener),
    () => props.vault.getState(),
    () => props.vault.getState()
  );
  const scene = useMemo(
    () => props.vault.get<SceneNormalized>(props.scene.id) || props.scene,
    [props.scene, props.vault, vaultState]
  );
  const ownedClock = useMemo(() => createSceneClock(scene.duration || 0) as InternalSceneClock, [scene]);
  const clock = props.clock || ownedClock;
  const store = useMemo(() => createSceneRuntimeStore(scene, clock.getSnapshot()), [scene, clock]);
  const registry = useMemo(() => new Map<string, RegistryEntry>(), [store]);
  const queue = useRef<ActivationTransaction[]>([]);
  const processing = useRef(false);
  const intervalState = useRef(new Set<string>());
  const root = props.manifest || scene;
  const activations = useMemo(() => createActivationsHelper(props.vault), [props.vault]);
  const onDiagnostic = useRef(props.onDiagnostic);
  const onResourceStatusChange = useRef(props.onResourceStatusChange);
  onDiagnostic.current = props.onDiagnostic;
  onResourceStatusChange.current = props.onResourceStatusChange;
  const selectionOptions = useRef({
    controlled: props.selectedAnnotation,
    controlledPresent: props.selectedAnnotation !== undefined,
    onSelect: props.onSelectAnnotation,
  });
  selectionOptions.current = {
    controlled: props.selectedAnnotation,
    controlledPresent: props.selectedAnnotation !== undefined,
    onSelect: props.onSelectAnnotation,
  };
  const wasSelectionControlled = useRef(selectionOptions.current.controlledPresent);
  const viewController = useRef<SceneViewController | null>(null);
  const pendingView = useRef<{ view: SceneView; options?: { transition?: boolean } } | null>(null);

  const diagnostic = useCallback(
    (value: SceneDiagnostic) => {
      const key = `${value.code}:${value.resourceId || 'scene'}`;
      store.setState((state) =>
        state.errors[key] === value.message ? state : { errors: { ...state.errors, [key]: value.message } }
      );
      onDiagnostic.current?.(value);
    },
    [store]
  );

  useEffect(() => {
    (ownedClock as InternalSceneClock).setDuration(scene.duration || 0);
    const sync = () => store.setState({ ...clock.getSnapshot() });
    sync();
    return clock.subscribe(sync);
  }, [clock, ownedClock, scene.duration, store]);

  useEffect(() => {
    const selected = props.selectedAnnotation;
    if (selected !== undefined) store.setState((state) => selectionState(state, selected));
    else if (wasSelectionControlled.current) store.setState((state) => selectionState(state, null));
    wasSelectionControlled.current = selectionOptions.current.controlledPresent;
  }, [props.selectedAnnotation, store]);

  useEffect(() => {
    let previous = store.getState().resourceStatuses;
    const emit = () => {
      onResourceStatusChange.current?.(Object.values(previous));
    };
    emit();
    return store.subscribe((state) => {
      if (state.resourceStatuses === previous) return;
      previous = state.resourceStatuses;
      emit();
    });
  }, [store]);

  const temporal = useMemo<TemporalActivation[]>(() => {
    return activations.getAllActivatingAnnotations(root as any).flatMap((annotation) => {
      const transaction = activations.parseActivatingAnnotation(annotation);
      const target = props.vault.get<any>(annotation.target as any, {
        parent: annotation,
        skipSelfReturn: false,
        preserveSpecificResources: true,
      });
      const parsed = parseSceneTarget(target || annotation.target, { id: scene.id, type: 'Scene' });
      return transaction && parsed.temporal ? [{ transaction, ...parsed.temporal }] : [];
    });
  }, [activations, scene.id, props.vault, root]);

  const applyTransaction = useCallback(
    (transaction: ActivationTransaction, instancePath?: string): ActivationResult => {
      const current = store.getState();
      const result = planActivationTransaction(current, registry, transaction, instancePath);
      if (!result.ok) return { ok: false, annotationIds: [transaction.annotationId], error: result.error };
      const plan = selectionOptions.current.controlledPresent
        ? {
            ...result.plan,
            ...selectionState({ ...current, ...result.plan }, selectionOptions.current.controlled || null),
          }
        : result.plan;
      store.setState(plan);
      return { ok: true, annotationIds: [transaction.annotationId] };
    },
    [registry, store]
  );

  const flush = useCallback(
    (instancePath?: string): ActivationResult => {
      if (processing.current) return { ok: true, annotationIds: [] };
      processing.current = true;
      const completed: string[] = [];
      let failed: string | undefined;
      try {
        while (queue.current.length) {
          const transaction = queue.current.shift()!;
          const result = applyTransaction(transaction, instancePath);
          if (!result.ok) {
            diagnostic({
              code: 'activation-aborted',
              severity: 'warning',
              message: result.error || 'Activation transaction aborted.',
              resourceId: transaction.annotationId,
            });
            failed ||= result.error;
            completed.push(...result.annotationIds);
            continue;
          }
          completed.push(transaction.annotationId);
        }
        return failed ? { ok: false, annotationIds: completed, error: failed } : { ok: true, annotationIds: completed };
      } finally {
        processing.current = false;
      }
    },
    [applyTransaction, diagnostic]
  );

  const activateMany = useCallback(
    (ids: readonly string[], instancePath?: string) => {
      const seen = new Set<string>();
      for (const id of ids) {
        for (const transaction of activations.getActivationsForTarget(root as any, id)) {
          if (!seen.has(transaction.annotationId)) {
            seen.add(transaction.annotationId);
            queue.current.push(transaction);
          }
        }
      }
      return flush(instancePath);
    },
    [activations, flush, root]
  );

  const register = useCallback(
    (registration: SceneResourceRegistration) => {
      registry.set(registration.path, registration);
      store.setState((state) => {
        let initial: ResourceRuntime = {
          hidden: registration.initial?.visible === false,
          disabled: registration.initial?.disabled || false,
          selected: registration.initial?.selected || false,
          playing: registration.initial?.playing || false,
          activeAnimation: registration.initial?.activeAnimation || null,
          resetVersion: 0,
          transformOverride: null,
          type: registration.type,
          interactionMode: registration.interactionMode || [],
        };
        const idIndex = { ...state.idIndex };
        for (const id of registration.ids) idIndex[id] = [...new Set([...(idIndex[id] || []), registration.path])];
        const selectedAnnotation =
          state.selectedAnnotation || (initial.selected ? registration.annotationId || null : null);
        const selectedAnnotationPath = selectedAnnotation
          ? state.selectedAnnotationPath || idIndex[selectedAnnotation]?.[0] || null
          : null;
        initial = { ...initial, selected: registration.path === selectedAnnotationPath };
        const resources = Object.fromEntries(
          Object.entries({ ...state.resources, [registration.path]: initial }).map(([path, resource]) => [
            path,
            resource.selected === (path === selectedAnnotationPath)
              ? resource
              : { ...resource, selected: path === selectedAnnotationPath },
          ])
        );
        const box = registration.getBoundingBox?.();
        const annotationId = registration.annotationId;
        const resourceStatuses =
          annotationId && registration.resourceId
            ? {
                ...state.resourceStatuses,
                [registration.path]: {
                  path: registration.path,
                  annotationId,
                  resourceId: registration.resourceId,
                  resourceType: registration.resourceType || registration.type,
                  status: 'ready' as const,
                  ...(box ? { bounds: { min: box.min, max: box.max } } : {}),
                },
              }
            : state.resourceStatuses;
        return {
          resources,
          initialResources: { ...state.initialResources, [registration.path]: initial },
          idIndex,
          selectedAnnotation,
          selectedAnnotationPath,
          resourceStatuses,
          resourcesReady: Object.values(resourceStatuses).every((status) => status.status !== 'loading'),
          activeCamera:
            state.activeCamera || (registration.type.endsWith('camera') && !initial.hidden ? registration.path : null),
        };
      });
      return () => {
        registry.delete(registration.path);
        store.setState((state) => {
          const resources = { ...state.resources };
          const initialResources = { ...state.initialResources };
          delete resources[registration.path];
          delete initialResources[registration.path];
          const idIndex = Object.fromEntries(
            Object.entries(state.idIndex)
              .map(([id, paths]) => [id, paths.filter((path) => path !== registration.path)] as const)
              .filter(([, paths]) => paths.length)
          );
          const activeCamera =
            state.activeCamera === registration.path
              ? Object.keys(resources).find(
                  (path) => resources[path].type.endsWith('camera') && !resources[path].hidden
                ) || null
              : state.activeCamera;
          const resourceStatuses = { ...state.resourceStatuses };
          delete resourceStatuses[registration.path];
          const selection = selectionState(
            { ...state, resources, idIndex },
            state.selectedAnnotation,
            state.selectedAnnotationPath === registration.path ? undefined : state.selectedAnnotationPath || undefined
          );
          return {
            ...selection,
            initialResources,
            idIndex,
            activeCamera,
            resourceStatuses,
            resourcesReady: Object.values(resourceStatuses).every((status) => status.status !== 'loading'),
          };
        });
      };
    },
    [registry, store]
  );

  const selectAnnotation = useCallback(
    (selection: SceneAnnotationRef | null) => {
      const id = typeof selection === 'string' ? selection : selection?.id || null;
      const path = typeof selection === 'object' && selection ? selection.path : undefined;
      if (!selectionOptions.current.controlledPresent) store.setState((state) => selectionState(state, id, path));
      const annotation = id ? props.vault.get<AnnotationNormalized>(id) || null : null;
      selectionOptions.current.onSelect?.(annotation);
      if (id) activateMany([id], path ? registry.get(path)?.instancePath : undefined);
    },
    [activateMany, props.vault, registry, store]
  );
  const selectCamera = useCallback(
    (id: string) => {
      const path = store.getState().idIndex[id]?.find((candidate) => {
        const resource = store.getState().resources[candidate];
        return resource?.type.endsWith('camera') && !resource.hidden;
      });
      if (!path) return;
      const override = (props.cameraControls?.mode || 'manifest') !== 'manifest';
      store.setState({ activeCamera: path, freeViewActive: override });
      const view = override ? registry.get(path)?.getView?.() : null;
      if (view) viewController.current?.setView(view);
    },
    [props.cameraControls?.mode, registry, store]
  );
  const resetView = useCallback(
    () => store.setState((state) => ({ viewResetVersion: state.viewResetVersion + 1 })),
    [store]
  );
  const tick = useCallback(
    (previous: number, current: number) => {
      for (const item of temporal) {
        const key = item.transaction.annotationId;
        if (item.instant !== undefined) {
          if (
            (previous < item.instant && current >= item.instant) ||
            (previous > item.instant && current <= item.instant)
          )
            queue.current.push(item.transaction);
          continue;
        }
        const inside = current >= item.start && (item.end === undefined || current < item.end);
        const wasInside = intervalState.current.has(key);
        const crossed =
          current > previous
            ? previous < (item.end ?? Number.POSITIVE_INFINITY) && current >= item.start
            : current < previous
              ? current < (item.end ?? Number.POSITIVE_INFINITY) && previous >= item.start
              : inside;
        if (!wasInside && crossed) {
          queue.current.push(item.transaction);
        }
        if (inside) intervalState.current.add(key);
        else intervalState.current.delete(key);
      }
      flush();
    },
    [flush, temporal]
  );
  const reset = useCallback(() => {
    clock.pause();
    clock.seek(0);
    store.setState((state) => {
      const selected = selectionOptions.current.controlledPresent ? selectionOptions.current.controlled || null : null;
      return {
        ...selectionState({ ...state, resources: { ...state.initialResources } }, selected),
        activeCamera:
          Object.keys(state.initialResources).find(
            (path) => state.initialResources[path].type.endsWith('camera') && !state.initialResources[path].hidden
          ) || null,
        freeViewActive: false,
      };
    });
    intervalState.current.clear();
    tick(0, 0);
  }, [clock, store, tick]);
  useEffect(() => {
    let previous = clock.getSnapshot().time;
    intervalState.current.clear();
    tick(previous, previous);
    return clock.subscribe(() => {
      const current = clock.getSnapshot().time;
      tick(previous, current);
      previous = current;
    });
  }, [clock, tick]);
  const resolvePoint = useCallback(
    (id: string) => {
      for (const path of store.getState().idIndex[id] || []) {
        const registration = registry.get(path);
        const box = registration?.getBoundingBox?.();
        if (box) return box.center;
        const point = registration?.getBounds?.();
        if (point) return point;
      }
      return null;
    },
    [registry, store]
  );

  const getAnnotationBounds = useCallback(
    (annotation: SceneAnnotationRef): SceneBounds | null => {
      const id = typeof annotation === 'string' ? annotation : annotation.id;
      const requestedPath = typeof annotation === 'string' ? undefined : annotation.path;
      let result: SceneBounds | null = null;
      for (const path of requestedPath ? [requestedPath] : store.getState().idIndex[id] || []) {
        if (!store.getState().idIndex[id]?.includes(path)) continue;
        const registration = registry.get(path);
        const box = registration?.getBoundingBox?.();
        const point = registration?.getBounds?.();
        result = unionSceneBounds(result, box || (point ? boundsFromPoint(point) : null));
      }
      return result;
    },
    [registry, store]
  );
  const getAllBounds = useCallback(() => {
    let result: SceneBounds | null = null;
    for (const registration of registry.values()) {
      if (registration.type === 'annotation' || registration.frameable === false) continue;
      const box = registration.getBoundingBox?.();
      const point = registration.getBounds?.();
      result = unionSceneBounds(result, box || (point ? boundsFromPoint(point) : null));
    }
    return result;
  }, [registry]);
  const registerViewController = useCallback((controller: SceneViewController) => {
    viewController.current = controller;
    if (pendingView.current) {
      controller.setView(pendingView.current.view, pendingView.current.options);
      pendingView.current = null;
    }
    return () => {
      if (viewController.current === controller) viewController.current = null;
    };
  }, []);
  const setResourceStatus = useCallback(
    (path: string, status: Omit<SceneResourceStatus, 'path'>) =>
      store.setState((state) => {
        const resourceStatuses = { ...state.resourceStatuses, [path]: { ...status, path } };
        return {
          resourceStatuses,
          resourcesReady: Object.values(resourceStatuses).every((resource) => resource.status !== 'loading'),
        };
      }),
    [store]
  );
  const removeResourceStatus = useCallback(
    (path: string) =>
      store.setState((state) => {
        if (!state.resourceStatuses[path]) return state;
        const resourceStatuses = { ...state.resourceStatuses };
        delete resourceStatuses[path];
        return {
          resourceStatuses,
          resourcesReady: Object.values(resourceStatuses).every((resource) => resource.status !== 'loading'),
        };
      }),
    [store]
  );
  const refreshResourceBounds = useCallback(
    (path: string) => {
      const box = registry.get(path)?.getBoundingBox?.();
      if (!box) return;
      store.setState((state) => {
        const status = state.resourceStatuses[path];
        if (!status) return state;
        return {
          resourceStatuses: {
            ...state.resourceStatuses,
            [path]: { ...status, bounds: { min: box.min, max: box.max } },
          },
        };
      });
    },
    [registry, store]
  );

  const activate = useCallback(
    (target: string | { id: string; path?: string }) => {
      const id = typeof target === 'string' ? target : target.id;
      const path = typeof target === 'string' ? undefined : target.path;
      return activateMany([id], path ? registry.get(path)?.instancePath : undefined);
    },
    [activateMany, registry]
  );
  const panelHandle = useMemo<ScenePanelHandle>(
    () => ({
      play: () => clock.play(),
      pause: () => clock.pause(),
      seek: (time) => clock.seek(time),
      setPlaybackRate: (rate) => clock.setPlaybackRate(rate),
      reset,
      resetView,
      selectCamera,
      selectAnnotation,
      frameAnnotation: (id, options) => {
        const bounds = getAnnotationBounds(id);
        if (bounds) viewController.current?.frame(bounds, options);
      },
      frameAll: (options) => {
        const bounds = getAllBounds();
        if (bounds) viewController.current?.frame(bounds, options);
      },
      getAnnotationBounds,
      getView: () => viewController.current?.getView() || cloneSceneView(DEFAULT_SCENE_VIEW),
      setView: (view, options) => {
        store.setState({ freeViewActive: true, freeProjection: view.projection });
        if (viewController.current) viewController.current.setView(view, options);
        else pendingView.current = { view, options };
      },
      activate,
      getSnapshot: () => runtimeSnapshot(store.getState()),
    }),
    [activate, clock, getAllBounds, getAnnotationBounds, reset, resetView, selectAnnotation, selectCamera, store]
  );
  const handle = useCallback(() => panelHandle, [panelHandle]);

  const value = useMemo<SceneRuntimeContextValue>(() => {
    return {
      vault: props.vault,
      scene,
      store,
      clock,
      renderers: props.renderers || [],
      resourceDecorator: props.resourceDecorator,
      annotations: props.annotations || 'auto',
      transitionDuration:
        props.transitions === false
          ? 0
          : Math.max(0, typeof props.transitions === 'object' ? (props.transitions.duration ?? 0.6) : 0.6),
      stage:
        props.stage === false
          ? false
          : {
              backgroundColor: '#111111',
              floorColor: '#1f1f1f',
              floorOpacity: 0.62,
              gridColor: '#737373',
              size: 40,
              ...(typeof props.stage === 'object' ? props.stage : {}),
            },
      debugLights: props.debug === true || (typeof props.debug === 'object' && props.debug.lights === true),
      selectionEnabled:
        props.selectedAnnotation !== undefined ||
        !!props.onSelectAnnotation,
      annotationMarkerSize: Math.max(4, props.annotationMarkerSize ?? 16),
      annotationMarker: props.annotationMarker,
      annotationPopover: props.annotationPopover,
      cameraCue: props.cameraCue !== false,
      cameraPadding: Math.max(1, props.cameraPadding ?? 1.4),
      cameraZoom: {
        duration: Math.max(0, props.cameraZoom?.duration ?? 0.1),
        sensitivity: Math.max(0, props.cameraZoom?.sensitivity ?? 1),
        easing: props.cameraZoom?.easing || easeOutExpo,
        zoomToCursor: props.cameraZoom?.zoomToCursor !== false,
      },
      cameraControls: {
        mode: props.cameraControls?.mode || 'manifest',
        movementSpeed: Math.max(0, props.cameraControls?.movementSpeed ?? 1),
        lookSpeed: Math.max(0, props.cameraControls?.lookSpeed ?? 0.005),
        invertLook: props.cameraControls?.invertLook === true,
        dragToLook: props.cameraControls?.dragToLook !== false,
        autoForward: props.cameraControls?.autoForward === true,
      },
      ktx2TranscoderPath: normalizeDirectoryPath(props.ktx2TranscoderPath),
      register,
      activate,
      activateMany,
      selectAnnotation,
      selectCamera,
      reset,
      resetView,
      resolvePoint,
      tick,
      diagnostic,
      setResourceStatus,
      removeResourceStatus,
      refreshResourceBounds,
      registerViewController,
      handle,
    };
  }, [
    clock,
    activate,
    props.annotationMarker,
    props.annotationMarkerSize,
    props.annotationPopover,
    props.annotations,
    props.cameraCue,
    props.cameraPadding,
    props.cameraZoom,
    props.cameraControls,
    props.debug,
    props.ktx2TranscoderPath,
    props.renderers,
    props.resourceDecorator,
    props.selectedAnnotation,
    props.onSelectAnnotation,
    scene,
    props.stage,
    props.transitions,
    props.vault,
    activateMany,
    diagnostic,
    handle,
    register,
    registerViewController,
    removeResourceStatus,
    refreshResourceBounds,
    reset,
    resetView,
    resolvePoint,
    selectAnnotation,
    selectCamera,
    setResourceStatus,
    store,
    tick,
  ]);

  return (
    <SceneRuntimeContext.Provider value={value}>
      <ResourceProvider value={{ scene: scene.id, manifest: props.manifest?.id }}>{props.children}</ResourceProvider>
    </SceneRuntimeContext.Provider>
  );
}

const DEFAULT_SCENE_VIEW: SceneView = {
  projection: 'perspective',
  position: [0, 0, 5],
  rotation: [0, 0, 0],
  target: [0, 0, 0],
  fieldOfView: 50,
  near: 0.1,
  far: 2000,
};

function cloneSceneView(view: SceneView): SceneView {
  return {
    ...view,
    position: [...view.position],
    rotation: [...view.rotation],
    target: [...view.target],
  };
}

function boundsFromPoint(point: readonly [number, number, number]): SceneBounds {
  const value = [...point] as [number, number, number];
  return { min: [...value], max: [...value], center: value };
}

export function unionSceneBounds(left: SceneBounds | null, right: SceneBounds | null): SceneBounds | null {
  if (!left) return right;
  if (!right) return left;
  const min = left.min.map((value, index) => Math.min(value, right.min[index])) as [number, number, number];
  const max = left.max.map((value, index) => Math.max(value, right.max[index])) as [number, number, number];
  return { min, max, center: min.map((value, index) => (value + max[index]) / 2) as [number, number, number] };
}

function normalizeDirectoryPath(path: string | undefined) {
  const value = path?.trim() || DEFAULT_KTX2_TRANSCODER_PATH;
  return value.endsWith('/') ? value : `${value}/`;
}
