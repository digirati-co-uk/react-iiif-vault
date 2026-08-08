import type { GeoJSONGeometry } from '@iiif/helpers/scenes';
import { useFrame, useThree } from '@react-three/fiber';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  BufferGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  ShapeUtils,
  SRGBColorSpace,
  Texture,
  Vector2,
  Vector3,
} from 'three';
import { useSceneRuntime } from './context';
import type { AnnotationMarkerProps } from './types';

export function geometryPoints(geometry: GeoJSONGeometry): [number, number, number][] {
  if (geometry.type === 'GeometryCollection') return geometry.geometries.flatMap(geometryPoints);
  const points: [number, number, number][] = [];
  const visit = (value: unknown) => {
    if (Array.isArray(value) && value.length >= 2 && value.every((item) => typeof item === 'number'))
      points.push([Number(value[0]), Number(value[1]), Number(value[2] || 0)]);
    else if (Array.isArray(value)) value.forEach(visit);
  };
  visit(geometry.coordinates);
  return points;
}

export function SvgAnnotationMarker({
  selector,
  point,
  selected,
  activate,
}: {
  selector: any;
  point: [number, number, number];
  selected: boolean;
  activate(): void;
}) {
  const runtime = useSceneRuntime();
  const invalidate = useThree((state) => state.invalidate);
  const svg = String(selector.svg || '');
  const [loadedTexture, setLoadedTexture] = useState<{ source: string; texture: Texture } | null>(null);
  const texture = loadedTexture?.source === svg ? loadedTexture.texture : null;
  const spatial = selector.spatial || { width: 1, height: 1 };
  const width = Math.max(0.001, Number(spatial.width || 1));
  const height = Math.max(0.001, Number(spatial.height || 1));
  const style = selector.boxStyle || {};
  const parsedOpacity = Number(style.opacity ?? 1);
  const opacity = Number.isFinite(parsedOpacity) ? Math.min(1, Math.max(0, parsedOpacity)) : 1;
  const translate = selector.translate || {};
  const translateX = Number(translate.x || 0);
  const translateY = Number(translate.y || 0);
  const position: [number, number, number] = [
    point[0] + (Number.isFinite(translateX) ? translateX : 0),
    point[1] + (Number.isFinite(translateY) ? translateY : 0),
    point[2],
  ];
  const rotationValue = Number(selector.rotation || 0);
  const rotation = ((Number.isFinite(rotationValue) ? rotationValue : 0) * Math.PI) / 180;

  useEffect(() => {
    setLoadedTexture(null);
    if (!svg) return;
    let disposed = false;
    let next: Texture | null = null;
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => {
      if (disposed) return;
      next = new Texture(image);
      next.colorSpace = SRGBColorSpace;
      next.needsUpdate = true;
      setLoadedTexture({ source: svg, texture: next });
      invalidate();
    };
    image.onerror = (cause) =>
      runtime.diagnostic({
        code: 'svg-load-failed',
        severity: 'warning',
        message: 'Failed to decode an SVG annotation selector.',
        cause,
      });
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    return () => {
      disposed = true;
      image.onload = null;
      image.onerror = null;
      next?.dispose();
    };
  }, [invalidate, runtime.diagnostic, svg]);

  return (
    <group
      position={position}
      rotation={[0, 0, rotation]}
      onClick={(event) => {
        event.stopPropagation();
        activate();
      }}
    >
      <mesh renderOrder={selected ? 2 : 1}>
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial
          color={texture ? '#ffffff' : '#d7263d'}
          map={texture || undefined}
          transparent
          opacity={texture ? opacity : 0.28}
          alphaTest={texture ? 0.001 : 0}
          side={DoubleSide}
        />
      </mesh>
      {selected ? (
        <mesh position={[0, 0, 0.001]}>
          <planeGeometry args={[width * 1.03, height * 1.03]} />
          <meshBasicMaterial color="#ffbf00" wireframe depthTest={false} />
        </mesh>
      ) : null}
    </group>
  );
}

export function DefaultMarker({ point, selected, size, activate }: Omit<AnnotationMarkerProps, 'annotation'>) {
  const group = useRef<Group>(null);
  const camera = useThree((state) => state.camera) as any;
  const viewportHeight = useThree((state) => state.size.height);
  const world = useMemo(() => new Vector3(...point), [point[0], point[1], point[2]]);
  useFrame(() => {
    if (!group.current || !viewportHeight) return;
    const pixels = size * (selected ? 1.25 : 1);
    const diameter = camera.isPerspectiveCamera
      ? (2 * camera.position.distanceTo(world) * Math.tan((Number(camera.fov || 50) * Math.PI) / 360) * pixels) /
        viewportHeight
      : (Math.abs(Number(camera.top || 1) - Number(camera.bottom || -1)) * pixels) /
        (Number(camera.zoom || 1) * viewportHeight);
    group.current.scale.setScalar(Math.max(diameter, 0.0001));
  });
  return (
    <group ref={group} position={point} scale={0.0001}>
      <mesh
        onClick={(event) => {
          event.stopPropagation();
          activate();
        }}
      >
        <sphereGeometry args={[0.5, 20, 20]} />
        <meshBasicMaterial color={selected ? '#ffbf00' : '#d7263d'} depthTest={false} />
      </mesh>
    </group>
  );
}

export function GeometryMarker({
  geometry,
  selected,
  size,
  activate,
}: {
  geometry: GeoJSONGeometry;
  selected: boolean;
  size: number;
  activate(): void;
}) {
  if (geometry.type === 'Point')
    return (
      <DefaultMarker
        point={geometryPoints(geometry)[0] || [0, 0, 0]}
        selected={selected}
        size={size}
        activate={activate}
      />
    );
  if (geometry.type === 'MultiPoint')
    return (
      <>
        {geometryPoints(geometry).map((point, index) => (
          <DefaultMarker key={index} point={point} selected={selected} size={size} activate={activate} />
        ))}
      </>
    );
  if (geometry.type === 'GeometryCollection')
    return (
      <>
        {geometry.geometries.map((item, index) => (
          <GeometryMarker key={index} geometry={item} selected={selected} size={size} activate={activate} />
        ))}
      </>
    );
  return <GeometryShapeMarker geometry={geometry} selected={selected} activate={activate} />;
}

type ShapeGeometry = Exclude<GeoJSONGeometry, { type: 'Point' | 'MultiPoint' | 'GeometryCollection' }>;
type Point3 = [number, number, number];

function point3(value: readonly number[]): Point3 {
  return [Number(value[0]), Number(value[1]), Number(value[2] || 0)];
}

function lineParts(geometry: ShapeGeometry): Point3[][] {
  if (geometry.type === 'LineString') return [geometry.coordinates.map(point3)];
  if (geometry.type === 'MultiLineString') return geometry.coordinates.map((line) => line.map(point3));
  if (geometry.type === 'Polygon') return geometry.coordinates.map((ring) => ring.map(point3));
  return geometry.coordinates.flatMap((polygon) => polygon.map((ring) => ring.map(point3)));
}

function samePoint(left: Point3, right: Point3) {
  return left.every((value, axis) => value === right[axis]);
}

function openRing(ring: Point3[]) {
  return ring.length > 1 && samePoint(ring[0], ring[ring.length - 1]) ? ring.slice(0, -1) : ring;
}

function projectPolygon(points: Point3[]) {
  let normal: Point3 = [0, 0, 0];
  for (let index = 0; index < points.length; index++) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    normal = [
      normal[0] + (current[1] - next[1]) * (current[2] + next[2]),
      normal[1] + (current[2] - next[2]) * (current[0] + next[0]),
      normal[2] + (current[0] - next[0]) * (current[1] + next[1]),
    ];
  }
  const droppedAxis = normal.map(Math.abs).indexOf(Math.max(...normal.map(Math.abs)));
  return (point: Point3) =>
    droppedAxis === 0
      ? new Vector2(point[1], point[2])
      : droppedAxis === 1
        ? new Vector2(point[0], point[2])
        : new Vector2(point[0], point[1]);
}

/** Build disconnected outlines and correctly triangulated Polygon/MultiPolygon surfaces. */
export function createGeometryMarkerBuffers(geometry: ShapeGeometry) {
  const outline = new BufferGeometry();
  const positions: number[] = [];
  for (const part of lineParts(geometry)) {
    for (let index = 1; index < part.length; index++) positions.push(...part[index - 1], ...part[index]);
  }
  outline.setAttribute('position', new Float32BufferAttribute(positions, 3));

  if (geometry.type !== 'Polygon' && geometry.type !== 'MultiPolygon') return { outline, surface: null };
  const surface = new BufferGeometry();
  const surfacePositions: number[] = [];
  const indices: number[] = [];
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  for (const polygon of polygons) {
    const rings = polygon.map((ring) => openRing(ring.map(point3))).filter((ring) => ring.length >= 3);
    if (!rings.length) continue;
    const offset = surfacePositions.length / 3;
    const project = projectPolygon(rings[0]);
    const faces = ShapeUtils.triangulateShape(
      rings[0].map(project),
      rings.slice(1).map((ring) => ring.map(project))
    );
    surfacePositions.push(...rings.flat(2));
    indices.push(...faces.flatMap((face) => face.map((index) => index + offset)));
  }
  surface.setAttribute('position', new Float32BufferAttribute(surfacePositions, 3));
  surface.setIndex(indices);
  surface.computeVertexNormals();
  return { outline, surface };
}

function GeometryShapeMarker({
  geometry,
  selected,
  activate,
}: {
  geometry: ShapeGeometry;
  selected: boolean;
  activate(): void;
}) {
  const buffers = useMemo(() => createGeometryMarkerBuffers(geometry), [geometry]);
  useEffect(
    () => () => {
      buffers.outline.dispose();
      buffers.surface?.dispose();
    },
    [buffers]
  );
  const outline = (
    <lineSegments
      geometry={buffers.outline}
      onClick={(event: any) => {
        event.stopPropagation();
        activate();
      }}
    >
      <lineBasicMaterial color={selected ? '#ffbf00' : '#d7263d'} />
    </lineSegments>
  );
  if (geometry.type !== 'Polygon' && geometry.type !== 'MultiPolygon') return outline;
  return (
    <group>
      {outline}
      <mesh
        geometry={buffers.surface || undefined}
        onClick={(event) => {
          event.stopPropagation();
          activate();
        }}
      >
        <meshBasicMaterial color={selected ? '#ffbf00' : '#d7263d'} opacity={0.25} transparent side={DoubleSide} />
      </mesh>
    </group>
  );
}
