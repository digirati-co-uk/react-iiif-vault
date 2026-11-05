import type { SceneNormalized } from '@iiif/parser/presentation-4-normalized/types';
import type { ActivationRecord } from './activation-state';
import type { Transform } from '@iiif/parser/presentation-4/types';
import { createStore, type StoreApi } from 'zustand/vanilla';
import type { SceneClockSnapshot, SceneResourceStatus, SceneRuntimeSnapshot, SceneView, SceneBounds } from './types';

export type ResourceRuntime = {
  hidden: boolean;
  disabled: boolean;
  selected: boolean;
  playing: boolean;
  activeAnimation: string | null;
  resetVersion: number;
  transformOverride: readonly Transform[] | null;
  type: string;
  interactionMode: readonly string[];
};

export type SceneRuntimeState = SceneClockSnapshot & {
  scene: SceneNormalized;
  duration: number;
  activeCamera: string | null;
  selectedAnnotation: string | null;
  selectedAnnotationPath: string | null;
  audioLocked: boolean;
  muted: boolean;
  volume: number;
  annotationVisible: boolean;
  resourcesReady: boolean;
  /** Canonical destinations, published by framing/authored camera setup, never by user navigation. */
  homeViews: Record<
    string,
    {
      view: SceneView;
      bounds?: SceneBounds;
      padding?: number;
      aspect: number;
      source: 'framed' | 'authored' | 'fallback';
    }
  >;
  viewResetVersion: number;
  viewResetAnimate: boolean;
  previewAnnotation: string | { id: string; path?: string } | null;
  sceneChoices: Record<string, string[]>;
  freeViewActive: boolean;
  freeProjection: 'perspective' | 'orthographic';
  resources: Record<string, ResourceRuntime>;
  initialResources: Record<string, ResourceRuntime>;
  activeActivations: Record<string, ActivationRecord>;
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
    selectedAnnotationPath: null,
    audioLocked: true,
    muted: false,
    volume: 1,
    annotationVisible: true,
    resourcesReady: false,
    homeViews: {},
    viewResetVersion: 0,
    viewResetAnimate: true,
    previewAnnotation: null,
    sceneChoices: {},
    freeViewActive: false,
    freeProjection: 'perspective',
    resources: {},
    initialResources: {},
    activeActivations: {},
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
    selectedAnnotationPath: state.selectedAnnotationPath,
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
    activeActivations: Object.values(state.activeActivations).map(({ annotationId, instancePath, canDeactivate }) => ({
      annotationId,
      instancePath,
      canDeactivate,
    })),
    errors: { ...state.errors },
  };
}
