import type { ScenePaintable } from '@iiif/helpers/scenes';
import { Splat, useAnimations, useGLTF } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import React, { useCallback, useContext, useEffect, useLayoutEffect, useMemo } from 'react';
import { Box3, Vector3 } from 'three';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { useSceneRuntime } from './context';
import { ContinuousFramesContext } from './render-context';
import { getLocalMediaTime } from './timing';
import type { SceneResourceRendererProps, SceneResourceState } from './types';
import { applyModelTransformToCenter, syncAnimationPlayback } from './rendering-helpers';
import { UnsupportedResource } from './rendering-primitives';
import { useModelHighlight } from './use-model-highlight';

export function isGltf(resource: Record<string, unknown> & { id: string }) {
  const format = String(resource.format || '').toLowerCase();
  return format === 'model/gltf+json' || format === 'model/gltf-binary' || /\.(gltf|glb)(?:$|[?#])/i.test(resource.id);
}

export function isGaussianSplat(resource: Record<string, unknown> & { id: string }) {
  return /\.splat(?:$|[?#])/i.test(resource.id);
}

export function GaussianSplatResource({ resource }: { resource: Record<string, unknown> & { id: string } }) {
  const acquireContinuousFrames = useContext(ContinuousFramesContext);
  useLayoutEffect(() => acquireContinuousFrames(), [acquireContinuousFrames]);
  return <Splat src={resource.id} />;
}

export function UnsupportedModel({ resource }: { resource: Record<string, unknown> & { id: string } }) {
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

export function ModelResource({
  resource,
  paintable,
  state,
  clock,
  target,
  matrix,
  setBounds,
  highlight,
}: SceneResourceRendererProps & {
  paintable: ScenePaintable;
  setBounds(point: readonly [number, number, number]): void;
  highlight: false | string;
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
  useModelHighlight(object, highlight);
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
