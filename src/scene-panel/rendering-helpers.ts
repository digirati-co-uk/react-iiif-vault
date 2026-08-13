import { Matrix4, Vector3 } from 'three';

export type FrameLoopMode = 'always' | 'demand' | 'never';

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

export function quantity(value: unknown, fallback = 1) {
  const number =
    typeof value === 'number'
      ? value
      : value && typeof value === 'object'
        ? Number((value as any).quantityValue ?? (value as any).value ?? fallback)
        : fallback;
  return Number.isFinite(number) ? number : fallback;
}
