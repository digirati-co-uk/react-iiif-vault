import {
  createSceneHelper,
  createSceneTransformMatrix,
  parseSceneTarget,
  type MatrixTuple,
  type ScenePaintable,
} from '@iiif/helpers/scenes';
import type { SceneNormalized } from '@iiif/parser/presentation-4-normalized/types';
import { Canvas, createPortal, useFrame, useLoader, useThree, type CanvasProps } from '@react-three/fiber';
import {
  Environment,
  FirstPersonControls,
  FlyControls,
  Html,
  OrthographicCamera,
  PerspectiveCamera,
  PointerLockControls,
  Splat,
  TransformControls,
  useAnimations,
  useGLTF,
} from '@react-three/drei';
import React, {
  createContext,
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
import {
  Audio as ThreeAudio,
  AudioListener,
  AudioLoader,
  ArrowHelper,
  Box3,
  BoxHelper,
  CameraHelper,
  Color,
  Euler,
  Group,
  Matrix4,
  Object3D,
  PositionalAudio,
  Quaternion,
  Vector3,
} from 'three';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { VaultProvider } from '../context/VaultContext';
import { ResourceProvider } from '../context/ResourceContext';
import { type InternalSceneClock } from './clock';
import { SceneRuntimeContext, useSceneRuntime, useSceneStore } from './context';
import { isTemporallyVisible, getLocalMediaTime } from './timing';
import type {
  SceneBounds,
  SceneResourceRendererProps,
  SceneResourceState,
  SceneTransformValue,
  SceneView,
} from './types';
import { Annotation3D, isSupplementaryAnnotation } from './annotations';
import { AtlasOrbitControls, cameraOrbitTarget } from './atlas-orbit-controls';
import { CanvasResource, getMediaPlaybackRate } from './canvas-rendering';

export { createCanvasImageRequestUrl } from './canvas-rendering';

const ACTIONS = ['show', 'hide', 'enable', 'disable', 'start', 'stop', 'reset', 'select'];
const AudioListenerContext = createContext<AudioListener | null>(null);
const ContinuousFramesContext = createContext<() => () => void>(() => () => undefined);
const ResourceBoundsContext = createContext<{ version: number; changed(): void } | null>(null);

export type SceneCanvasProps = Omit<CanvasProps, 'children'> & { children?: React.ReactNode };

export function SceneCanvas({ children, ...canvasProps }: SceneCanvasProps) {
  const runtime = useSceneRuntime();
  const playing = useSceneStore(
    (state) => state.playing || Object.values(state.resources).some((resource) => resource.playing)
  );
  const [continuousFrames, setContinuousFrames] = useState(0);
  const acquireContinuousFrames = useCallback(() => {
    let active = true;
    setContinuousFrames((count) => count + 1);
    return () => {
      if (!active) return;
      active = false;
      setContinuousFrames((count) => Math.max(0, count - 1));
    };
  }, []);
  const { frameloop = 'demand', onPointerMissed, ...restCanvasProps } = canvasProps;
  return (
    <Canvas
      aria-label="IIIF 3D Scene"
      {...restCanvasProps}
      frameloop={selectSceneFrameloop(playing, continuousFrames, frameloop)}
      onPointerMissed={(event) => {
        if (runtime.selectionEnabled) runtime.selectAnnotation(null);
        onPointerMissed?.(event);
      }}
    >
      <ContinuousFramesContext.Provider value={acquireContinuousFrames}>
        <SceneRuntimeContext.Provider value={runtime}>
          <VaultProvider vault={runtime.vault} version={4} resources={{ scene: runtime.scene.id }}>
            <ResourceProvider value={{ scene: runtime.scene.id }}>
              <SceneFrameDriver />
              <Suspense fallback={null}>
                <SceneContents />
                {children}
              </Suspense>
            </ResourceProvider>
          </VaultProvider>
        </SceneRuntimeContext.Provider>
      </ContinuousFramesContext.Provider>
    </Canvas>
  );
}

export function selectSceneFrameloop(playing: boolean, continuousResources: number, fallback: FrameLoopMode) {
  return playing || continuousResources > 0 ? 'always' : fallback;
}

export function syncAnimationPlayback(
  action: { paused: boolean; play(): unknown } | null | undefined,
  playing: boolean
) {
  if (!action) return;
  // play() schedules a stopped/reset Three action without rewinding one that
  // is already active; paused then controls whether its mixer may advance it.
  action.play();
  action.paused = !playing;
}

export function applyModelTransformToCenter(
  center: readonly [number, number, number],
  matrix: readonly number[]
): [number, number, number] {
  return new Vector3(...center).applyMatrix4(new Matrix4().fromArray([...matrix])).toArray();
}

function SceneFrameDriver() {
  const { clock, tick } = useSceneRuntime();
  const previous = useRef(clock.getSnapshot().time);
  const invalidate = useThree((state) => state.invalidate);
  useEffect(() => {
    previous.current = clock.getSnapshot().time;
    return clock.subscribe(() => invalidate());
  }, [clock, invalidate]);
  useFrame((_, delta) => {
    const internal = clock as Partial<InternalSceneClock>;
    internal.advance?.(delta);
    const current = clock.getSnapshot().time;
    if (current !== previous.current) tick(previous.current, current);
    previous.current = current;
  });
  return null;
}

export function SceneContents({
  scene,
  ancestors = [],
  pathPrefix,
  parentHasEnvironment = false,
}: {
  scene?: SceneNormalized;
  ancestors?: readonly string[];
  pathPrefix?: string;
  parentHasEnvironment?: boolean;
} = {}) {
  const runtime = useSceneRuntime();
  const { currentScene, paintables } = useCurrentScenePaintables(scene);
  const inheritedAudioListener = useContext(AudioListenerContext);
  const ownedAudioListener = useMemo(
    () => (inheritedAudioListener ? null : new AudioListener()),
    [inheritedAudioListener]
  );
  const audioListener = inheritedAudioListener || ownedAudioListener!;
  const hasCamera = paintables.items.some(
    (paintable) => paintable.type.endsWith('camera') && !paintable.behavior.includes('hidden')
  );
  const hasLight = paintables.items.some(
    (paintable) => paintable.type.endsWith('light') && !paintable.behavior.includes('hidden')
  );
  const hasEnvironment = paintables.items.some(
    (paintable) => paintable.type === 'image-based-light' && !paintable.behavior.includes('hidden')
  );
  const freeViewActive = useSceneStore((state) => state.freeViewActive);
  const useFreeView = shouldUseFreeViewCamera(
    hasCamera,
    runtime.editing.enabled,
    freeViewActive,
    runtime.cameraControls.mode
  );
  const helper = useMemo(() => createSceneHelper(runtime.vault), [runtime.vault]);
  const annotations =
    runtime.annotations === 'auto' ? helper.getAllAnnotations(currentScene).filter(isSupplementaryAnnotation) : [];
  const [floorY, setFloorY] = useState(0);
  const inheritedBounds = useContext(ResourceBoundsContext);
  const [boundsVersion, setBoundsVersion] = useState(0);
  const ownedBoundsChanged = useCallback(() => setBoundsVersion((version) => version + 1), []);
  const ownedBounds = useMemo(
    () => ({ version: boundsVersion, changed: ownedBoundsChanged }),
    [boundsVersion, ownedBoundsChanged]
  );
  const bounds = inheritedBounds || ownedBounds;
  const updateFloor = useCallback((bounds: Box3) => setFloorY(bounds.min.y - 0.002), []);
  useEffect(() => {
    if (!paintables.items.length) runtime.store.setState({ resourcesReady: true });
  }, [currentScene.id, paintables.items.length, runtime.store]);

  const renderedResources = paintables.items.map((paintable, index) => {
    const path = `${pathPrefix || currentScene.id}/${paintable.annotationId}/${index}`;
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
              ancestors={[...ancestors, currentScene.id]}
              environmentAllowed={!parentHasEnvironment}
              parentHasEnvironment={parentHasEnvironment || hasEnvironment}
            />
          </ErrorBoundary>
        </Suspense>
      </React.Fragment>
    );
  });

  return (
    <ResourceBoundsContext.Provider value={bounds}>
      <AudioListenerContext.Provider value={audioListener}>
        {!inheritedAudioListener ? <SceneAudioListener listener={audioListener} /> : null}
        {!scene ? (
          <color
            attach="background"
            args={[currentScene.backgroundColor || (runtime.stage && runtime.stage.backgroundColor) || '#000000']}
          />
        ) : null}
        {!scene && runtime.stage ? <StageBackground floorY={floorY} {...runtime.stage} /> : null}
        {!scene ? <FreeViewCamera active={useFreeView} /> : null}
        {!scene && !hasLight ? <DefaultLights /> : null}
        {!scene ? (
          <InitialSceneBounds frame={useFreeView} padding={runtime.cameraPadding} onBounds={updateFloor}>
            {renderedResources}
          </InitialSceneBounds>
        ) : (
          renderedResources
        )}
        {annotations.map((annotation) => (
          <Annotation3D key={annotation.id} annotation={annotation} />
        ))}
        {!scene ? (
          <>
            <CameraInteraction />
            <CameraTransition />
            <SceneViewBridge />
            <CameraPresenceCue enabled={runtime.cameraCue && !hasCamera} />
          </>
        ) : null}
      </AudioListenerContext.Provider>
    </ResourceBoundsContext.Provider>
  );
}

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

function ResourceStatusLifecycle({ path, paintable }: { path: string; paintable: ScenePaintable }) {
  const { setResourceStatus, removeResourceStatus } = useSceneRuntime();
  useLayoutEffect(() => {
    setResourceStatus(path, {
      annotationId: paintable.annotationId,
      resourceId: paintable.resource.id,
      resourceType: paintable.rawType,
      status: 'loading',
    });
    return () => removeResourceStatus(path);
  }, [paintable.annotationId, paintable.rawType, paintable.resource.id, path, removeResourceStatus, setResourceStatus]);
  return null;
}

function SceneAudioListener({ listener }: { listener: AudioListener }) {
  const camera = useThree((state) => state.camera);
  useEffect(() => {
    camera.add(listener);
    return () => {
      camera.remove(listener);
    };
  }, [camera, listener]);
  return null;
}

function InitialSceneBounds({
  children,
  frame,
  padding,
  onBounds,
}: {
  children: React.ReactNode;
  frame: boolean;
  padding: number;
  onBounds(bounds: Box3): void;
}) {
  const group = useRef<any>(null);
  const camera = useThree((state) => state.camera);
  const controls = useThree((state) => state.controls) as any;
  const invalidate = useThree((state) => state.invalidate);
  const boundsVersion = useContext(ResourceBoundsContext)?.version;
  const framed = useRef(false);
  const framedCamera = useRef<any>(null);
  const center = useRef<Vector3 | null>(null);

  useLayoutEffect(() => {
    if (framedCamera.current !== camera) {
      framed.current = false;
      framedCamera.current = camera;
    }
    if (group.current) {
      group.current.updateWorldMatrix(true, true);
      const registeredBounds = group.current.children.length ? sceneBoundsFromObject(group.current) : null;
      const bounds = registeredBounds
        ? new Box3(new Vector3(...registeredBounds.min), new Vector3(...registeredBounds.max))
        : new Box3();
      if (registeredBounds) {
        onBounds(bounds);
        center.current = bounds.getCenter(new Vector3());
        if (!framed.current) {
          if (frame && (camera as any).isPerspectiveCamera) {
            const size = bounds.getSize(new Vector3());
            const radius = Math.max(size.x, size.y, size.z);
            const vertical = radius / (2 * Math.tan((Math.PI * Number((camera as any).fov || 50)) / 360));
            const distance = padding * Math.max(vertical, vertical / Number((camera as any).aspect || 1));
            camera.position.set(center.current.x, center.current.y, center.current.z + distance);
            camera.lookAt(center.current);
            camera.near = Math.max(distance / 100, 0.001);
            camera.far = Math.max(distance * 100, 100);
            camera.updateProjectionMatrix();
          }
          framed.current = true;
        }
        if (frame && controls?.target) syncOrbitTargetToBounds(camera, controls, registeredBounds);
      }
    }
    invalidate();
  }, [boundsVersion, camera, controls, frame, invalidate, onBounds, padding]);

  return <group ref={group}>{children}</group>;
}

function StageBackground({
  floorY,
  floorColor,
  floorOpacity,
  gridColor,
  size,
}: {
  floorY: number;
  floorColor: string;
  floorOpacity: number;
  gridColor: string;
  size: number;
}) {
  return (
    <group position={[0, floorY, 0]} userData={{ rivSceneStage: true }}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[size, size]} />
        <meshBasicMaterial color={floorColor} transparent opacity={floorOpacity} depthWrite={false} />
      </mesh>
      <gridHelper
        args={[size, 20, gridColor, gridColor]}
        position={[0, 0.001, 0]}
        material-transparent
        material-opacity={0.32}
      />
    </group>
  );
}

function useResourceState(path: string, paintable: ScenePaintable): SceneResourceState & { resetVersion: number } {
  return useSceneStore((state) => {
    const resource = state.resources[path];
    const temporal = isTemporallyVisible(state.time, paintable.target.temporal);
    return resource
      ? {
          visible: !resource.hidden && temporal,
          disabled: resource.disabled,
          selected: resource.selected,
          playing: resource.playing,
          activeAnimation: resource.activeAnimation,
          resetVersion: resource.resetVersion,
        }
      : { visible: temporal, disabled: false, selected: false, playing: false, activeAnimation: null, resetVersion: 0 };
  });
}

function PaintedResource({
  paintable,
  path,
  ancestors,
  environmentAllowed,
  parentHasEnvironment,
}: {
  paintable: ScenePaintable;
  path: string;
  ancestors: readonly string[];
  environmentAllowed: boolean;
  parentHasEnvironment: boolean;
}) {
  const runtime = useSceneRuntime();
  const state = useResourceState(path, paintable);
  const time = useSceneStore((value) => value.time);
  const rate = useSceneStore((value) => value.playbackRate);
  const playing = useSceneStore((value) => value.playing);
  const transformOverride = useSceneStore((value) => value.resources[path]?.transformOverride);
  const editingMatrixOverride = useSceneStore((value) => value.resources[path]?.editingMatrixOverride);
  const authoredMatrix = useMemo(
    () =>
      createSceneTransformMatrix(
        transformOverride ? [...paintable.bodyTransform, ...transformOverride] : paintable.bodyTransform,
        paintable.target.point || [0, 0, 0]
      ),
    [paintable.bodyTransform, paintable.target.point, transformOverride]
  );
  const matrix = editingMatrixOverride || authoredMatrix;
  const previousAuthoredMatrix = useRef(authoredMatrix);
  useEffect(() => {
    if (previousAuthoredMatrix.current.every((value, index) => Math.abs(value - authoredMatrix[index]) < 1e-10)) return;
    previousAuthoredMatrix.current = authoredMatrix;
    if (!editingMatrixOverride) return;
    runtime.store.setState((value) => ({
      resources: {
        ...value.resources,
        [path]: { ...value.resources[path], editingMatrixOverride: null },
      },
    }));
  }, [authoredMatrix, editingMatrixOverride, path, runtime.store]);
  const custom = runtime.renderers.find((renderer) =>
    renderer.supports({
      resource: paintable.resource,
      annotation: paintable.annotation,
      target: paintable.target,
    })
  );
  const activate = () =>
    state.disabled
      ? { ok: false, annotationIds: [], error: 'Resource is disabled.' }
      : runtime.activateMany([paintable.annotationId, paintable.resource.id]);
  const register = useCallback(
    (registration: Parameters<typeof runtime.register>[0]) =>
      runtime.register({
        ...registration,
        annotationId: registration.annotationId || paintable.annotationId,
        resourceId: registration.resourceId || paintable.resource.id,
        resourceType: registration.resourceType || paintable.rawType,
      }),
    [paintable.annotationId, paintable.rawType, paintable.resource.id, runtime.register]
  );
  const rendererProps: SceneResourceRendererProps = {
    resource: paintable.resource,
    annotation: paintable.annotation,
    target: paintable.target,
    path,
    matrix,
    state,
    clock: { time, playing, playbackRate: rate },
    register,
    activate,
    onDiagnostic: runtime.diagnostic,
  };

  return custom ? (
    <custom.Component {...rendererProps} />
  ) : (
    <BuiltInResource
      {...rendererProps}
      paintable={paintable}
      ancestors={ancestors}
      environmentAllowed={environmentAllowed}
      parentHasEnvironment={parentHasEnvironment}
    />
  );
}

function BuiltInResource(
  props: SceneResourceRendererProps & {
    paintable: ScenePaintable;
    ancestors: readonly string[];
    environmentAllowed: boolean;
    parentHasEnvironment: boolean;
  }
) {
  const runtime = useSceneRuntime();
  const { register, path, resource, annotation, paintable, matrix, state, activate, target } = props;
  const type = paintable.type;
  const notifyBoundsChanged = useContext(ResourceBoundsContext)?.changed;
  const object = useRef<Object3D>(null);
  const bounds = useRef<readonly [number, number, number] | null>(
    type === 'model' && !target.selector ? null : target.point || [0, 0, 0]
  );
  const setBounds = useCallback(
    (point: readonly [number, number, number]) => {
      const current = bounds.current;
      if (current && point.every((value, index) => Math.abs(value - current[index]) < 1e-6)) return;
      bounds.current = point;
      notifyBoundsChanged?.();
      queueMicrotask(() => runtime.refreshResourceBounds(path));
    },
    [notifyBoundsChanged, path, runtime]
  );
  useEffect(() => {
    if (!['trim', 'scale', 'loop'].includes(paintable.timeMode)) {
      props.onDiagnostic({
        code: 'unsupported-time-mode',
        severity: 'warning',
        message: `Unknown timeMode “${paintable.timeMode}”; using trim.`,
        resourceId: resource.id,
      });
    }
  }, [paintable.timeMode, resource.id]);
  useLayoutEffect(
    () =>
      register({
        path,
        ids: [annotation.id, resource.id],
        type,
        supportedActions: ACTIONS,
        getBounds: () => bounds.current,
        getBoundingBox: () => sceneBoundsFromObject(object.current, object.current ? null : bounds.current),
        annotationId: annotation.id,
        resourceId: resource.id,
        resourceType: String(resource.type || paintable.rawType),
        interactionMode: Array.isArray(resource.interactionMode) ? (resource.interactionMode as string[]) : [],
        initial: {
          visible: !paintable.behavior.includes('hidden'),
          disabled: paintable.behavior.includes('disabled'),
        },
      }),
    [
      annotation.id,
      paintable.behavior,
      paintable.rawType,
      path,
      register,
      resource.id,
      resource.interactionMode,
      resource.type,
      type,
    ]
  );

  const pointer = state.disabled
    ? {}
    : {
        onClick: (event: any) => {
          event.stopPropagation();
          if (runtime.selectionEnabled) runtime.selectAnnotation(annotation.id);
          else activate();
        },
      };

  // Three's camera controls assume that the controlled camera is not under a
  // transformed parent. Bake the IIIF painting matrix onto the camera itself.
  if (type === 'perspective-camera' || type === 'orthographic-camera') {
    return state.visible ? <CameraResource {...props} objectRef={object} /> : null;
  }

  let child: React.ReactNode = null;
  if (type === 'model')
    child = isGaussianSplat(resource) ? (
      <GaussianSplatResource resource={resource} />
    ) : isGltf(resource) ? (
      <ModelResource {...props} setBounds={setBounds} />
    ) : (
      <UnsupportedModel resource={resource} />
    );
  else if (type === 'scene') child = <NestedScene {...props} />;
  else if (type === 'canvas') child = <CanvasResource {...props} />;
  else if (type.endsWith('light')) child = <LightResource {...props} />;
  else if (type.endsWith('audio')) child = <AudioResource {...props} />;
  else child = <UnsupportedResource />;
  return (
    <ResourceTransform
      matrix={matrix}
      objectRef={object}
      path={path}
      annotationId={annotation.id}
      targetPoint={target.point}
    >
      <ResourceVisibility visible={state.visible}>
        <group userData={{ iiifIds: [annotation.id, resource.id] }} {...pointer}>
          {child}
        </group>
      </ResourceVisibility>
    </ResourceTransform>
  );
}

function ResourceTransform({
  matrix,
  children,
  objectRef,
  path,
  annotationId,
  targetPoint,
}: {
  matrix: readonly number[];
  children: React.ReactNode;
  objectRef: React.MutableRefObject<Object3D | null>;
  path: string;
  annotationId: string;
  targetPoint: readonly [number, number, number] | null;
}) {
  const runtime = useSceneRuntime();
  const duration = runtime.transitionDuration;
  const invalidate = useThree((value) => value.invalidate);
  const group = useRef<Group>(null);
  const selected = useSceneStore(
    (state) => state.selectedAnnotation === annotationId && state.idIndex[annotationId]?.[0] === path
  );
  const initialized = useRef(false);
  const target = useMemo(() => {
    const position = new Vector3();
    const quaternion = new Quaternion();
    const scale = new Vector3();
    new Matrix4().fromArray([...matrix]).decompose(position, quaternion, scale);
    return { position, quaternion, scale };
  }, [matrix]);
  const transition = useRef<null | {
    elapsed: number;
    fromPosition: Vector3;
    toPosition: Vector3;
    fromQuaternion: Quaternion;
    toQuaternion: Quaternion;
    fromScale: Vector3;
    toScale: Vector3;
  }>(null);

  useLayoutEffect(() => {
    const object = group.current;
    if (!object) return;
    const unchanged =
      object.position.distanceToSquared(target.position) < 1e-12 &&
      object.scale.distanceToSquared(target.scale) < 1e-12 &&
      1 - Math.abs(object.quaternion.dot(target.quaternion)) < 1e-8;
    if (!initialized.current || !duration || unchanged) {
      object.position.copy(target.position);
      object.quaternion.copy(target.quaternion);
      object.scale.copy(target.scale);
      initialized.current = true;
      transition.current = null;
      invalidate();
      queueMicrotask(() => runtime.refreshResourceBounds(path));
      return;
    }
    transition.current = {
      elapsed: 0,
      fromPosition: object.position.clone(),
      toPosition: target.position.clone(),
      fromQuaternion: object.quaternion.clone(),
      toQuaternion: target.quaternion.clone(),
      fromScale: object.scale.clone(),
      toScale: target.scale.clone(),
    };
    invalidate();
  }, [duration, invalidate, target]);

  useFrame((_, delta) => {
    const value = transition.current;
    const object = group.current;
    if (!value || !object) return;
    value.elapsed = Math.min(duration, value.elapsed + Math.min(delta, 1 / 30));
    const progress = duration ? value.elapsed / duration : 1;
    const eased = progress * progress * (3 - 2 * progress);
    object.position.lerpVectors(value.fromPosition, value.toPosition, eased);
    object.quaternion.slerpQuaternions(value.fromQuaternion, value.toQuaternion, eased);
    object.scale.lerpVectors(value.fromScale, value.toScale, eased);
    if (progress === 1) {
      transition.current = null;
      runtime.refreshResourceBounds(path);
    } else invalidate();
  });

  useLayoutEffect(() => {
    objectRef.current = group.current;
    return () => {
      if (objectRef.current === group.current) objectRef.current = null;
    };
  }, [objectRef]);

  return (
    <>
      <group ref={group}>{children}</group>
      {selected ? (
        <EditableObjectControls object={group} path={path} annotationId={annotationId} targetPoint={targetPoint} />
      ) : null}
      {shouldShowSelectionOutline(selected, runtime.editing) ? <SelectionOutline object={group} /> : null}
    </>
  );
}

export function shouldShowSelectionOutline(
  selected: boolean,
  editing: { enabled: boolean; showSelectionOutline: boolean }
) {
  return selected && editing.enabled && editing.showSelectionOutline;
}

function EditableObjectControls({
  object,
  path,
  annotationId,
  targetPoint,
}: {
  object: React.RefObject<Object3D | null>;
  path: string;
  annotationId: string;
  targetPoint: readonly [number, number, number] | null;
}) {
  const runtime = useSceneRuntime();
  const scene = useThree((state) => state.scene);
  const controls = useThree((state) => state.controls) as { enabled?: boolean } | null;
  const transformControls = useRef<any>(null);
  const preDrag = useRef<Matrix4 | null>(null);
  const dragging = useRef(false);

  const value = useCallback(() => {
    const current = object.current;
    if (!current) return null;
    current.updateMatrix();
    return sceneTransformValueFromMatrix(annotationId, current.matrix, targetPoint);
  }, [annotationId, object, targetPoint]);
  const writeOverride = useCallback(() => {
    const current = object.current;
    if (!current) return null;
    current.updateMatrix();
    const editingMatrixOverride = current.matrix.toArray() as unknown as MatrixTuple;
    runtime.store.setState((state) => ({
      resources: {
        ...state.resources,
        [path]: { ...state.resources[path], editingMatrixOverride },
      },
    }));
    runtime.refreshResourceBounds(path);
    return value();
  }, [object, path, runtime, value]);
  const finish = useCallback(() => {
    dragging.current = false;
    setControlsTransforming(controls, false);
    runtime.store.setState({ transforming: false });
  }, [controls, runtime.store]);
  const cancel = useCallback(() => {
    const current = object.current;
    if (!dragging.current || !current || !preDrag.current) return;
    current.matrix.copy(preDrag.current);
    current.matrix.decompose(current.position, current.quaternion, current.scale);
    if (transformControls.current) {
      transformControls.current.dragging = false;
      transformControls.current.axis = null;
      transformControls.current.dispatchEvent({ type: 'dragging-changed', value: false });
    }
    writeOverride();
    finish();
    runtime.editing.onTransformCancel?.(annotationId);
  }, [annotationId, finish, object, runtime.editing, writeOverride]);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') cancel();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [cancel]);
  useEffect(() => () => finish(), [finish]);

  if (!runtime.editing.enabled || !object.current) return null;
  return createPortal(
    <TransformControls
      ref={transformControls}
      object={object as React.RefObject<Object3D>}
      mode={runtime.editing.mode}
      space={runtime.editing.space}
      translationSnap={runtime.editing.translationSnap}
      rotationSnap={
        runtime.editing.rotationSnap == null
          ? runtime.editing.rotationSnap
          : degreesToRadians(runtime.editing.rotationSnap)
      }
      scaleSnap={runtime.editing.scaleSnap}
      onMouseDown={() => {
        if (!object.current) return;
        object.current.updateMatrix();
        preDrag.current = object.current.matrix.clone();
        dragging.current = true;
        setControlsTransforming(controls, true);
        runtime.store.setState({ transforming: true });
      }}
      onObjectChange={() => {
        const transform = writeOverride();
        if (transform) runtime.editing.onTransformChange?.(transform);
      }}
      onMouseUp={() => {
        if (!dragging.current) return;
        const transform = writeOverride();
        finish();
        if (transform) runtime.editing.onTransformCommit?.(transform);
      }}
    />,
    scene
  );
}

function SelectionOutline({ object }: { object: React.RefObject<Object3D | null> }) {
  const scene = useThree((state) => state.scene);
  const helper = useMemo(() => {
    const value = new BoxHelper(new Object3D(), 0x4da3ff);
    value.userData.rivSceneEditorHelper = true;
    value.raycast = () => undefined;
    return value;
  }, []);
  useFrame(() => {
    if (object.current) helper.setFromObject(object.current);
  });
  useEffect(() => () => helper.dispose(), [helper]);
  return createPortal(<primitive object={helper} />, scene);
}

export function sceneTransformValueFromMatrix(
  annotationId: string,
  localMatrix: Matrix4,
  targetPoint: readonly [number, number, number] | null = null
): SceneTransformValue {
  const point = targetPoint || [0, 0, 0];
  const authored = new Matrix4().makeTranslation(-point[0], -point[1], -point[2]).multiply(localMatrix);
  const position = new Vector3();
  const quaternion = new Quaternion();
  const scale = new Vector3();
  authored.decompose(position, quaternion, scale);
  // The P4 helper applies X, then Y, then Z (Rz * Ry * Rx), which is
  // represented by Three's ZYX Euler decomposition.
  const rotation = new Euler().setFromQuaternion(quaternion, 'ZYX');
  return {
    annotationId,
    translation: position.toArray(),
    rotation: [rotation.x, rotation.y, rotation.z].map(radiansToDegrees) as [number, number, number],
    scale: scale.toArray(),
  };
}

function degreesToRadians(value: number) {
  return (value * Math.PI) / 180;
}

function radiansToDegrees(value: number) {
  return (value * 180) / Math.PI;
}

export function setControlsTransforming(controls: { enabled?: boolean } | null, transforming: boolean) {
  if (controls && 'enabled' in controls) controls.enabled = !transforming;
}

export function sceneBoundsFromObject(
  object: Object3D | null,
  fallback?: readonly [number, number, number] | null
): SceneBounds | null {
  if (!object) return fallback ? sceneBoundsFromPoint(fallback) : null;
  object.updateWorldMatrix(true, true);
  const bounds = new Box3();
  object.traverse((child: any) => {
    for (let parent: Object3D | null = child; parent && parent !== object; parent = parent.parent) {
      if (parent.userData.rivSceneEditorHelper) return;
    }
    const geometry = child.geometry;
    if (!geometry) return;
    if (!geometry.boundingBox) geometry.computeBoundingBox();
    if (geometry.boundingBox) bounds.union(geometry.boundingBox.clone().applyMatrix4(child.matrixWorld));
  });
  if (bounds.isEmpty()) {
    const point = fallback
      ? new Vector3(...fallback).applyMatrix4(object.matrixWorld)
      : object.getWorldPosition(new Vector3());
    return sceneBoundsFromPoint(point.toArray());
  }
  const min = bounds.min.toArray();
  const max = bounds.max.toArray();
  return { min, max, center: bounds.getCenter(new Vector3()).toArray() };
}

function sceneBoundsFromPoint(point: readonly [number, number, number]): SceneBounds {
  const value = [...point] as [number, number, number];
  return { min: [...value], max: [...value], center: value };
}

function ResourceVisibility({ visible, children }: { visible: boolean; children: React.ReactNode }) {
  const duration = useSceneRuntime().transitionDuration;
  const invalidate = useThree((value) => value.invalidate);
  const group = useRef<Group>(null);
  const amount = useRef(visible ? 1 : 0);
  const [mounted, setMounted] = useState(visible);
  useEffect(() => {
    if (visible) setMounted(true);
    invalidate();
  }, [invalidate, visible]);
  useFrame((_, delta) => {
    if (!mounted || amount.current === Number(visible)) return;
    const step = duration ? Math.min(delta, 1 / 30) / duration : 1;
    amount.current = visible ? Math.min(1, amount.current + step) : Math.max(0, amount.current - step);
    const eased = amount.current * amount.current * (3 - 2 * amount.current);
    group.current?.scale.setScalar(Math.max(eased, 0.0001));
    group.current?.traverse((object: any) => {
      if (!object.isLight) return;
      if (object.userData.rivSceneBaseIntensity === undefined) object.userData.rivSceneBaseIntensity = object.intensity;
      object.intensity = object.userData.rivSceneBaseIntensity * eased;
    });
    if (!visible && amount.current === 0) setMounted(false);
    else invalidate();
  });
  if (!mounted) return null;
  return (
    <group ref={group} scale={Math.max(amount.current, 0.0001)}>
      {children}
    </group>
  );
}

function isGltf(resource: Record<string, unknown> & { id: string }) {
  const format = String(resource.format || '').toLowerCase();
  return format === 'model/gltf+json' || format === 'model/gltf-binary' || /\.(gltf|glb)(?:$|[?#])/i.test(resource.id);
}

export function isGaussianSplat(resource: Record<string, unknown> & { id: string }) {
  return /\.splat(?:$|[?#])/i.test(resource.id);
}

function GaussianSplatResource({ resource }: { resource: Record<string, unknown> & { id: string } }) {
  const acquireContinuousFrames = useContext(ContinuousFramesContext);
  useLayoutEffect(() => acquireContinuousFrames(), [acquireContinuousFrames]);
  return <Splat src={resource.id} />;
}

type FrameLoopMode = 'always' | 'demand' | 'never';

function UnsupportedModel({ resource }: { resource: Record<string, unknown> & { id: string } }) {
  const runtime = useSceneRuntime();
  useEffect(
    () =>
      runtime.diagnostic({
        code: 'unsupported-model-format',
        severity: 'warning',
        message: `No renderer supports ${String(resource.format || resource.id)}`,
        resourceId: resource.id,
      }),
    [resource.id]
  );
  return <UnsupportedResource />;
}

function ModelResource({
  resource,
  paintable,
  state,
  clock,
  target,
  matrix,
  setBounds,
}: SceneResourceRendererProps & {
  paintable: ScenePaintable;
  setBounds(point: readonly [number, number, number]): void;
}) {
  const gl = useThree((value) => value.gl);
  const ktx2TranscoderPath = useSceneRuntime().ktx2TranscoderPath;
  const ktx = useMemo(
    () => new KTX2Loader().setTranscoderPath(ktx2TranscoderPath).detectSupport(gl),
    [gl, ktx2TranscoderPath]
  );
  const extendLoader = useCallback((loader: any) => loader.setKTX2Loader(ktx), [ktx]);
  const gltf = useGLTF(resource.id, true, true, extendLoader);
  const model = useMemo(() => {
    const object = clone(gltf.scene);
    // Measure while detached. Once mounted, setFromObject includes the
    // ResourceTransform parent and applying the IIIF matrix again doubles it.
    object.updateWorldMatrix(true, true);
    const box = new Box3().setFromObject(object);
    return {
      object,
      center: box.isEmpty() ? null : (box.getCenter(new Vector3()).toArray() as [number, number, number]),
    };
  }, [gltf.scene]);
  const object = model.object;
  const animation = paintable.bodySelector?.find((selector: any) => selector.type === 'AnimationSelector') as
    | { value?: string }
    | undefined;
  const { actions } = useAnimations(gltf.animations, object);
  const activeAction =
    state.activeAnimation || animation?.value
      ? actions[state.activeAnimation || animation?.value || '']
      : Object.values(actions)[0];
  const resetVersion = (state as SceneResourceState & { resetVersion?: number }).resetVersion;
  useLayoutEffect(() => {
    if (model.center) setBounds(applyModelTransformToCenter(model.center, matrix));
  }, [matrix, model, setBounds]);
  useEffect(() => {
    if (!activeAction) return;
    return () => {
      activeAction.stop();
    };
  }, [activeAction]);
  useEffect(() => {
    syncAnimationPlayback(activeAction, state.playing || clock.playing);
  }, [activeAction, clock.playing, state.playing]);
  useEffect(() => {
    if (activeAction)
      activeAction.time = getLocalMediaTime(
        clock.time,
        target.temporal,
        activeAction.getClip().duration,
        paintable.timeMode
      );
  }, [activeAction, clock.time, paintable.timeMode, target.temporal]);
  useEffect(() => {
    for (const action of Object.values(actions)) action?.reset().stop();
    if (activeAction) {
      syncAnimationPlayback(activeAction, state.playing || clock.playing);
      activeAction.time = getLocalMediaTime(
        clock.time,
        target.temporal,
        activeAction.getClip().duration,
        paintable.timeMode
      );
    }
  }, [actions, activeAction, resetVersion]);
  useEffect(() => () => ktx.dispose(), [ktx]);
  return <primitive object={object} />;
}

function NestedScene(
  props: SceneResourceRendererProps & { ancestors: readonly string[]; parentHasEnvironment: boolean }
) {
  const runtime = useSceneRuntime();
  const nested = runtime.vault.get<SceneNormalized>(props.resource.id);
  if (!nested) return <UnsupportedResource />;
  if (props.ancestors.includes(nested.id)) {
    return <SceneCycleDiagnostic id={nested.id} />;
  }
  return (
    <SceneContents
      scene={nested}
      ancestors={props.ancestors}
      pathPrefix={props.path}
      parentHasEnvironment={props.parentHasEnvironment}
    />
  );
}

function SceneCycleDiagnostic({ id }: { id: string }) {
  const runtime = useSceneRuntime();
  useEffect(() => {
    runtime.diagnostic({
      code: 'scene-cycle',
      severity: 'warning',
      message: `Nested Scene cycle ignored: ${id}`,
      resourceId: id,
    });
  }, [id, runtime]);
  return null;
}

export function shouldApplyAuthoredLookAt(
  camera: { position: Vector3; quaternion: Quaternion },
  active: boolean,
  position: readonly [number, number, number],
  quaternion: readonly [number, number, number, number]
) {
  return (
    !active ||
    (camera.position.distanceToSquared(new Vector3(...position)) < 1e-12 &&
      1 - Math.abs(camera.quaternion.dot(new Quaternion(...quaternion))) < 1e-8)
  );
}

function CameraResource({
  resource,
  path,
  matrix,
  state,
  annotation,
  target,
  objectRef,
}: SceneResourceRendererProps & { objectRef: React.MutableRefObject<Object3D | null> }) {
  const runtime = useSceneRuntime();
  const refreshResourceBounds = runtime.refreshResourceBounds;
  const active = useSceneStore((state) => state.activeCamera === path);
  const freeViewActive = useSceneStore((state) => state.freeViewActive);
  const selected = useSceneStore(
    (state) => state.selectedAnnotation === annotation.id && state.idIndex[annotation.id]?.[0] === path
  );
  const camera = useRef<any>(null);
  const lookAtPending = useRef(true);
  const controls = useThree((state) => state.controls) as any;
  const sceneGraph = useThree((state) => state.scene);
  const boundsVersion = useContext(ResourceBoundsContext)?.version;
  const resetVersion = (state as SceneResourceState & { resetVersion?: number }).resetVersion;
  const aspect = useThree((state) => (state.size.height ? state.size.width / state.size.height : 1));
  const positive = (value: unknown, fallback: number) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  };
  const near = positive(resource.near, 0.1);
  const far = Math.max(near + 0.001, positive(resource.far, 2000));
  const matrixKey = matrix.join(',');
  const transform = useMemo(() => {
    const position = new Vector3();
    const quaternion = new Quaternion();
    new Matrix4().fromArray([...matrix]).decompose(position, quaternion, new Vector3());
    return {
      position: position.toArray() as [number, number, number],
      quaternion: quaternion.toArray() as [number, number, number, number],
    };
  }, [matrixKey]);
  useLayoutEffect(() => {
    if (!camera.current) return;
    objectRef.current = camera.current;
    setCameraResourceIds(camera.current, resource.id);
    camera.current.position.fromArray(transform.position);
    camera.current.quaternion.fromArray(transform.quaternion);
    camera.current.userData.rivLookAt = null;
    lookAtPending.current = true;
    queueMicrotask(() => refreshResourceBounds(path));
    return () => {
      if (objectRef.current === camera.current) objectRef.current = null;
    };
  }, [objectRef, path, refreshResourceBounds, resetVersion, resource.id, transform]);
  useLayoutEffect(() => {
    if (!camera.current || !lookAtPending.current) return;
    if (!resource.lookAt) {
      lookAtPending.current = false;
      return;
    }
    const hydrated =
      runtime.vault.get<any>(resource.lookAt as any, { skipSelfReturn: false, preserveSpecificResources: true }) ||
      resource.lookAt;
    const lookAt = hydrated as any;
    const referenceId = resolveLookAtReferenceId(lookAt);
    if (referenceId) {
      let mounted = true;
      const orientToReference = () => {
        if (!mounted || !lookAtPending.current) return;
        let point = runtime.resolvePoint(referenceId);
        if (!point) {
          let object: any = null;
          sceneGraph.traverse((candidate: any) => {
            if (!object && candidate.userData?.iiifIds?.includes(referenceId)) object = candidate;
          });
          if (object) {
            object.updateWorldMatrix(true, true);
            const bounds = new Box3().setFromObject(object);
            if (!bounds.isEmpty()) point = bounds.getCenter(new Vector3()).toArray() as [number, number, number];
          }
        }
        if (point && camera.current) {
          // Bounds changes retry unresolved lookAt references. Once the user
          // has moved an active camera, hydration must not restore its authored view.
          const applyLookAt = shouldApplyAuthoredLookAt(
            camera.current,
            active,
            transform.position,
            transform.quaternion
          );
          camera.current.userData.rivLookAt = [...point];
          if (applyLookAt) camera.current.lookAt(...point);
          if (active && applyLookAt) {
            controls?.target?.set(...point);
            controls?.saveState?.();
          }
          lookAtPending.current = false;
        }
      };
      orientToReference();
      queueMicrotask(orientToReference);
      return () => {
        mounted = false;
      };
    }
    const target = parseSceneTarget(hydrated, { id: runtime.scene.id, type: 'Scene' });
    const point = target.point || runtime.resolvePoint(target.source.id);
    if (point) {
      const applyLookAt = shouldApplyAuthoredLookAt(camera.current, active, transform.position, transform.quaternion);
      camera.current.userData.rivLookAt = [...point];
      if (applyLookAt) camera.current.lookAt(...point);
      if (active && applyLookAt) {
        controls?.target?.set(...point);
        controls?.saveState?.();
      }
      lookAtPending.current = false;
    }
  }, [active, boundsVersion, controls, resetVersion, resource.lookAt, runtime, sceneGraph, transform]);
  const makeDefault =
    active && !runtime.editing.enabled && !freeViewActive && runtime.cameraControls.mode === 'manifest';
  const editor = (
    <>
      {runtime.editing.enabled && runtime.editing.showCameraHelpers ? (
        <CameraEditorHelper
          camera={camera}
          annotationId={annotation.id}
          position={transform.position}
          quaternion={transform.quaternion}
          orthographic={resource.type === 'OrthographicCamera'}
        />
      ) : null}
      {selected ? (
        <EditableObjectControls object={camera} path={path} annotationId={annotation.id} targetPoint={target.point} />
      ) : null}
    </>
  );
  if (resource.type === 'OrthographicCamera') {
    const height = positive(resource.viewHeight, 2);
    return (
      <>
        <OrthographicCamera
          ref={camera}
          makeDefault={makeDefault}
          position={transform.position}
          quaternion={transform.quaternion}
          near={near}
          far={far}
          top={height / 2}
          bottom={-height / 2}
          left={(-height * aspect) / 2}
          right={(height * aspect) / 2}
        />
        {editor}
      </>
    );
  }
  return (
    <>
      <PerspectiveCamera
        ref={camera}
        makeDefault={makeDefault}
        position={transform.position}
        quaternion={transform.quaternion}
        near={near}
        far={far}
        fov={Math.max(1, Math.min(179, positive(resource.fieldOfView, 50)))}
      />
      {editor}
    </>
  );
}

export function setCameraResourceIds(camera: Object3D, resourceId: string) {
  camera.userData.iiifIds = [resourceId];
}

function CameraEditorHelper({
  camera,
  annotationId,
  position,
  quaternion,
  orthographic,
}: {
  camera: React.RefObject<any>;
  annotationId: string;
  position: [number, number, number];
  quaternion: [number, number, number, number];
  orthographic: boolean;
}) {
  const runtime = useSceneRuntime();
  const scene = useThree((state) => state.scene);
  const [helper, setHelper] = useState<CameraHelper | null>(null);
  useLayoutEffect(() => {
    if (!camera.current) return;
    const value = new CameraHelper(camera.current);
    value.userData.rivSceneEditorHelper = true;
    value.raycast = () => undefined;
    setHelper(value);
    return () => {
      value.dispose();
    };
  }, [camera]);
  useFrame(() => helper?.update());
  return (
    <>
      <group
        position={position}
        quaternion={quaternion}
        userData={{ rivSceneEditorHelper: true, annotationId }}
        onClick={(event) => {
          event.stopPropagation();
          runtime.selectAnnotation(annotationId);
        }}
      >
        <mesh>
          <octahedronGeometry args={[0.12, 0]} />
          <meshBasicMaterial color="#4da3ff" depthTest={false} />
        </mesh>
        <mesh position={[0, 0, -0.24]} rotation={[Math.PI / 2, 0, 0]}>
          {orthographic ? <boxGeometry args={[0.24, 0.34, 0.24]} /> : <coneGeometry args={[0.2, 0.4, 4, 1, true]} />}
          <meshBasicMaterial color="#4da3ff" wireframe depthTest={false} />
        </mesh>
      </group>
      {helper ? createPortal(<primitive object={helper} />, scene) : null}
    </>
  );
}

function quantity(value: unknown, fallback = 1) {
  const number =
    typeof value === 'number'
      ? value
      : value && typeof value === 'object'
        ? Number((value as any).quantityValue ?? (value as any).value ?? fallback)
        : fallback;
  return Number.isFinite(number) ? number : fallback;
}

function LightResource(props: SceneResourceRendererProps & { environmentAllowed: boolean }) {
  const { resource } = props;
  const runtime = useSceneRuntime();
  const sceneGraph = useThree((state) => state.scene);
  const light = useRef<any>(null);
  const boundsVersion = useContext(ResourceBoundsContext)?.version;
  const target = useMemo(() => new Object3D(), []);
  const color = String(resource.color || '#FFFFFF');
  const intensity = quantity(resource.intensity);
  useLayoutEffect(() => {
    if (!light.current) return;
    let mounted = true;
    light.current.target = target;
    sceneGraph.add(target);
    const orient = () => {
      if (!mounted) return;
      const matrix = new Matrix4().fromArray([...props.matrix]);
      const origin = new Vector3().setFromMatrixPosition(matrix);
      const fallback = new Vector3(0, -1, 0).transformDirection(matrix).add(origin);
      const lookAt = resource.lookAt as any;
      let point: readonly [number, number, number] | null = null;
      if (lookAt) {
        const hydrated =
          runtime.vault.get(lookAt, { skipSelfReturn: false, preserveSpecificResources: true }) || lookAt;
        const resolved = hydrated as any;
        const referenceId = resolveLookAtReferenceId(resolved);
        point = referenceId
          ? runtime.resolvePoint(referenceId)
          : parseSceneTarget(hydrated, { id: runtime.scene.id, type: 'Scene' }).point;
      }
      target.position.copy(point ? new Vector3(...point) : fallback);
      target.updateMatrixWorld();
    };
    orient();
    queueMicrotask(orient);
    return () => {
      mounted = false;
      sceneGraph.remove(target);
    };
  }, [boundsVersion, props.matrix, resource.lookAt, runtime, sceneGraph, target]);
  const debug = runtime.debugLights ? <LightDebug type={String(resource.type)} color={color} /> : null;
  const editor =
    runtime.editing.enabled && runtime.editing.showLightHelpers ? (
      <LightEditorHelper type={String(resource.type)} color={color} light={light} target={target} />
    ) : null;
  if (resource.type === 'AmbientLight')
    return (
      <>
        <ambientLight color={color} intensity={intensity} />
        {debug}
        {editor}
      </>
    );
  if (resource.type === 'DirectionalLight')
    return (
      <>
        <directionalLight ref={light} color={color} intensity={intensity} />
        {debug}
        {editor}
      </>
    );
  if (resource.type === 'PointLight')
    return (
      <>
        <pointLight color={color} intensity={intensity} />
        {debug}
        {editor}
      </>
    );
  if (resource.type === 'SpotLight')
    return (
      <>
        <spotLight
          ref={light}
          color={color}
          intensity={intensity}
          angle={(quantity(resource.angle, 45) * Math.PI) / 180}
        />
        {debug}
        {editor}
      </>
    );
  if (resource.type === 'ImageBasedLight' && props.environmentAllowed) {
    const map = resource.environmentMap as any;
    const url = typeof map === 'string' ? map : map?.id;
    return (
      <>
        {url ? <Environment files={url} environmentIntensity={intensity} background={false} /> : null}
        {debug}
        {editor}
      </>
    );
  }
  return (
    <>
      {debug}
      {editor}
    </>
  );
}

function LightEditorHelper({
  type,
  color,
  light,
  target,
}: {
  type: string;
  color: string;
  light: React.RefObject<any>;
  target: Object3D;
}) {
  const directional = type === 'DirectionalLight' || type === 'SpotLight';
  const root = useRef<Group>(null);
  const arrow = useMemo(
    () =>
      directional
        ? new ArrowHelper(new Vector3(0, -1, 0), new Vector3(), 0.9, new Color(color).getHex(), 0.14, 0.08)
        : null,
    [color, directional]
  );
  useFrame(() => {
    if (!arrow || !root.current) return;
    const origin = root.current.getWorldPosition(new Vector3());
    const destination = (light.current?.target || target).getWorldPosition(new Vector3());
    const inverse = root.current.getWorldQuaternion(new Quaternion()).invert();
    const direction = destination.sub(origin).normalize().applyQuaternion(inverse);
    if (direction.lengthSq()) arrow.setDirection(direction);
  });
  useEffect(() => () => arrow?.dispose(), [arrow]);
  return (
    <group ref={root} userData={{ rivSceneEditorHelper: true }}>
      <mesh renderOrder={1000}>
        <sphereGeometry args={[0.085, 12, 12]} />
        <meshBasicMaterial color={color} depthTest={false} />
      </mesh>
      {arrow ? <primitive object={arrow} /> : null}
      {type === 'SpotLight' ? (
        <mesh position={[0, -0.3, 0]} rotation={[0, 0, Math.PI]}>
          <coneGeometry args={[0.24, 0.6, 16, 1, true]} />
          <meshBasicMaterial color={color} wireframe depthTest={false} />
        </mesh>
      ) : null}
    </group>
  );
}

export function resolveLookAtReferenceId(value: any): string | undefined {
  if (typeof value === 'string') return value;
  return value && value.type !== 'SpecificResource' && typeof value.id === 'string' ? value.id : undefined;
}

function LightDebug({ type, color }: { type: string; color: string }) {
  const directional = type === 'DirectionalLight' || type === 'SpotLight';
  const labelY = type === 'AmbientLight' ? 0.28 : type === 'ImageBasedLight' ? 0.14 : 0.11;
  const arrow = useMemo(
    () =>
      directional
        ? new ArrowHelper(new Vector3(0, -1, 0), new Vector3(), 0.75, new Color(color).getHex(), 0.14, 0.08)
        : null,
    [color, directional]
  );
  useEffect(() => () => arrow?.dispose(), [arrow]);
  return (
    <group userData={{ rivSceneLightDebug: type }}>
      <mesh renderOrder={1000}>
        <sphereGeometry args={[0.075, 12, 12]} />
        <meshBasicMaterial color={color} depthTest={false} />
      </mesh>
      {arrow ? <primitive object={arrow} /> : null}
      <Html position={[0.11, labelY, 0]} center={false} zIndexRange={[100, 0]}>
        <span className="riv-scene-light-debug">{type.replace(/Light$/, ' light')}</span>
      </Html>
    </group>
  );
}

function resolveAudioSource(resource: Record<string, unknown>, vault: any): string | null {
  let source: any = resource.source;
  if (source?.type === 'SpecificResource') source = source.source;
  const hydrated = vault.get(source, { skipSelfReturn: false, preserveSpecificResources: true }) || source;
  if (typeof hydrated === 'string') return hydrated;
  if (hydrated?.type === 'Audio' || hydrated?.type === 'Sound') return hydrated.id;
  if (hydrated?.type === 'Timeline') {
    for (const page of vault.get(hydrated.items, { parent: hydrated }) || []) {
      for (const annotation of vault.get(page.items, { parent: page }) || []) {
        const body = vault.get(annotation.body, { parent: annotation, skipSelfReturn: false });
        if (body?.type === 'Audio' || body?.type === 'Sound') return body.id;
      }
    }
  }
  return hydrated?.id || null;
}

function AudioResource({ resource, state, clock, target, annotation }: SceneResourceRendererProps) {
  const runtime = useSceneRuntime();
  const listener = useContext(AudioListenerContext)!;
  const locked = useSceneStore((value) => value.audioLocked);
  const muted = useSceneStore((value) => value.muted);
  const globalVolume = useSceneStore((value) => value.volume);
  const boundsVersion = useContext(ResourceBoundsContext)?.version;
  const url = resolveAudioSource(resource, runtime.vault);
  const buffer = useLoader(
    AudioLoader,
    url || 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA='
  );
  const sound = useMemo(
    () => (resource.type === 'AmbientAudio' ? new ThreeAudio(listener) : new PositionalAudio(listener)),
    [listener, resource.type]
  );
  const timeMode = String((annotation as any).timeMode || 'trim');
  const sync = useRef<{ contextTime: number; sceneTime: number } | null>(null);
  useLayoutEffect(() => {
    if (resource.type !== 'SpotAudio') return;
    let active = true;
    const orient = () => {
      if (!active) return;
      const lookAt = resource.lookAt as any;
      if (!lookAt) {
        // PositionalAudio emits along +Z; IIIF spot audio defaults to -Y.
        sound.rotation.set(Math.PI / 2, 0, 0);
        return;
      }
      const hydrated = runtime.vault.get(lookAt, { skipSelfReturn: false, preserveSpecificResources: true }) || lookAt;
      const referenceId = resolveLookAtReferenceId(hydrated);
      const point = referenceId
        ? runtime.resolvePoint(referenceId)
        : parseSceneTarget(hydrated, { id: runtime.scene.id, type: 'Scene' }).point;
      if (point) sound.lookAt(...point);
    };
    orient();
    queueMicrotask(orient);
    return () => {
      active = false;
    };
  }, [boundsVersion, resource.lookAt, resource.type, runtime, sound]);
  useEffect(() => {
    sound.setBuffer(buffer);
    sound.setVolume(muted ? 0 : quantity(resource.volume) * globalVolume);
    sound.setPlaybackRate(getMediaPlaybackRate(clock.playbackRate, target.temporal, buffer.duration, timeMode));
    sound.setLoop(timeMode === 'loop');
    if (sound instanceof PositionalAudio && resource.type === 'SpotAudio') {
      const cone = quantity(resource.angle, 45) * 2;
      sound.setDirectionalCone(cone, cone, 0);
    }
  }, [buffer, clock.playbackRate, globalVolume, muted, resource, sound, target.temporal, timeMode]);
  useEffect(() => {
    if (locked || !state.visible || (!state.playing && !clock.playing)) {
      if (sound.isPlaying) sound.stop();
      sync.current = null;
      return;
    }
    let active = true;
    sync.current = { contextTime: listener.context.currentTime, sceneTime: clock.time };
    listener.context
      .resume()
      .then(() => {
        if (!active) return;
        sound.offset = getLocalMediaTime(clock.time, target.temporal, buffer.duration, timeMode);
        if (!sound.isPlaying) sound.play();
      })
      .catch((cause) => {
        if (active)
          runtime.diagnostic({
            code: 'audio-play-failed',
            severity: 'warning',
            message: 'Audio playback was blocked.',
            resourceId: resource.id,
            cause,
          });
      });
    return () => {
      active = false;
    };
  }, [buffer, clock.playing, locked, sound, state.playing, state.visible, target.temporal, timeMode]);
  useEffect(() => {
    if (!sound.isPlaying || !sync.current) return;
    const contextTime = listener.context.currentTime;
    const elapsed = (contextTime - sync.current.contextTime) * clock.playbackRate;
    const jumped = Math.abs(clock.time - sync.current.sceneTime - elapsed) > 0.25;
    sync.current = { contextTime, sceneTime: clock.time };
    if (!jumped) return;
    sound.stop();
    sound.offset = getLocalMediaTime(clock.time, target.temporal, buffer.duration, timeMode);
    sound.play();
  }, [buffer.duration, clock.playbackRate, clock.time, listener.context, sound, target.temporal, timeMode]);
  useEffect(
    () => () => {
      if (sound.isPlaying) sound.stop();
      sound.disconnect();
    },
    [sound]
  );
  return <primitive object={sound} />;
}

function FreeViewCamera({ active }: { active: boolean }) {
  const projection = useSceneStore((state) => state.freeProjection);
  const aspect = useThree((state) => (state.size.height ? state.size.width / state.size.height : 1));
  return (
    <>
      <PerspectiveCamera
        makeDefault={active && projection === 'perspective'}
        userData={{ rivSceneFreeView: true }}
        position={[0, 0, 5]}
        near={0.1}
        far={2000}
        fov={50}
      />
      <OrthographicCamera
        makeDefault={active && projection === 'orthographic'}
        userData={{ rivSceneFreeView: true, rivViewHeight: 2 }}
        position={[0, 0, 5]}
        near={0.1}
        far={2000}
        top={1}
        bottom={-1}
        left={-aspect}
        right={aspect}
      />
    </>
  );
}

function DefaultLights() {
  return (
    <>
      <ambientLight intensity={0.6} color="#ffffff" />
      <directionalLight intensity={1} color="#ffffff" position={[3, 4, 5]} />
    </>
  );
}

function CameraInteraction() {
  const runtime = useSceneRuntime();
  const cameraZoom = runtime.cameraZoom;
  const acquireContinuousFrames = useContext(ContinuousFramesContext);
  const camera = useThree((state) => state.camera);
  const flyElement = useThree((state) => state.events.connected || state.gl.domElement) as HTMLElement;
  const invalidate = useThree((state) => state.invalidate);
  const freeView = useSceneStore((state) => runtime.editing.enabled || state.freeViewActive);
  const active = useSceneStore((state) => (state.activeCamera ? state.resources[state.activeCamera] : null));
  const resetVersion = useSceneStore((state) => state.viewResetVersion);
  const transforming = useSceneStore((state) => state.transforming);
  const controls = useRef<any>(null);
  useEffect(() => controls.current?.reset?.(), [resetVersion]);
  useEffect(() => {
    setControlsTransforming(controls.current, transforming);
  }, [transforming]);
  const mode = resolveCameraInteractionMode(runtime.cameraControls.mode, freeView, active?.interactionMode || []);
  useLayoutEffect(() => {
    if (cameraInteractionNeedsContinuousFrames(mode) && !transforming) return acquireContinuousFrames();
  }, [acquireContinuousFrames, mode, transforming]);
  useEffect(() => {
    if (mode !== 'fly' || transforming || !flyElement) return;
    let previous: [number, number] | null = null;
    const down = (event: PointerEvent) => {
      if (event.button === 0) previous = [event.clientX, event.clientY];
    };
    const move = (event: PointerEvent) => {
      if (!previous) {
        if (!runtime.cameraControls.dragToLook) previous = [event.clientX, event.clientY];
        return;
      }
      const deltaX = event.clientX - previous[0];
      const deltaY = event.clientY - previous[1];
      previous = [event.clientX, event.clientY];
      applyFlyLookDelta(
        camera,
        deltaX,
        deltaY,
        flyLookSpeed(runtime.cameraControls.lookSpeed, runtime.cameraControls.invertLook)
      );
      invalidate();
    };
    const up = () => {
      previous = null;
    };
    const moveTarget = runtime.cameraControls.dragToLook ? flyElement.ownerDocument : flyElement;
    flyElement.addEventListener('pointerdown', down);
    moveTarget.addEventListener('pointermove', move as EventListener);
    moveTarget.addEventListener('pointerup', up);
    moveTarget.addEventListener('pointercancel', up);
    if (!runtime.cameraControls.dragToLook) flyElement.addEventListener('pointerleave', up);
    return () => {
      flyElement.removeEventListener('pointerdown', down);
      moveTarget.removeEventListener('pointermove', move as EventListener);
      moveTarget.removeEventListener('pointerup', up);
      moveTarget.removeEventListener('pointercancel', up);
      flyElement.removeEventListener('pointerleave', up);
    };
  }, [camera, flyElement, invalidate, mode, runtime.cameraControls, transforming]);
  if (!freeView && active?.disabled) return null;
  if (mode === 'locked') return null;
  if (mode === 'fly' && transforming) return null;
  if (mode === 'fly')
    return (
      <FlyControls
        ref={controls}
        makeDefault
        movementSpeed={runtime.cameraControls.movementSpeed}
        rollSpeed={0}
        dragToLook={runtime.cameraControls.dragToLook}
        autoForward={runtime.cameraControls.autoForward}
      />
    );
  if (mode === 'free') return <FirstPersonControls ref={controls} makeDefault enabled={!transforming} />;
  if (mode === 'free-direction') return <PointerLockControls ref={controls} enabled={!transforming} />;
  return (
    <AtlasOrbitControls
      ref={controls}
      makeDefault
      cameraZoom={cameraZoom}
      minPolarAngle={mode === 'hemisphere-orbit' ? 0 : undefined}
      maxPolarAngle={mode === 'hemisphere-orbit' ? Math.PI / 2 : undefined}
    />
  );
}

export function flyLookSpeed(speed: number, inverted: boolean) {
  return inverted ? speed : -speed;
}

export function applyFlyLookDelta(camera: { quaternion: Quaternion }, x: number, y: number, speed: number) {
  const rotation = new Euler().setFromQuaternion(camera.quaternion, 'YXZ');
  const verticalLimit = Math.PI / 2 - 0.001;
  rotation.y += x * speed;
  rotation.x = Math.max(-verticalLimit, Math.min(verticalLimit, rotation.x + y * speed));
  camera.quaternion.setFromEuler(rotation);
}

export function cameraInteractionNeedsContinuousFrames(mode: string) {
  return mode === 'fly' || mode === 'free';
}

export function resolveCameraInteractionMode(
  override: 'manifest' | 'orbit' | 'fly',
  freeView: boolean,
  authoredModes: readonly string[]
) {
  if (override === 'fly') return 'fly';
  if (override === 'orbit' || freeView) return 'orbit';
  return (
    authoredModes.find((value) => ['locked', 'orbit', 'hemisphere-orbit', 'free', 'free-direction'].includes(value)) ||
    'orbit'
  );
}

export function shouldUseFreeViewCamera(
  hasAuthoredCamera: boolean,
  editing: boolean,
  freeViewActive: boolean,
  override: 'manifest' | 'orbit' | 'fly'
) {
  return editing || !hasAuthoredCamera || freeViewActive || override !== 'manifest';
}

function SceneViewBridge() {
  const runtime = useSceneRuntime();
  const camera = useThree((state) => state.camera) as any;
  const controls = useThree((state) => state.controls) as any;
  const invalidate = useThree((state) => state.invalidate);
  const projection = useSceneStore((state) => state.freeProjection);
  const pendingView = useRef<{ view: SceneView; transition: boolean } | null>(null);
  const pendingFrame = useRef<{ bounds: SceneBounds; padding: number } | null>(null);
  const transition = useRef<{
    elapsed: number;
    duration: number;
    fromPosition: Vector3;
    toPosition: Vector3;
    fromQuaternion: Quaternion;
    toQuaternion: Quaternion;
    fromTarget: Vector3;
    toTarget: Vector3;
  } | null>(null);

  const setView = useCallback(
    (view: SceneView, options?: { transition?: boolean }) => {
      runtime.store.setState({ freeViewActive: true, freeProjection: view.projection });
      if (
        (view.projection === 'perspective' && !(camera as any).isPerspectiveCamera) ||
        (view.projection === 'orthographic' && !(camera as any).isOrthographicCamera) ||
        !camera.userData.rivSceneFreeView
      ) {
        pendingView.current = { view, transition: options?.transition === true };
        return;
      }
      if (options?.transition) {
        const target = new Vector3(...view.target);
        transition.current = {
          elapsed: 0,
          duration: runtime.transitionDuration || 0.6,
          fromPosition: camera.position.clone(),
          toPosition: new Vector3(...view.position),
          fromQuaternion: camera.quaternion.clone(),
          toQuaternion: new Quaternion().setFromEuler(
            new Euler(...(view.rotation.map(degreesToRadians) as [number, number, number]), 'ZYX')
          ),
          fromTarget: controls?.target?.clone?.() || cameraOrbitTarget(camera),
          toTarget: target,
        };
        applySceneView(camera, controls, {
          ...view,
          position: camera.position.toArray(),
          rotation: captureRotation(camera),
        });
        invalidate();
      } else {
        transition.current = null;
        applySceneView(camera, controls, view);
        invalidate();
      }
    },
    [camera, controls, invalidate, runtime]
  );
  const frame = useCallback(
    (bounds: SceneBounds, options?: { padding?: number }) => {
      const padding = Math.max(1, options?.padding ?? 1.25);
      runtime.store.setState({ freeViewActive: true });
      if (!camera.userData.rivSceneFreeView) {
        pendingFrame.current = { bounds, padding };
        return;
      }
      frameCameraToBounds(camera, controls, bounds, padding);
      invalidate();
    },
    [camera, controls, invalidate, runtime.store]
  );

  useLayoutEffect(() => {
    if (pendingView.current && camera.userData.rivSceneFreeView) {
      const pending = pendingView.current;
      pendingView.current = null;
      setView(pending.view, { transition: pending.transition });
    }
    if (pendingFrame.current && camera.userData.rivSceneFreeView) {
      const pending = pendingFrame.current;
      pendingFrame.current = null;
      frameCameraToBounds(camera, controls, pending.bounds, pending.padding);
      invalidate();
    }
  }, [camera, controls, invalidate, projection, setView]);

  useEffect(
    () =>
      runtime.registerViewController({
        getView: () => captureSceneView(camera, controls?.target),
        setView,
        frame,
      }),
    [camera, controls, frame, runtime, setView]
  );

  useFrame((_, delta) => {
    const value = transition.current;
    if (!value) return;
    value.elapsed = Math.min(value.duration, value.elapsed + Math.min(delta, 1 / 30));
    const progress = value.duration ? value.elapsed / value.duration : 1;
    const eased = progress * progress * (3 - 2 * progress);
    camera.position.lerpVectors(value.fromPosition, value.toPosition, eased);
    camera.quaternion.slerpQuaternions(value.fromQuaternion, value.toQuaternion, eased);
    controls?.target?.lerpVectors(value.fromTarget, value.toTarget, eased);
    if (progress === 1) {
      transition.current = null;
      controls?.saveState?.();
    } else invalidate();
  });
  return null;
}

export function captureSceneView(camera: any, target?: Vector3 | readonly [number, number, number]): SceneView {
  const resolvedTarget = target
    ? target instanceof Vector3
      ? target
      : new Vector3(...target)
    : cameraOrbitTarget(camera);
  const view: SceneView = {
    projection: camera.isOrthographicCamera ? 'orthographic' : 'perspective',
    position: camera.getWorldPosition(new Vector3()).toArray(),
    rotation: captureRotation(camera),
    target: resolvedTarget.toArray(),
    near: Number(camera.near),
    far: Number(camera.far),
  };
  if (camera.isOrthographicCamera)
    view.viewHeight = Number(camera.userData.rivViewHeight || (camera.top - camera.bottom) / camera.zoom);
  else view.fieldOfView = Number(camera.fov);
  return view;
}

function captureRotation(camera: any): [number, number, number] {
  const rotation = new Euler().setFromQuaternion(camera.getWorldQuaternion(new Quaternion()), 'ZYX');
  return [rotation.x, rotation.y, rotation.z].map(radiansToDegrees) as [number, number, number];
}

export function applySceneView(camera: any, controls: any, view: SceneView) {
  camera.position.fromArray(view.position);
  camera.rotation.set(...(view.rotation.map(degreesToRadians) as [number, number, number]), 'ZYX');
  camera.near = Math.max(0.0001, view.near);
  camera.far = Math.max(camera.near + 0.0001, view.far);
  if (camera.isPerspectiveCamera && view.fieldOfView !== undefined) camera.fov = view.fieldOfView;
  if (camera.isOrthographicCamera && view.viewHeight !== undefined) {
    const aspect = Math.abs((camera.right - camera.left) / (camera.top - camera.bottom)) || 1;
    camera.top = view.viewHeight / 2;
    camera.bottom = -view.viewHeight / 2;
    camera.left = (-view.viewHeight * aspect) / 2;
    camera.right = (view.viewHeight * aspect) / 2;
    camera.zoom = 1;
    camera.userData.rivViewHeight = view.viewHeight;
  }
  controls?.target?.fromArray(view.target);
  controls?.saveState?.();
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
}

export function frameCameraToBounds(camera: any, controls: any, bounds: SceneBounds, padding = 1.25) {
  const center = new Vector3(...bounds.center);
  const size = new Vector3().subVectors(new Vector3(...bounds.max), new Vector3(...bounds.min));
  const aspect = camera.isPerspectiveCamera
    ? Number(camera.aspect || 1)
    : Math.abs((camera.right - camera.left) / (camera.top - camera.bottom)) || 1;
  const oldTarget = controls?.target || cameraOrbitTarget(camera);
  const direction = camera.position.clone().sub(oldTarget).normalize();
  if (!direction.lengthSq()) direction.set(0, 0, 1);
  if (camera.isOrthographicCamera) {
    const height = Math.max(size.y, size.x / aspect, 0.001) * padding;
    const distance = Math.max(camera.position.distanceTo(oldTarget), size.length(), 1);
    camera.position.copy(center).addScaledVector(direction, distance);
    camera.top = height / 2;
    camera.bottom = -height / 2;
    camera.left = (-height * aspect) / 2;
    camera.right = (height * aspect) / 2;
    camera.zoom = 1;
    camera.userData.rivViewHeight = height;
  } else {
    const vertical = Math.max(degreesToRadians(Number(camera.fov || 50)), 0.001);
    const distance =
      padding * Math.max(size.y / (2 * Math.tan(vertical / 2)), size.x / (2 * Math.tan(vertical / 2) * aspect), 0.5);
    camera.position.copy(center).addScaledVector(direction, distance);
    camera.near = Math.max(distance / 100, 0.001);
    camera.far = Math.max(distance * 100, 100);
  }
  camera.lookAt(center);
  controls?.target?.copy(center);
  controls?.saveState?.();
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
}

export function syncOrbitTargetToBounds(camera: any, controls: any, bounds: SceneBounds) {
  if (!controls?.target) return;
  const center = new Vector3(...bounds.center);
  const extent = new Vector3().subVectors(new Vector3(...bounds.max), new Vector3(...bounds.min)).length();
  controls.target.copy(center);
  controls.maxDistance = Math.max(camera.position.distanceTo(center), extent, 0.001) * 10;
  controls.saveState?.();
}

function CameraTransition() {
  const duration = useSceneRuntime().transitionDuration;
  const activePath = useSceneStore((state) => state.activeCamera);
  const camera = useThree((state) => state.camera) as any;
  const controls = useThree((state) => state.controls) as any;
  const invalidate = useThree((state) => state.invalidate);
  const previousCamera = useRef<any>(camera);
  const previousPath = useRef<string | null>(activePath);
  const previousTarget = useRef(new Vector3());
  const transition = useRef<null | {
    elapsed: number;
    fromPosition: Vector3;
    toPosition: Vector3;
    fromQuaternion: Quaternion;
    toQuaternion: Quaternion;
    fromTarget: Vector3;
    toTarget: Vector3;
    fromZoom: number;
    toZoom: number;
  }>(null);

  useLayoutEffect(() => {
    if (previousCamera.current === camera) return;
    const shouldAnimate = duration > 0 && !!previousPath.current && !!activePath && previousPath.current !== activePath;
    if (shouldAnimate) {
      const fromPosition = previousCamera.current.getWorldPosition(new Vector3());
      const fromQuaternion = previousCamera.current.getWorldQuaternion(new Quaternion());
      const toPosition = camera.position.clone();
      const toQuaternion = camera.quaternion.clone();
      const toTarget = cameraOrbitTarget(camera);
      camera.position.copy(fromPosition);
      camera.quaternion.copy(fromQuaternion);
      transition.current = {
        elapsed: 0,
        fromPosition,
        toPosition,
        fromQuaternion,
        toQuaternion,
        fromTarget: previousTarget.current.clone(),
        toTarget,
        fromZoom: Number(previousCamera.current.zoom || 1),
        toZoom: Number(camera.zoom || 1),
      };
      controls?.target?.copy(previousTarget.current);
      invalidate();
    }
    previousCamera.current = camera;
    previousPath.current = activePath;
    if (!transition.current && controls?.target) previousTarget.current.copy(controls.target);
  }, [activePath, camera, controls, duration, invalidate]);

  useFrame((_, delta) => {
    const value = transition.current;
    if (!value) {
      // Controls mutate their target outside React. Retain the last viewed
      // point so a later authored-camera transition starts without a jump.
      if (controls?.target) previousTarget.current.copy(controls.target);
      return;
    }
    // A demand-rendered canvas may report the whole idle period as its first
    // delta. Clamp it so a transition requested after idling is still visible.
    value.elapsed = Math.min(duration, value.elapsed + Math.min(delta, 1 / 30));
    const progress = duration ? value.elapsed / duration : 1;
    const eased = progress * progress * (3 - 2 * progress);
    camera.position.lerpVectors(value.fromPosition, value.toPosition, eased);
    camera.quaternion.slerpQuaternions(value.fromQuaternion, value.toQuaternion, eased);
    camera.zoom = value.fromZoom + (value.toZoom - value.fromZoom) * eased;
    camera.updateProjectionMatrix?.();
    if (controls?.target) controls.target.lerpVectors(value.fromTarget, value.toTarget, eased);
    if (progress === 1) {
      previousTarget.current.copy(value.toTarget);
      transition.current = null;
      controls?.saveState?.();
    } else invalidate();
  });
  return null;
}

function CameraPresenceCue({ enabled }: { enabled: boolean }) {
  const ready = useSceneStore((state) => state.resourcesReady);
  const camera = useThree((state) => state.camera);
  const controls = useThree((state) => state.controls) as any;
  const invalidate = useThree((state) => state.invalidate);
  const animation = useRef<null | { elapsed: number; position: Vector3; target: Vector3; right: Vector3 }>(null);
  const played = useRef(false);
  useEffect(() => {
    if (!enabled || !ready || played.current) return;
    played.current = true;
    const target =
      controls?.target?.clone?.() || new Vector3(0, 0, -1).applyQuaternion(camera.quaternion).add(camera.position);
    animation.current = {
      elapsed: -0.12,
      position: camera.position.clone(),
      target,
      right: new Vector3(1, 0, 0).applyQuaternion(camera.quaternion),
    };
    invalidate();
  }, [camera, controls, enabled, invalidate, ready]);
  useFrame((_, delta) => {
    const value = animation.current;
    if (!value) return;
    value.elapsed += Math.min(delta, 1 / 30);
    if (value.elapsed < 0) {
      invalidate();
      return;
    }
    const progress = Math.min(1, value.elapsed / 1.05);
    const distance = value.position.distanceTo(value.target);
    const arc = Math.sin(progress * Math.PI);
    camera.position
      .copy(value.position)
      .addScaledVector(value.right, arc * distance * 0.06)
      .lerp(value.target, arc * 0.018);
    camera.lookAt(value.target);
    if (progress === 1) {
      camera.position.copy(value.position);
      camera.lookAt(value.target);
      controls?.saveState?.();
      animation.current = null;
    } else invalidate();
  });
  return null;
}

function UnsupportedResource() {
  return (
    <mesh>
      <boxGeometry args={[0.25, 0.25, 0.25]} />
      <meshBasicMaterial color="#ff4d4f" wireframe />
    </mesh>
  );
}
