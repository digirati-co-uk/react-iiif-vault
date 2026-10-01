import { createSceneHelper } from '@iiif/helpers/scenes';
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
import { Annotation3D, useResolvedSceneAnnotations } from './annotations';
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
  SceneViewBridge,
  shouldUseFreeViewCamera,
} from './rendering-camera-rig';
import {
  InitialSceneBounds,
  ResourceStatusLifecycle,
  SceneAudioListener,
  StageBackground,
  UnsupportedResource,
} from './rendering-primitives';
import { PaintedResource } from './rendering-resource';
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
  return { currentScene, paintables, vaultState };
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
  const { currentScene, paintables, vaultState } = useCurrentScenePaintables(scene);
  const filtered = useMemo(
    () =>
      paintables.items
        .map((paintable, index) => ({ paintable, index }))
        .filter(({ paintable }) => !filter || filter(paintable)),
    [filter, paintables.items]
  );
  const [floorY, setFloorY] = useState(0);
  const ownedPaintablesOwners = useRef(new Set<symbol>());
  const instancePath = pathPrefix || currentScene.id;
  const paintablesOwners =
    parentScope?.scene.id === currentScene.id && parentScope.instancePath === instancePath
      ? parentScope.paintablesOwners
      : ownedPaintablesOwners;
  const sceneFeatures = useMemo(
    () => inspectSceneTree(runtime.vault, currentScene, filter, instancePath, ancestors),
    [ancestors, currentScene, filter, instancePath, runtime.vault, vaultState]
  );
  const environmentOwnerPath = parentScope?.environmentOwnerPath ?? sceneFeatures.environmentOwnerPath;
  const value = useMemo<SceneRenderContextValue>(() => {
    return {
      scene: currentScene,
      paintables: filtered,
      filter,
      ancestors,
      instancePath,
      parentHasEnvironment,
      hasCamera: sceneFeatures.hasCamera,
      hasLight: sceneFeatures.hasLight,
      hasEnvironment: sceneFeatures.hasEnvironment,
      environmentOwnerPath,
      root,
      floorY,
      setFloorY,
      paintablesOwners,
      renderNestedScene: (props) => <NestedSceneComposition {...props} />,
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
    sceneFeatures,
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
  return inspectSceneTree(vault, scene, filter, instancePath, ancestors).environmentOwnerPath;
}

function inspectSceneTree(
  vault: ReturnType<typeof useSceneRuntime>['vault'],
  scene: SceneNormalized,
  filter: ScenePaintableFilter | undefined,
  instancePath: string,
  ancestors: readonly string[]
): {
  hasCamera: boolean;
  hasLight: boolean;
  hasEnvironment: boolean;
  environmentOwnerPath: string | null;
} {
  if (ancestors.includes(scene.id)) {
    return { hasCamera: false, hasLight: false, hasEnvironment: false, environmentOwnerPath: null };
  }
  const paintables = createSceneHelper(vault).getPaintables(scene).items;
  let hasCamera = false;
  let hasLight = false;
  let hasEnvironment = false;
  let environmentOwnerPath: string | null = null;
  for (const [index, paintable] of paintables.entries()) {
    if ((filter && !filter(paintable)) || paintable.behavior.includes('hidden')) continue;
    const path = `${instancePath}/${paintable.annotationId}/${index}`;
    if (paintable.type.endsWith('camera')) hasCamera = true;
    if (paintable.type.endsWith('light')) hasLight = true;
    if (paintable.type === 'image-based-light') {
      hasEnvironment = true;
      environmentOwnerPath ??= path;
    }
    if (paintable.type !== 'scene') continue;
    const nested = vault.get<SceneNormalized>(paintable.resource.id);
    if (!nested) continue;
    const nestedFeatures = inspectSceneTree(vault, nested, filter, path, [...ancestors, scene.id]);
    hasCamera ||= nestedFeatures.hasCamera;
    hasLight ||= nestedFeatures.hasLight;
    hasEnvironment ||= nestedFeatures.hasEnvironment;
    environmentOwnerPath ??= nestedFeatures.environmentOwnerPath;
  }
  return { hasCamera, hasLight, hasEnvironment, environmentOwnerPath };
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
  const hasVisibleCamera = useSceneStore((state) =>
    Object.values(state.resources).some((resource) => resource.type.endsWith('camera') && !resource.hidden)
  );
  const updateFloor = useCallback((bounds: Box3) => scope.setFloorY(bounds.min.y - 0.002), [scope.setFloorY]);
  if (!scope.root) return <>{children}</>;
  return (
    <InitialSceneBounds
      frame={frame ?? !hasVisibleCamera}
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
  const annotations = useResolvedSceneAnnotations(scope.scene, runtime.manifest, runtime.annotations === 'auto');
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
  const hasVisibleCamera = useSceneStore((state) =>
    Object.values(state.resources).some((resource) => resource.type.endsWith('camera') && !resource.hidden)
  );
  if (!scope.root) return null;
  const useFreeView = shouldUseFreeViewCamera(hasVisibleCamera, freeViewActive, runtime.cameraControls.mode);
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
