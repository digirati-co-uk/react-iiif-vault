import type { ScenePaintable } from '@iiif/helpers/scenes';
import { Splat, useAnimations, useGLTF } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import React, { useCallback, useContext, useEffect, useLayoutEffect, useMemo } from 'react';
import { Box3, type Object3D, Vector3 } from 'three';
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { useSceneRuntime } from './context';
import { ContinuousFramesContext } from './render-context';
import { getLocalMediaTime } from './timing';
import type { SceneResourceRendererProps, SceneResourceState } from './types';
import { applyModelTransformToCenter, syncAnimationPlayback } from './rendering-helpers';
import { UnsupportedResource } from './rendering-primitives';
import { ProtectedModelContext } from './model-auth';
import { useModelHighlight } from './use-model-highlight';

const failedModelLoads = new Set<string>();

// Suspended components never commit effects, so rejected loader entries must
// be evicted by the owning resource boundary after it commits its error state.
export function clearFailedModelLoad(id: string) {
  if (!failedModelLoads.delete(id)) return;
  useGLTF.clear(id);
}

export function useModelGLTF(id: string, extendLoader?: (loader: any) => void): ReturnType<typeof useGLTF<string>> {
  try {
    const result = useGLTF(id, true, true, extendLoader);
    failedModelLoads.delete(id);
    return result;
  } catch (cause) {
    if (!cause || typeof (cause as Promise<unknown>).then !== 'function') failedModelLoads.add(id);
    throw cause;
  }
}

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

function removeExcludedModelObjects(object: Object3D, exclude: readonly string[]) {
  if (!exclude.length) return;
  const excluded = new Set(exclude);
  const remove: Object3D[] = [];
  object.traverse((child) => {
    const feature = child as Object3D & { isCamera?: boolean; isLight?: boolean };
    if (
      (excluded.has('cameras') && feature.isCamera) ||
      (excluded.has('lights') && feature.isLight) ||
      (excluded.has('audio') && (child.type === 'Audio' || child.type === 'PositionalAudio'))
    )
      remove.push(child);
  });
  for (const child of remove) child.removeFromParent();
}

type ModelProps = SceneResourceRendererProps & {
  paintable: ScenePaintable;
  setBounds(point: readonly [number, number, number]): void;
  highlight: false | string;
};

export function ModelResource(props: ModelProps) {
  const protectedModel = useContext(ProtectedModelContext);
  return protectedModel ? <LoadedModelResource {...props} gltf={protectedModel} /> : <PublicModelResource {...props} />;
}

function PublicModelResource(props: ModelProps) {
  const { resource } = props;
  const gl = useThree((value) => value.gl);
  const ktx2TranscoderPath = useSceneRuntime().ktx2TranscoderPath;
  const ktx = useMemo(
    () => new KTX2Loader().setTranscoderPath(ktx2TranscoderPath).detectSupport(gl),
    [gl, ktx2TranscoderPath]
  );
  const extendLoader = useCallback((loader: any) => loader.setKTX2Loader(ktx), [ktx]);
  const gltf = useModelGLTF(resource.id, extendLoader);
  useEffect(() => () => ktx.dispose(), [ktx]);
  return <LoadedModelResource {...props} gltf={gltf} />;
}

function LoadedModelResource({
  resource,
  paintable,
  state,
  clock,
  target,
  matrix,
  setBounds,
  highlight,
  gltf,
}: ModelProps & {
  gltf: Pick<GLTF, 'scene' | 'animations'>;
}) {
  const model = useMemo(() => {
    const object = clone(gltf.scene);
    removeExcludedModelObjects(object, paintable.exclude);
    // Measure while detached. Once mounted, setFromObject includes the
    // ResourceTransform parent and applying the IIIF matrix again doubles it.
    object.updateWorldMatrix(true, true);
    const box = new Box3().setFromObject(object);
    return {
      object,
      center: box.isEmpty() ? null : (box.getCenter(new Vector3()).toArray() as [number, number, number]),
    };
  }, [gltf.scene, paintable.exclude]);
  const object = model.object;
  useModelHighlight(object, highlight);
  const animation = paintable.bodySelector?.find((selector: any) => selector.type === 'AnimationSelector') as
    | { value?: string }
    | undefined;
  const { actions } = useAnimations(paintable.exclude.includes('animations') ? [] : gltf.animations, object);
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
  return <primitive object={object} />;
}
