import { createActivationsHelper, type ActivationTransaction } from '@iiif/helpers/activations';
import { parseSceneTarget } from '@iiif/helpers/scenes';
import { isVault4, Vault4 } from '@iiif/helpers/vault-4';
import type { ManifestNormalized, SceneNormalized } from '@iiif/parser/presentation-4-normalized/types';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
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
  AnnotationMarkerProps,
  AnnotationPopoverProps,
  SceneCameraZoomOptions,
} from './types';

type RegistryEntry = SceneResourceRegistration;
type TemporalActivation = { transaction: ActivationTransaction; start: number; end?: number; instant?: number };

export const DEFAULT_KTX2_TRANSCODER_PATH = 'https://cdn.jsdelivr.net/npm/three@0.185.1/examples/jsm/libs/basis/';

export type SceneRuntimeContextValue = {
  vault: Vault4;
  scene: SceneNormalized;
  store: SceneRuntimeStore;
  clock: SceneClock;
  renderers: readonly SceneResourceRenderer[];
  annotations: 'auto' | 'none';
  transitionDuration: number;
  stage: false | { backgroundColor: string; floorColor: string; floorOpacity: number; gridColor: string; size: number };
  debugLights: boolean;
  annotationMarkerSize: number;
  annotationMarker?: React.ComponentType<AnnotationMarkerProps> | false;
  annotationPopover?: React.ComponentType<AnnotationPopoverProps> | false;
  cameraCue: boolean;
  cameraPadding: number;
  cameraZoom: Required<SceneCameraZoomOptions>;
  ktx2TranscoderPath: string;
  register(registration: SceneResourceRegistration): () => void;
  activate(target: string | { id: string }): ActivationResult;
  activateMany(ids: readonly string[]): ActivationResult;
  selectAnnotation(id: string | null): void;
  selectCamera(id: string): void;
  reset(): void;
  resetView(): void;
  resolvePoint(id: string): readonly [number, number, number] | null;
  tick(previous: number, current: number): void;
  diagnostic(diagnostic: SceneDiagnostic): void;
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
    const scene = vault.loadSync<SceneNormalized>(id, input);
    return scene?.type === 'Scene' ? scene : undefined;
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

function LoadedSceneProvider(
  props: Omit<SceneProviderProps, 'vault' | 'scene' | 'manifest'> & {
    vault: Vault4;
    scene: SceneNormalized;
    manifest: ManifestNormalized | null;
  }
) {
  const ownedClock = useMemo(() => createSceneClock(props.scene.duration || 0) as InternalSceneClock, [props.scene.id]);
  const clock = props.clock || ownedClock;
  const store = useMemo(() => createSceneRuntimeStore(props.scene, clock.getSnapshot()), [props.scene.id, clock]);
  const registry = useMemo(() => new Map<string, RegistryEntry>(), [store]);
  const queue = useRef<ActivationTransaction[]>([]);
  const processing = useRef(false);
  const intervalState = useRef(new Set<string>());
  const root = props.manifest || props.scene;
  const activations = useMemo(() => createActivationsHelper(props.vault), [props.vault]);
  const onDiagnostic = useRef(props.onDiagnostic);
  onDiagnostic.current = props.onDiagnostic;

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
    (ownedClock as InternalSceneClock).setDuration(props.scene.duration || 0);
    const sync = () => store.setState({ ...clock.getSnapshot() });
    sync();
    return clock.subscribe(sync);
  }, [clock, ownedClock, props.scene.duration, store]);

  const temporal = useMemo<TemporalActivation[]>(() => {
    return activations.getAllActivatingAnnotations(root as any).flatMap((annotation) => {
      const transaction = activations.parseActivatingAnnotation(annotation);
      const target = props.vault.get<any>(annotation.target as any, {
        parent: annotation,
        skipSelfReturn: false,
        preserveSpecificResources: true,
      });
      const parsed = parseSceneTarget(target || annotation.target, { id: props.scene.id, type: 'Scene' });
      return transaction && parsed.temporal ? [{ transaction, ...parsed.temporal }] : [];
    });
  }, [activations, props.scene.id, props.vault, root]);

  const applyTransaction = useCallback(
    (transaction: ActivationTransaction): ActivationResult => {
      const current = store.getState();
      const result = planActivationTransaction(current, registry, transaction);
      if (!result.ok) return { ok: false, annotationIds: [transaction.annotationId], error: result.error };
      store.setState(result.plan);
      return { ok: true, annotationIds: [transaction.annotationId] };
    },
    [registry, store]
  );

  const flush = useCallback((): ActivationResult => {
    if (processing.current) return { ok: true, annotationIds: [] };
    processing.current = true;
    const completed: string[] = [];
    let failed: string | undefined;
    try {
      while (queue.current.length) {
        const transaction = queue.current.shift()!;
        const result = applyTransaction(transaction);
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
  }, [applyTransaction, diagnostic]);

  const activateMany = useCallback(
    (ids: readonly string[]) => {
      const seen = new Set<string>();
      for (const id of ids) {
        for (const transaction of activations.getActivationsForTarget(root as any, id)) {
          if (!seen.has(transaction.annotationId)) {
            seen.add(transaction.annotationId);
            queue.current.push(transaction);
          }
        }
      }
      return flush();
    },
    [activations, flush, root]
  );

  const register = useCallback(
    (registration: SceneResourceRegistration) => {
      registry.set(registration.path, registration);
      store.setState((state) => {
        const initial: ResourceRuntime = {
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
        return {
          resources: { ...state.resources, [registration.path]: initial },
          initialResources: { ...state.initialResources, [registration.path]: initial },
          idIndex,
          resourcesReady: true,
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
          return { resources, initialResources, idIndex, activeCamera };
        });
      };
    },
    [registry, store]
  );

  const selectAnnotation = useCallback(
    (id: string | null) => {
      store.setState({ selectedAnnotation: id });
      if (id) activateMany([id]);
    },
    [activateMany, store]
  );
  const selectCamera = useCallback(
    (id: string) => {
      const path = store.getState().idIndex[id]?.find((candidate) => {
        const resource = store.getState().resources[candidate];
        return resource?.type.endsWith('camera') && !resource.hidden;
      });
      if (path) store.setState({ activeCamera: path });
    },
    [store]
  );
  const reset = useCallback(() => {
    clock.pause();
    clock.seek(0);
    store.setState((state) => ({
      resources: { ...state.initialResources },
      selectedAnnotation: null,
      activeCamera:
        Object.keys(state.initialResources).find(
          (path) => state.initialResources[path].type.endsWith('camera') && !state.initialResources[path].hidden
        ) || null,
    }));
  }, [clock, store]);
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
        if (inside && !wasInside) {
          intervalState.current.add(key);
          queue.current.push(item.transaction);
        }
        if (!inside && wasInside) intervalState.current.delete(key);
      }
      flush();
    },
    [flush, temporal]
  );
  const resolvePoint = useCallback(
    (id: string) => {
      for (const path of store.getState().idIndex[id] || []) {
        const point = registry.get(path)?.getBounds?.();
        if (point) return point;
      }
      return null;
    },
    [registry, store]
  );

  const activate = useCallback(
    (target: string | { id: string }) => activateMany([typeof target === 'string' ? target : target.id]),
    [activateMany]
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
      activate,
      getSnapshot: () => runtimeSnapshot(store.getState()),
    }),
    [activate, clock, reset, resetView, selectAnnotation, selectCamera, store]
  );
  const handle = useCallback(() => panelHandle, [panelHandle]);

  const value = useMemo<SceneRuntimeContextValue>(() => {
    return {
      vault: props.vault,
      scene: props.scene,
      store,
      clock,
      renderers: props.renderers || [],
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
    props.debug,
    props.ktx2TranscoderPath,
    props.renderers,
    props.scene,
    props.stage,
    props.transitions,
    props.vault,
    activateMany,
    diagnostic,
    handle,
    register,
    reset,
    resetView,
    resolvePoint,
    selectAnnotation,
    selectCamera,
    store,
    tick,
  ]);

  return (
    <SceneRuntimeContext.Provider value={value}>
      <ResourceProvider value={{ scene: props.scene.id, manifest: props.manifest?.id }}>
        {props.children}
      </ResourceProvider>
    </SceneRuntimeContext.Provider>
  );
}

function normalizeDirectoryPath(path: string | undefined) {
  const value = path?.trim() || DEFAULT_KTX2_TRANSCODER_PATH;
  return value.endsWith('/') ? value : `${value}/`;
}
