import type { SceneNormalized } from '@iiif/parser/presentation-4-normalized/types';
import type { Transform } from '@iiif/parser/presentation-4/types';
import { createStore, type StoreApi } from 'zustand/vanilla';
import type { MatrixTuple } from '@iiif/helpers/scenes';
import type { SceneClockSnapshot, SceneResourceStatus, SceneRuntimeSnapshot } from './types';

export type ResourceRuntime = {
  hidden: boolean;
  disabled: boolean;
  selected: boolean;
  playing: boolean;
  activeAnimation: string | null;
  resetVersion: number;
  transformOverride: readonly Transform[] | null;
  editingMatrixOverride?: MatrixTuple | null;
  type: string;
  interactionMode: readonly string[];
};

export type SceneRuntimeState = SceneClockSnapshot & {
  scene: SceneNormalized;
  duration: number;
  activeCamera: string | null;
  selectedAnnotation: string | null;
  audioLocked: boolean;
  muted: boolean;
  volume: number;
  annotationVisible: boolean;
  resourcesReady: boolean;
  viewResetVersion: number;
  transforming: boolean;
  freeViewActive: boolean;
  freeProjection: 'perspective' | 'orthographic';
  resources: Record<string, ResourceRuntime>;
  initialResources: Record<string, ResourceRuntime>;
  idIndex: Record<string, string[]>;
  errors: Record<string, string>;
  resourceStatuses: Record<string, SceneResourceStatus>;
};

export type SceneRuntimeStore = StoreApi<SceneRuntimeState>;

export function createSceneRuntimeStore(scene: SceneNormalized, clock: SceneClockSnapshot): SceneRuntimeStore {
  return createStore(() => ({
    ...clock,
    scene,
    duration: scene.duration || 0,
    activeCamera: null,
    selectedAnnotation: null,
    audioLocked: true,
    muted: false,
    volume: 1,
    annotationVisible: true,
    resourcesReady: false,
    viewResetVersion: 0,
    transforming: false,
    freeViewActive: false,
    freeProjection: 'perspective',
    resources: {},
    initialResources: {},
    idIndex: {},
    errors: {},
    resourceStatuses: {},
  }));
}

export function runtimeSnapshot(state: SceneRuntimeState): SceneRuntimeSnapshot {
  return {
    sceneId: state.scene.id,
    duration: state.duration,
    currentTime: state.time,
    playing: state.playing,
    playbackRate: state.playbackRate,
    activeCamera: state.activeCamera,
    selectedAnnotation: state.selectedAnnotation,
    audio: { locked: state.audioLocked, muted: state.muted, volume: state.volume },
    resources: Object.fromEntries(
      Object.entries(state.resources).map(([path, resource]) => [
        path,
        {
          visible: !resource.hidden,
          disabled: resource.disabled,
          selected: resource.selected,
          playing: resource.playing,
          activeAnimation: resource.activeAnimation,
        },
      ])
    ),
    errors: state.errors,
  };
}
