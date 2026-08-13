import type { ScenePaintable } from '@iiif/helpers/scenes';
import type { SceneNormalized } from '@iiif/parser/presentation-4-normalized/types';
import { createContext, type MutableRefObject } from 'react';
import type { AudioListener } from 'three';

export const AudioListenerContext = createContext<AudioListener | null>(null);
export const ContinuousFramesContext = createContext<() => () => void>(() => () => undefined);
export const ResourceBoundsContext = createContext<{ version: number; changed(): void } | null>(null);

export type SceneRenderContextValue = {
  scene: SceneNormalized;
  paintables: readonly { paintable: ScenePaintable; index: number }[];
  filter?: (paintable: ScenePaintable) => boolean;
  ancestors: readonly string[];
  instancePath: string;
  parentHasEnvironment: boolean;
  hasCamera: boolean;
  hasLight: boolean;
  hasEnvironment: boolean;
  environmentOwnerPath: string | null;
  root: boolean;
  floorY: number;
  setFloorY(value: number): void;
  paintablesOwners: MutableRefObject<Set<symbol>>;
};

export const SceneRenderContext = createContext<SceneRenderContextValue | null>(null);
