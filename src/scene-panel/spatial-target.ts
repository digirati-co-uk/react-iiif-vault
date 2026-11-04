import { parseSceneTarget, type GeoJSONGeometry } from '@iiif/helpers/scenes';
import { Box3, Euler, Object3D, Quaternion, Vector3 } from 'three';

type SpatialRuntime = {
  scene: { id: string };
  vault: { get<T = any>(input: any, options?: any): T | undefined };
  resolvePoint(id: string): readonly [number, number, number] | null;
};

export function geometryCenter(geometry: GeoJSONGeometry | null): [number, number, number] | null {
  if (!geometry) return null;
  const points: number[][] = [];
  const visit = (value: unknown) => {
    if (!Array.isArray(value)) return;
    if (value.length >= 2 && value.every((item) => typeof item === 'number')) points.push(value as number[]);
    else value.forEach(visit);
  };
  const collect = (value: GeoJSONGeometry) => {
    if (value.type === 'GeometryCollection') value.geometries.forEach(collect);
    else visit(value.coordinates);
  };
  collect(geometry);
  if (!points.length) return null;
  const minimum = [points[0][0], points[0][1], points[0][2] || 0];
  const maximum = [...minimum];
  for (const point of points.slice(1)) {
    for (let axis = 0; axis < 3; axis++) {
      minimum[axis] = Math.min(minimum[axis], point[axis] || 0);
      maximum[axis] = Math.max(maximum[axis], point[axis] || 0);
    }
  }
  return minimum.map((value, axis) => (value + maximum[axis]) / 2) as [number, number, number];
}

export function resolveLookAtReferenceId(value: any): string | undefined {
  if (typeof value === 'string') return value;
  return value &&
    value.type !== 'SpecificResource' &&
    !String(value.type || '').endsWith('Selector') &&
    typeof value.id === 'string'
    ? value.id
    : undefined;
}

function findResourceObject(scene: Object3D, id: string) {
  let object: Object3D | null = null;
  scene.traverse((candidate) => {
    if (!object && candidate.userData?.iiifIds?.includes(id)) object = candidate;
  });
  return object as Object3D | null;
}

function objectCenter(scene: Object3D, id: string): [number, number, number] | null {
  const object = findResourceObject(scene, id);
  if (!object) return null;
  object.updateWorldMatrix(true, true);
  const bounds = new Box3().setFromObject(object);
  return bounds.isEmpty() ? null : (bounds.getCenter(new Vector3()).toArray() as [number, number, number]);
}

function canvasPointToWorld(canvas: Object3D, point: readonly [number, number, number]) {
  let coordinates: Object3D | null = null;
  canvas.traverse((candidate) => {
    if (!coordinates && typeof candidate.userData?.rivCanvasPoint === 'function') coordinates = candidate;
  });
  if (coordinates) {
    const local = (coordinates as Object3D).userData.rivCanvasPoint(...point);
    (coordinates as Object3D).updateWorldMatrix(true, true);
    return (coordinates as Object3D).localToWorld(new Vector3(...local)).toArray() as [number, number, number];
  }
  canvas.updateWorldMatrix(true, true);
  return canvas.localToWorld(new Vector3(point[0], -point[1], point[2])).toArray() as [number, number, number];
}

export function resolveLookAtPoint(input: any, runtime: SpatialRuntime, scene: Object3D) {
  const hydrated = runtime.vault.get<any>(input, { skipSelfReturn: false, preserveSpecificResources: true }) || input;
  const referenceId = resolveLookAtReferenceId(hydrated);
  if (referenceId) return runtime.resolvePoint(referenceId) || objectCenter(scene, referenceId);

  const selector = typeof hydrated?.type === 'string' && hydrated.type.endsWith('Selector');
  const target = parseSceneTarget(
    selector
      ? { type: 'SpecificResource', source: { id: runtime.scene.id, type: 'Scene' }, selector: hydrated }
      : hydrated,
    { id: runtime.scene.id, type: 'Scene' }
  );
  const point = target.point || geometryCenter(target.geometry);
  if (!point) return runtime.resolvePoint(target.source.id) || objectCenter(scene, target.source.id);
  if (target.source.type !== 'Canvas') return point;

  const canvas = findResourceObject(scene, target.source.id);
  if (!canvas) return null;
  return canvasPointToWorld(canvas, point);
}

export function applyLookAtPreservingRoll(
  object: Object3D,
  point: readonly [number, number, number],
  authoredQuaternion: readonly [number, number, number, number]
) {
  // Match createSceneTransformMatrix's X-then-Y-then-Z composition. Using the
  // view/camera ZYX convention isolates the authored Z value when X/Y exist.
  const roll = new Euler().setFromQuaternion(new Quaternion(...authoredQuaternion), 'ZYX').z;
  object.lookAt(...point);
  object.rotateZ(roll);
}
