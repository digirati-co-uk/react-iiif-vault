import { createPaintingAnnotationsHelper } from '@iiif/helpers/painting-annotations';
import { expandTarget } from '@iiif/helpers/annotation-targets';
import { Html } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import React, { useEffect, useRef, useState } from 'react';
import {
  DoubleSide,
  Mesh,
  MeshBasicMaterial,
  SRGBColorSpace,
  Texture,
  TextureLoader,
  VideoTexture,
  Vector3,
} from 'three';
import { sanitizeIiifHtml } from './annotation-sanitizers';
import { useSceneRuntime } from './context';
import { getLocalMediaTime, isTemporallyVisible } from './timing';
import type { SceneClockSnapshot, SceneResourceRendererProps } from './types';
import type { ScenePaintable } from '@iiif/helpers/scenes';

export type CanvasRegion = { x: number; y: number; width: number; height: number };
type CanvasPaintable = {
  annotationId: string;
  annotation: { id: string; type: 'Annotation'; timeMode?: string };
  resource: any;
  target: any;
  selector?: unknown;
  rotation?: number;
  translate?: { x?: number; y?: number };
  style?: Record<string, any>;
};

function expandedCanvasTarget(target: unknown) {
  try {
    return expandTarget(target as any, { defaultType: 'Canvas' }) as any;
  } catch {
    // A malformed painting target should only hide/fallback that body, not the
    // rest of the Canvas page.
    return null;
  }
}

function canvasRegion(target: unknown, fallback: CanvasRegion): CanvasRegion {
  const spatial = expandedCanvasTarget(target)?.selector?.spatial;
  if (spatial && [spatial.x, spatial.y, spatial.width, spatial.height].every(Number.isFinite)) {
    return {
      x: Number(spatial.x),
      y: Number(spatial.y),
      width: Number(spatial.width),
      height: Number(spatial.height),
    };
  }
  return fallback;
}

export function isCanvasBodyVisible(target: unknown, time: number) {
  const temporal = expandedCanvasTarget(target)?.selector?.temporal;
  return isTemporallyVisible(time, toSceneInterval(temporal));
}

function toSceneInterval(temporal: any): { start: number; end?: number } | null {
  if (!temporal) return null;
  return {
    start: Number(temporal.startTime || 0),
    ...(temporal.endTime === undefined ? {} : { end: Number(temporal.endTime) }),
  };
}

function imageServiceId(resource: any) {
  const services = Array.isArray(resource.service) ? resource.service : resource.service ? [resource.service] : [];
  const service =
    services.find((item: any) => /ImageService/i.test(String(item?.type || item?.['@type'] || ''))) || services[0];
  const id = typeof service === 'string' ? service : service?.id || service?.['@id'];
  return typeof id === 'string' ? id.replace(/\/info\.json(?:[?#].*)?$/, '').replace(/\/$/, '') : null;
}

export function createCanvasImageRequestUrl(
  service: string | null,
  resource: any,
  crop: CanvasRegion | null,
  width: number
) {
  if (!service) return resource.id;
  const region = crop ? [crop.x, crop.y, crop.width, crop.height].map((value) => Math.round(value)).join(',') : 'full';
  const sourceWidth = Number(crop?.width || resource.width || width);
  const maximum = Number.isFinite(sourceWidth) && sourceWidth > 0 ? sourceWidth : 64;
  const desiredWidth = Number.isFinite(width) && width > 0 ? width : maximum;
  const requested = Math.max(64, Math.min(Math.round(maximum), Math.round(desiredWidth)));
  return `${service}/${region}/${requested},/0/default.jpg`;
}

export function canvasTextureTransform(
  crop: CanvasRegion | null,
  sourceWidth: number,
  sourceHeight: number
): { offset: [number, number]; repeat: [number, number] } | null {
  if (!crop || sourceWidth <= 0 || sourceHeight <= 0) return null;
  return {
    offset: [crop.x / sourceWidth, 1 - (crop.y + crop.height) / sourceHeight],
    repeat: [crop.width / sourceWidth, crop.height / sourceHeight],
  };
}

export function CanvasResource({
  resource,
  clock,
  paintable,
}: SceneResourceRendererProps & { paintable: ScenePaintable }) {
  const runtime = useSceneRuntime();
  const canvas = runtime.vault.get<any>(resource.id);
  const width = Number(canvas?.width || resource.width || 1);
  const height = Number(canvas?.height || resource.height || 1);
  const paintables = canvas ? createPaintingAnnotationsHelper(runtime.vault).getPaintables(canvas).items : [];
  return (
    <group position={[width / 2, -height / 2, 0]}>
      <mesh>
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial
          color={canvas?.backgroundColor || '#ffffff'}
          side={DoubleSide}
          polygonOffset
          polygonOffsetFactor={2}
          polygonOffsetUnits={2}
        />
      </mesh>
      {paintables.map((item: any, index: number) => (
        <CanvasBody
          key={`${item.annotationId}-${index}`}
          item={item}
          width={width}
          height={height}
          z={(index + 1) * 0.001}
          clock={clock}
          fallbackTimeMode={paintable.timeMode}
        />
      ))}
    </group>
  );
}

function CanvasBody({
  item,
  width,
  height,
  z,
  clock,
  fallbackTimeMode,
}: {
  item: CanvasPaintable;
  width: number;
  height: number;
  z: number;
  clock: SceneClockSnapshot;
  fallbackTimeMode: string;
}) {
  const runtime = useSceneRuntime();
  const resource = item.resource;
  const hydratedTarget =
    runtime.vault.get<any>(item.target, {
      parent: item.annotation,
      skipSelfReturn: false,
      preserveSpecificResources: true,
    }) || item.target;
  const temporal = toSceneInterval(expandedCanvasTarget(hydratedTarget)?.selector?.temporal);
  if (!isTemporallyVisible(clock.time, temporal)) return null;

  const target = canvasRegion(hydratedTarget, { x: 0, y: 0, width, height });
  const source = item.selector
    ? canvasRegion(
        { type: 'SpecificResource', source: resource, selector: item.selector },
        {
          x: 0,
          y: 0,
          width: Number(resource.width || target.width),
          height: Number(resource.height || target.height),
        }
      )
    : null;
  const position: [number, number, number] = [
    target.x + target.width / 2 - width / 2,
    height / 2 - target.y - target.height / 2,
    z,
  ];
  const rotation = (-Number(item.rotation || 0) * Math.PI) / 180;
  const translateX = Number(item.translate?.x || 0);
  const translateY = -Number(item.translate?.y || 0);
  const opacity = Number(item.style?.opacity ?? 1);
  const common = {
    position: [position[0] + translateX, position[1] + translateY, position[2]] as [number, number, number],
    rotation,
    opacity,
    style: item.style,
  };
  if (resource.type === 'Image')
    return <ImagePlane resource={resource} width={target.width} height={target.height} crop={source} {...common} />;
  if (resource.type === 'Video')
    return (
      <VideoPlane
        resource={resource}
        width={target.width}
        height={target.height}
        crop={source}
        time={clock.time}
        playing={clock.playing}
        playbackRate={clock.playbackRate}
        temporal={temporal}
        timeMode={String(item.annotation?.timeMode || fallbackTimeMode || 'trim')}
        duration={Number(resource.duration || 0)}
        {...common}
      />
    );
  if (resource.type === 'Svg' || resource.format === 'image/svg+xml') {
    const url = resource.value
      ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(String(resource.value))}`
      : resource.id;
    return (
      <ImagePlane
        resource={{ ...resource, id: url }}
        width={target.width}
        height={target.height}
        crop={null}
        {...common}
      />
    );
  }
  if (resource.type === 'TextualBody' || resource.type === 'Text') {
    const html = resource.format === 'text/html' ? sanitizeIiifHtml(String(resource.value || '')) : '';
    return (
      <Html transform center position={common.position} rotation={[0, 0, rotation]} scale={0.01}>
        <div
          className="riv-scene-canvas-text"
          style={{ width: target.width * 100, height: target.height * 100, opacity }}
        >
          {html ? <span dangerouslySetInnerHTML={{ __html: html }} /> : String(resource.value || '')}
        </div>
      </Html>
    );
  }
  return null;
}

function ImagePlane({
  resource,
  width,
  height,
  crop,
  position,
  rotation,
  opacity,
  style,
}: {
  resource: any;
  width: number;
  height: number;
  crop: CanvasRegion | null;
  position: [number, number, number];
  rotation: number;
  opacity: number;
  style?: Record<string, unknown>;
}) {
  const runtime = useSceneRuntime();
  const diagnostic = runtime.diagnostic;
  const mesh = useRef<Mesh>(null);
  const currentMaterial = useRef<MeshBasicMaterial>(null);
  const previousMaterial = useRef<MeshBasicMaterial>(null);
  const service = imageServiceId(resource);
  const [requestWidth, setRequestWidth] = useState(() =>
    Math.min(1024, Math.max(64, Number(crop?.width || resource.width || width) || 64))
  );
  const [texture, setTexture] = useState<Texture | null>(null);
  const [previousTexture, setPreviousTexture] = useState<Texture | null>(null);
  const textureRef = useRef<Texture | null>(null);
  const previousTextureRef = useRef<Texture | null>(null);
  const blend = useRef(1);
  const invalidate = useThree((state) => state.invalidate);
  useFrame(({ camera, size }, delta) => {
    if (service && mesh.current) {
      mesh.current.updateWorldMatrix(true, false);
      const left = new Vector3(-width / 2, 0, 0).applyMatrix4(mesh.current.matrixWorld).project(camera);
      const right = new Vector3(width / 2, 0, 0).applyMatrix4(mesh.current.matrixWorld).project(camera);
      const projected = (Math.abs(right.x - left.x) * size.width) / 2;
      if (Number.isFinite(projected) && projected > 0) {
        const maximum = Number(crop?.width || resource.width || projected);
        let next = requestWidth;
        if (projected > requestWidth * 0.9 || projected < requestWidth * 0.4) {
          next = Math.min(maximum, Math.max(64, Math.pow(2, Math.ceil(Math.log2(Math.max(64, projected))))));
        }
        if (next !== requestWidth) setRequestWidth(next);
      }
    }
    if (!previousTexture || blend.current >= 1) return;
    blend.current = Math.min(1, blend.current + Math.min(delta, 1 / 30) / 0.3);
    const eased = blend.current * blend.current * (3 - 2 * blend.current);
    if (currentMaterial.current) currentMaterial.current.opacity = opacity * eased;
    if (previousMaterial.current) previousMaterial.current.opacity = opacity * (1 - eased);
    if (blend.current === 1) {
      previousTextureRef.current?.dispose();
      previousTextureRef.current = null;
      setPreviousTexture(null);
    } else invalidate();
  });
  const url = createCanvasImageRequestUrl(service, resource, crop, requestWidth);
  useEffect(() => {
    let active = true;
    new TextureLoader().load(
      String(url),
      (next) => {
        if (!active) {
          next.dispose();
          return;
        }
        next.colorSpace = SRGBColorSpace;
        const transform = service
          ? null
          : canvasTextureTransform(crop, Number(resource.width), Number(resource.height));
        if (transform) {
          next.offset.fromArray(transform.offset);
          next.repeat.fromArray(transform.repeat);
        }
        previousTextureRef.current?.dispose();
        const previous = textureRef.current;
        previousTextureRef.current = previous;
        textureRef.current = next;
        blend.current = previous ? 0 : 1;
        setPreviousTexture(previous);
        setTexture(next);
        invalidate();
      },
      undefined,
      (cause) => {
        if (active)
          diagnostic({
            code: 'canvas-image-load-failed',
            severity: 'warning',
            message: `Failed to load Canvas image ${url}`,
            resourceId: resource.id,
            cause,
          });
      }
    );
    return () => {
      active = false;
    };
  }, [
    crop?.height,
    crop?.width,
    crop?.x,
    crop?.y,
    invalidate,
    resource.height,
    resource.id,
    resource.width,
    diagnostic,
    service,
    url,
  ]);
  useEffect(
    () => () => {
      textureRef.current?.dispose();
      if (previousTextureRef.current !== textureRef.current) previousTextureRef.current?.dispose();
      textureRef.current = null;
      previousTextureRef.current = null;
    },
    []
  );
  const background = String(style?.backgroundColor || style?.background || '');
  const layer = Math.max(1, Math.round(position[2] * 1000));
  return (
    <group
      position={position}
      rotation={[0, 0, rotation]}
      userData={{ rivSceneImageService: service, rivSceneImageWidth: requestWidth, rivSceneImageUrl: url }}
    >
      {background ? (
        <mesh renderOrder={layer * 3}>
          <planeGeometry args={[width, height]} />
          <meshBasicMaterial
            color={background}
            polygonOffset
            polygonOffsetFactor={-layer}
            polygonOffsetUnits={-layer}
          />
        </mesh>
      ) : null}
      {previousTexture ? (
        <mesh renderOrder={layer * 3 + 1}>
          <planeGeometry args={[width, height]} />
          <meshBasicMaterial
            ref={previousMaterial}
            map={previousTexture}
            transparent
            opacity={opacity}
            depthWrite={false}
            polygonOffset
            polygonOffsetFactor={-layer - 1}
            polygonOffsetUnits={-layer - 1}
          />
        </mesh>
      ) : null}
      <mesh ref={mesh} renderOrder={layer * 3 + 2} visible={!!texture}>
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial
          ref={currentMaterial}
          map={texture}
          transparent
          opacity={previousTexture ? 0 : opacity}
          depthWrite={false}
          polygonOffset
          polygonOffsetFactor={-layer - 2}
          polygonOffsetUnits={-layer - 2}
        />
      </mesh>
    </group>
  );
}

function VideoPlane({
  resource,
  width,
  height,
  crop,
  position,
  rotation,
  opacity,
  time,
  playing,
  playbackRate,
  temporal,
  duration,
  timeMode,
}: {
  resource: any;
  width: number;
  height: number;
  crop: CanvasRegion | null;
  position: [number, number, number];
  rotation: number;
  opacity: number;
  time: number;
  playing: boolean;
  playbackRate: number;
  temporal: { start: number; end?: number } | null;
  duration: number;
  timeMode: string;
}) {
  const [texture, setTexture] = useState<VideoTexture | null>(null);
  const [metadataDuration, setMetadataDuration] = useState(0);
  const video = useRef<HTMLVideoElement | null>(null);
  useEffect(() => {
    setMetadataDuration(0);
    const element = document.createElement('video');
    element.crossOrigin = 'anonymous';
    element.playsInline = true;
    element.preload = 'auto';
    const readDuration = () => {
      if (Number.isFinite(element.duration) && element.duration > 0) setMetadataDuration(element.duration);
    };
    element.addEventListener('loadedmetadata', readDuration);
    element.src = resource.id;
    video.current = element;
    const next = new VideoTexture(element);
    next.colorSpace = SRGBColorSpace;
    const transform = canvasTextureTransform(crop, Number(resource.width), Number(resource.height));
    if (transform) {
      next.offset.fromArray(transform.offset);
      next.repeat.fromArray(transform.repeat);
    }
    setTexture(next);
    return () => {
      element.pause();
      element.removeEventListener('loadedmetadata', readDuration);
      element.removeAttribute('src');
      element.load();
      if (video.current === element) video.current = null;
      next.dispose();
    };
  }, [crop?.height, crop?.width, crop?.x, crop?.y, resource.height, resource.id, resource.width]);
  const mediaDuration = resolveMediaDuration(duration, metadataDuration);
  useEffect(() => {
    const element = video.current;
    if (!element) return;
    element.playbackRate = clampVideoPlaybackRate(
      getMediaPlaybackRate(playbackRate, temporal, mediaDuration, timeMode)
    );
    const expected = getLocalMediaTime(time, temporal, mediaDuration, timeMode);
    if (!playing || Math.abs(element.currentTime - expected) > 0.25) element.currentTime = expected;
    syncVideoPlayback(element, playing);
  }, [mediaDuration, playbackRate, playing, temporal, time, timeMode]);
  return texture ? (
    <mesh position={position} rotation={[0, 0, rotation]}>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial map={texture} transparent opacity={opacity} />
    </mesh>
  ) : null;
}

export function resolveMediaDuration(authored: number, discovered: number) {
  return Number.isFinite(authored) && authored > 0
    ? authored
    : Number.isFinite(discovered) && discovered > 0
      ? discovered
      : 0;
}

export function getMediaPlaybackRate(
  playbackRate: number,
  interval: { start: number; end?: number } | null,
  mediaDuration: number,
  timeMode: string
) {
  const baseRate = Number.isFinite(playbackRate) && playbackRate > 0 ? playbackRate : 1;
  if (timeMode !== 'scale' || interval?.end === undefined || interval.end <= interval.start || mediaDuration <= 0)
    return baseRate;
  const scaled = baseRate * (mediaDuration / (interval.end - interval.start));
  return Number.isFinite(scaled) && scaled > 0 ? scaled : baseRate;
}

export function clampVideoPlaybackRate(rate: number) {
  return Math.min(16, Math.max(0.0625, Number.isFinite(rate) ? rate : 1));
}

export function syncVideoPlayback(element: Pick<HTMLMediaElement, 'paused' | 'pause' | 'play'>, playing: boolean) {
  if (playing) {
    if (element.paused) void element.play().catch(() => undefined);
  } else {
    element.pause();
  }
}
