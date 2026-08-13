import { createSceneTransformMatrix, type ScenePaintable } from '@iiif/helpers/scenes';
import type { SceneNormalized } from '@iiif/parser/presentation-4-normalized/types';
import type { ThreeEvent } from '@react-three/fiber';
import React, { useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Object3D } from 'three';
import { useSceneRuntime, useSceneStore } from './context';
import { ResourceBoundsContext, SceneRenderContext } from './render-context';
import type { SceneResourceRendererProps, SceneResourceState } from './types';
import { CanvasResource } from './canvas-rendering';
import {
  ResourceTransform,
  ResourceVisibility,
  sceneBoundsFromObject,
  UnsupportedResource,
} from './rendering-primitives';
import { GaussianSplatResource, isGaussianSplat, isGltf, ModelResource, UnsupportedModel } from './rendering-model';
import { CameraResource } from './rendering-camera';
import { captureSceneView } from './rendering-camera-rig';
import { AudioResource, LightResource } from './rendering-media';
import { isTemporallyVisible } from './timing';

const ACTIONS = ['show', 'hide', 'enable', 'disable', 'start', 'stop', 'reset', 'select'];
const SELECTION_CLICK_DISTANCE = 3;
const SELECTION_CLICK_DURATION = 500;

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

export function PaintedResource({
  paintable,
  path,
  instancePath,
  ancestors,
  environmentAllowed,
  parentHasEnvironment,
}: {
  paintable: ScenePaintable;
  path: string;
  instancePath: string;
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
  const authoredMatrix = useMemo(
    () =>
      createSceneTransformMatrix(
        transformOverride ? [...paintable.bodyTransform, ...transformOverride] : paintable.bodyTransform,
        paintable.target.point || [0, 0, 0]
      ),
    [paintable.bodyTransform, paintable.target.point, transformOverride]
  );
  const matrix = authoredMatrix;
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
      : runtime.activateMany([paintable.annotationId, paintable.resource.id], instancePath);
  const register = useCallback(
    (registration: Parameters<typeof runtime.register>[0]) =>
      runtime.register({
        ...registration,
        annotationId: registration.annotationId || paintable.annotationId,
        resourceId: registration.resourceId || paintable.resource.id,
        resourceType: registration.resourceType || paintable.rawType,
        instancePath: registration.instancePath || instancePath,
      }),
    [instancePath, paintable.annotationId, paintable.rawType, paintable.resource.id, runtime.register]
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
    setStatus: (status, details) =>
      runtime.setResourceStatus(path, {
        annotationId: paintable.annotationId,
        resourceId: paintable.resource.id,
        resourceType: paintable.rawType,
        status,
        ...details,
      }),
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
  const pointerDown = useRef<ScenePointerSample | null>(null);
  const [hovered, setHovered] = useState(false);
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
  const refreshBounds = useCallback(() => {
    runtime.refreshResourceBounds(path);
    notifyBoundsChanged?.();
  }, [notifyBoundsChanged, path, runtime]);
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
        getView: type.endsWith('camera')
          ? () =>
              object.current ? captureSceneView(object.current, object.current.userData.rivLookAt || undefined) : null
          : undefined,
        annotationId: annotation.id,
        resourceId: resource.id,
        resourceType: String(resource.type || paintable.rawType),
        frameable: ['model', 'scene', 'canvas'].includes(type),
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
  const decorate = runtime.resourceDecorator
    ? (current: Object3D) =>
        runtime.resourceDecorator?.({
          annotation,
          resource,
          target,
          path,
          type,
          object: current,
          selected: state.selected,
          select: () => runtime.selectAnnotation({ id: annotation.id, path }),
          refreshBounds,
        })
    : undefined;

  const pointer = state.disabled
    ? {}
    : {
        onPointerDown: (event: any) => {
          pointerDown.current = scenePointerSample(event);
        },
        onPointerCancel: () => {
          pointerDown.current = null;
        },
        onPointerOver:
          type === 'model' && runtime.hoverHighlightModels
            ? (event: ThreeEvent<PointerEvent>) => {
                event.stopPropagation();
                setHovered(true);
              }
            : undefined,
        onPointerOut: type === 'model' && runtime.hoverHighlightModels ? () => setHovered(false) : undefined,
        onClick: (event: any) => {
          const start = pointerDown.current;
          pointerDown.current = null;
          if (!start || !isSceneSelectionClick(start, scenePointerSample(event))) return;
          event.stopPropagation();
          if (runtime.selectionEnabled) runtime.selectAnnotation({ id: annotation.id, path });
          else activate();
        },
      };

  // Three's camera controls assume that the controlled camera is not under a
  // transformed parent. Bake the IIIF painting matrix onto the camera itself.
  if (type === 'perspective-camera' || type === 'orthographic-camera') {
    return state.visible ? <CameraResource {...props} objectRef={object} decorate={decorate} /> : null;
  }

  let child: React.ReactNode = null;
  if (type === 'model')
    child = isGaussianSplat(resource) ? (
      <GaussianSplatResource resource={resource} />
    ) : isGltf(resource) ? (
      <ModelResource {...props} setBounds={setBounds} highlight={hovered ? runtime.hoverHighlightModels : false} />
    ) : (
      <UnsupportedModel resource={resource} />
    );
  else if (type === 'scene') child = <NestedScene {...props} />;
  else if (type === 'canvas') child = <CanvasResource {...props} />;
  else if (type.endsWith('light')) child = <LightResource {...props} />;
  else if (type.endsWith('audio')) child = <AudioResource {...props} />;
  else child = <UnsupportedResource />;
  return (
    <ResourceTransform matrix={matrix} objectRef={object} path={path} decorate={decorate}>
      <ResourceVisibility visible={state.visible}>
        <group userData={{ iiifIds: [annotation.id, resource.id] }} {...pointer}>
          {child}
        </group>
      </ResourceVisibility>
    </ResourceTransform>
  );
}

function NestedScene(
  props: SceneResourceRendererProps & { ancestors: readonly string[]; parentHasEnvironment: boolean }
) {
  const runtime = useSceneRuntime();
  const scope = useContext(SceneRenderContext);
  const nested = runtime.vault.get<SceneNormalized>(props.resource.id);
  if (!nested) return <UnsupportedResource />;
  if (props.ancestors.includes(nested.id)) {
    return <SceneCycleDiagnostic id={nested.id} />;
  }
  return scope?.renderNestedScene({
    scene: nested,
    ancestors: props.ancestors,
    pathPrefix: props.path,
    parentHasEnvironment: props.parentHasEnvironment,
  });
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

type ScenePointerSample = { x: number; y: number; time: number };

function scenePointerSample(event: any): ScenePointerSample {
  const source = event.nativeEvent || event;
  return {
    x: Number(source.clientX ?? source.offsetX ?? 0),
    y: Number(source.clientY ?? source.offsetY ?? 0),
    time: Number(source.timeStamp ?? 0),
  };
}

export function isSceneSelectionClick(
  start: ScenePointerSample,
  end: ScenePointerSample,
  maxDistance = SELECTION_CLICK_DISTANCE,
  maxDuration = SELECTION_CLICK_DURATION
) {
  const duration = end.time - start.time;
  return duration >= 0 && duration <= maxDuration && Math.hypot(end.x - start.x, end.y - start.y) <= maxDistance;
}
