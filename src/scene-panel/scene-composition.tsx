import { createSceneHelper, type ScenePaintable } from '@iiif/helpers/scenes';
import type { SceneNormalized } from '@iiif/parser/presentation-4-normalized/types';
import { useThree } from '@react-three/fiber';
import React, {
  Suspense,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { AudioListener, Box3 } from 'three';
import { Annotation3D, getSceneAnnotations } from './annotations';
import { useSceneRuntime, useSceneStore } from './context';
import {
  AudioListenerContext,
  ResourceBoundsContext,
  SceneRenderContext,
  type SceneRenderContextValue,
} from './render-context';
import {
  CameraInteraction,
  CameraPresenceCue,
  CameraTransition,
  FreeViewCamera,
  InitialSceneBounds,
  PaintedResource,
  ResourceStatusLifecycle,
  SceneAudioListener,
  SceneViewBridge,
  StageBackground,
  UnsupportedResource,
  shouldUseFreeViewCamera,
} from './rendering';
import type {
  SceneAutoFrameProps,
  SceneCameraRigProps,
  SceneCompositionProps,
  SceneDefaultCompositionProps,
  ScenePaintableFilter,
  ScenePaintablesProps,
} from './types';

type SceneScopeProps = {
  children: React.ReactNode;
  scene?: SceneNormalized;
  ancestors?: readonly string[];
  pathPrefix?: string;
  parentHasEnvironment?: boolean;
  filter?: ScenePaintableFilter;
  root?: boolean;
};

export function useCurrentScenePaintables(scene?: SceneNormalized) {
  const runtime = useSceneRuntime();
  const vaultState = useSyncExternalStore(
    (listener) => runtime.vault.getStore().subscribe(listener),
    () => runtime.vault.getState(),
    () => runtime.vault.getState()
  );
  const requestedScene = scene || runtime.scene;
  const currentScene = runtime.vault.get<SceneNormalized>(requestedScene.id) || requestedScene;
  const helper = useMemo(() => createSceneHelper(runtime.vault), [runtime.vault]);
  const paintables = useMemo(() => helper.getPaintables(currentScene), [helper, currentScene, vaultState]);
  return { currentScene, paintables };
}

function useSceneRenderContext() {
  const value = useContext(SceneRenderContext);
  if (!value) throw new Error('Scene composition components must be rendered inside ScenePanel.Viewer');
  return value;
}

function SceneScope({
  children,
  scene,
  ancestors = [],
  pathPrefix,
  parentHasEnvironment = false,
  filter,
  root = !scene,
}: SceneScopeProps) {
  const runtime = useSceneRuntime();
  const parentScope = useContext(SceneRenderContext);
  const { currentScene, paintables } = useCurrentScenePaintables(scene);
  const filtered = useMemo(
    () =>
      paintables.items
        .map((paintable, index) => ({ paintable, index }))
        .filter(({ paintable }) => !filter || filter(paintable)),
    [filter, paintables.items]
  );
  const [floorY, setFloorY] = useState(0);
  const paintablesOwners = useRef(new Set<symbol>());
  const instancePath = pathPrefix || currentScene.id;
  const environmentOwnerPath = useMemo(
    () =>
      parentScope?.environmentOwnerPath ??
      findEnvironmentOwnerPath(runtime.vault, currentScene, filter, instancePath, ancestors),
    [ancestors, currentScene, filter, instancePath, parentScope?.environmentOwnerPath, runtime.vault]
  );
  const value = useMemo<SceneRenderContextValue>(() => {
    const visible = filtered.filter(({ paintable }) => !paintable.behavior.includes('hidden'));
    return {
      scene: currentScene,
      paintables: filtered,
      filter,
      ancestors,
      instancePath,
      parentHasEnvironment,
      hasCamera: visible.some(({ paintable }) => paintable.type.endsWith('camera')),
      hasLight: visible.some(({ paintable }) => paintable.type.endsWith('light')),
      hasEnvironment: visible.some(({ paintable }) => paintable.type === 'image-based-light'),
      environmentOwnerPath,
      root,
      floorY,
      setFloorY,
      paintablesOwners,
    };
  }, [
    ancestors,
    currentScene,
    environmentOwnerPath,
    filter,
    filtered,
    floorY,
    instancePath,
    parentHasEnvironment,
    root,
  ]);
  return <SceneRenderContext.Provider value={value}>{children}</SceneRenderContext.Provider>;
}

export function findEnvironmentOwnerPath(
  vault: ReturnType<typeof useSceneRuntime>['vault'],
  scene: SceneNormalized,
  filter: ScenePaintableFilter | undefined,
  instancePath: string,
  ancestors: readonly string[]
): string | null {
  if (ancestors.includes(scene.id)) return null;
  const paintables = createSceneHelper(vault).getPaintables(scene).items;
  for (const [index, paintable] of paintables.entries()) {
    if ((filter && !filter(paintable)) || paintable.behavior.includes('hidden')) continue;
    const path = `${instancePath}/${paintable.annotationId}/${index}`;
    if (paintable.type === 'image-based-light') return path;
    if (paintable.type !== 'scene') continue;
    const nested = vault.get<SceneNormalized>(paintable.resource.id);
    if (!nested) continue;
    const owner = findEnvironmentOwnerPath(vault, nested, filter, path, [...ancestors, scene.id]);
    if (owner) return owner;
  }
  return null;
}

function SceneInfrastructure({ children }: { children: React.ReactNode }) {
  const runtime = useSceneRuntime();
  const inheritedAudioListener = useContext(AudioListenerContext);
  const ownedAudioListener = useMemo(
    () => (inheritedAudioListener ? null : new AudioListener()),
    [inheritedAudioListener]
  );
  const audioListener = inheritedAudioListener || ownedAudioListener!;
  const inheritedBounds = useContext(ResourceBoundsContext);
  const [boundsVersion, setBoundsVersion] = useState(0);
  const ownedBoundsChanged = useCallback(() => setBoundsVersion((version) => version + 1), []);
  const ownedBounds = useMemo(
    () => ({ version: boundsVersion, changed: ownedBoundsChanged }),
    [boundsVersion, ownedBoundsChanged]
  );
  const bounds = inheritedBounds || ownedBounds;

  useEffect(() => {
    const statuses = runtime.store.getState().resourceStatuses;
    runtime.store.setState({ resourcesReady: Object.values(statuses).every((status) => status.status !== 'loading') });
  }, [children, runtime.store]);

  return (
    <ResourceBoundsContext.Provider value={bounds}>
      <AudioListenerContext.Provider value={audioListener}>
        {!inheritedAudioListener ? <SceneAudioListener listener={audioListener} /> : null}
        {children}
      </AudioListenerContext.Provider>
    </ResourceBoundsContext.Provider>
  );
}

export function SceneCompositionRoot({
  composition,
  children,
}: {
  composition?: React.ReactNode | null;
  children?: React.ReactNode;
}) {
  return (
    <SceneScope root>
      <SceneInfrastructure>
        {composition === undefined ? <DefaultComposition /> : composition}
        {children}
      </SceneInfrastructure>
    </SceneScope>
  );
}

export function SceneComposition({ children, filter }: SceneCompositionProps) {
  const parent = useSceneRenderContext();
  return (
    <SceneScope
      scene={parent.scene}
      ancestors={parent.ancestors}
      pathPrefix={parent.instancePath}
      parentHasEnvironment={parent.parentHasEnvironment}
      filter={filter}
      root={parent.root}
    >
      {children}
    </SceneScope>
  );
}

function defaultSlot(value: React.ReactNode | false | undefined, fallback: React.ReactNode) {
  return value === undefined ? fallback : value === false ? null : value;
}

export function DefaultComposition({
  filter,
  background,
  stage,
  fallbackLighting,
  paintables,
  annotations,
  cameraRig,
}: SceneDefaultCompositionProps = {}) {
  return (
    <SceneComposition filter={filter}>
      {defaultSlot(background, <Background />)}
      {defaultSlot(stage, <Stage />)}
      {defaultSlot(fallbackLighting, <FallbackLighting />)}
      <AutoFrame>{defaultSlot(paintables, <Paintables />)}</AutoFrame>
      {defaultSlot(annotations, <Annotations />)}
      {defaultSlot(cameraRig, <CameraRig />)}
    </SceneComposition>
  );
}

export function Background() {
  const runtime = useSceneRuntime();
  const scope = useSceneRenderContext();
  if (!scope.root) return null;
  return (
    <color
      attach="background"
      args={[scope.scene.backgroundColor || (runtime.stage && runtime.stage.backgroundColor) || '#000000']}
    />
  );
}

export function Stage() {
  const runtime = useSceneRuntime();
  const scope = useSceneRenderContext();
  if (!scope.root || !runtime.stage) return null;
  return <StageBackground floorY={scope.floorY} {...runtime.stage} />;
}

export function FallbackLighting() {
  const { hasLight, root } = useSceneRenderContext();
  if (!root || hasLight) return null;
  return (
    <>
      <ambientLight intensity={0.6} color="#ffffff" />
      <directionalLight intensity={1} color="#ffffff" position={[3, 4, 5]} />
    </>
  );
}

function PaintableList({ paintables }: { paintables: SceneRenderContextValue['paintables'] }) {
  const runtime = useSceneRuntime();
  const scope = useSceneRenderContext();
  return (
    <>
      {paintables.map(({ paintable, index }) => {
        const path = `${scope.instancePath}/${paintable.annotationId}/${index}`;
        return (
          <React.Fragment key={`${paintable.annotationId}-${index}`}>
            <ResourceStatusLifecycle path={path} paintable={paintable} />
            <Suspense fallback={null}>
              <ErrorBoundary
                onError={(cause) => {
                  const error = {
                    code: 'resource-load-failed',
                    severity: 'warning' as const,
                    message: `Failed to render ${paintable.resource.id}`,
                    resourceId: paintable.resource.id,
                    cause,
                  };
                  runtime.setResourceStatus(path, {
                    annotationId: paintable.annotationId,
                    resourceId: paintable.resource.id,
                    resourceType: paintable.rawType,
                    status: 'error',
                    error,
                  });
                  runtime.diagnostic(error);
                }}
                fallbackRender={() => <UnsupportedResource />}
              >
                <PaintedResource
                  paintable={paintable}
                  path={path}
                  instancePath={scope.instancePath}
                  ancestors={[...scope.ancestors, scope.scene.id]}
                  environmentAllowed={
                    paintable.type === 'image-based-light'
                      ? scope.environmentOwnerPath === path
                      : !scope.parentHasEnvironment
                  }
                  parentHasEnvironment={scope.parentHasEnvironment || scope.hasEnvironment}
                />
              </ErrorBoundary>
            </Suspense>
          </React.Fragment>
        );
      })}
    </>
  );
}

export function Paintables(_props: ScenePaintablesProps = {}) {
  const scope = useSceneRenderContext();
  const owner = useMemo(() => Symbol('ScenePanel.Paintables'), []);
  useLayoutEffect(() => {
    if (scope.paintablesOwners.current.size) {
      throw new Error('Only one ScenePanel.Paintables may render a Scene scope.');
    }
    scope.paintablesOwners.current.add(owner);
    return () => {
      scope.paintablesOwners.current.delete(owner);
    };
  }, [owner, scope.paintablesOwners]);
  return <PaintableList paintables={scope.paintables} />;
}

export function AutoFrame({ children, frame, padding }: SceneAutoFrameProps) {
  const runtime = useSceneRuntime();
  const scope = useSceneRenderContext();
  const updateFloor = useCallback((bounds: Box3) => scope.setFloorY(bounds.min.y - 0.002), [scope.setFloorY]);
  if (!scope.root) return <>{children}</>;
  return (
    <InitialSceneBounds
      frame={frame ?? !scope.hasCamera}
      padding={padding ?? runtime.cameraPadding}
      onBounds={updateFloor}
    >
      {children}
    </InitialSceneBounds>
  );
}

export function Annotations() {
  const runtime = useSceneRuntime();
  const scope = useSceneRenderContext();
  const annotations =
    runtime.annotations === 'auto' ? getSceneAnnotations(runtime.vault, scope.scene, runtime.manifest) : [];
  return (
    <>
      {annotations.map((annotation) => (
        <Annotation3D key={annotation.id} annotation={annotation} instancePath={scope.instancePath} />
      ))}
    </>
  );
}

export function CameraRig({ children, fallback = true }: SceneCameraRigProps = {}) {
  const runtime = useSceneRuntime();
  const scope = useSceneRenderContext();
  const freeViewActive = useSceneStore((state) => state.freeViewActive);
  if (!scope.root) return null;
  const useFreeView = shouldUseFreeViewCamera(scope.hasCamera, freeViewActive, runtime.cameraControls.mode);
  return (
    <>
      {children}
      <CustomCameraOwnership enabled={!fallback} />
      {fallback ? <FreeViewCamera active={useFreeView} /> : null}
      <CameraInteraction />
      <CameraTransition />
      <SceneViewBridge />
      <CameraPresenceCue enabled={runtime.cameraCue && !scope.hasCamera} />
    </>
  );
}

function CustomCameraOwnership({ enabled }: { enabled: boolean }) {
  const camera = useThree((state) => state.camera);
  useLayoutEffect(() => {
    if (!enabled) return;
    camera.userData.rivSceneCustomView = true;
    return () => {
      delete camera.userData.rivSceneCustomView;
    };
  }, [camera, enabled]);
  return null;
}

export function NestedSceneComposition({
  scene,
  ancestors,
  pathPrefix,
  parentHasEnvironment,
}: Omit<SceneScopeProps, 'children' | 'root'>) {
  const parent = useContext(SceneRenderContext);
  const contents = (
    <SceneScope
      scene={scene}
      ancestors={ancestors}
      pathPrefix={pathPrefix}
      parentHasEnvironment={parentHasEnvironment}
      filter={parent?.filter}
      root={false}
    >
      <Paintables />
      <Annotations />
    </SceneScope>
  );
  return parent ? contents : <SceneInfrastructure>{contents}</SceneInfrastructure>;
}

/** @deprecated Prefer DefaultComposition or the individual composition primitives. */
export function SceneContents(props: Omit<SceneScopeProps, 'children' | 'root'> = {}) {
  if (props.scene) return <NestedSceneComposition {...props} />;
  return <SceneCompositionRoot composition={<DefaultComposition filter={props.filter} />} />;
}
