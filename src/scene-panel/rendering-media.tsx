import { Environment, Html } from '@react-three/drei';
import { parseSceneTarget } from '@iiif/helpers/scenes';
import { useLoader, useThree } from '@react-three/fiber';
import React, { useContext, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import {
  Audio as ThreeAudio,
  AudioLoader,
  ArrowHelper,
  Color,
  Matrix4,
  Object3D,
  PositionalAudio,
  Vector3,
} from 'three';
import { useSceneRuntime, useSceneStore } from './context';
import { AudioListenerContext, ResourceBoundsContext } from './render-context';
import { getLocalMediaTime } from './timing';
import type { SceneResourceRendererProps } from './types';
import { getMediaPlaybackRate } from './canvas-rendering';
import { resolveLookAtReferenceId } from './rendering-camera';
import { quantity } from './rendering-helpers';

export function LightResource(props: SceneResourceRendererProps & { environmentAllowed: boolean }) {
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
  if (resource.type === 'AmbientLight')
    return (
      <>
        <ambientLight color={color} intensity={intensity} />
        {debug}
      </>
    );
  if (resource.type === 'DirectionalLight')
    return (
      <>
        <directionalLight ref={light} color={color} intensity={intensity} />
        {debug}
      </>
    );
  if (resource.type === 'PointLight')
    return (
      <>
        <pointLight color={color} intensity={intensity} />
        {debug}
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
      </>
    );
  if (resource.type === 'ImageBasedLight' && props.environmentAllowed) {
    const map = resource.environmentMap as any;
    const url = typeof map === 'string' ? map : map?.id;
    return (
      <>
        {url ? <Environment files={url} environmentIntensity={intensity} background={false} /> : null}
        {debug}
      </>
    );
  }
  return <>{debug}</>;
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

export function AudioResource({ resource, state, clock, target, annotation }: SceneResourceRendererProps) {
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
