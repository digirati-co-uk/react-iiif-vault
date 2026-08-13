import { Vault } from '@iiif/helpers/vault';
import type { Vault4 } from '@iiif/helpers/vault-4';
import type { Reference } from '@iiif/parser/presentation-3/types';
import { ReactNode } from 'react';
import type { ContainerReference } from '../utility/canvas-compat';

type ContainerOfType<Type extends ContainerReference['type']> = ContainerReference & { type: Type };

export type CanvasRoute = {
  type: 'Canvas';
  containers: [ContainerOfType<'Canvas'>, ...ContainerOfType<'Canvas'>[]];
};

export type SceneRoute = {
  type: 'Scene';
  containers: [ContainerOfType<'Scene'>];
};

export type TimelineRoute = {
  type: 'Timeline';
  containers: [ContainerOfType<'Timeline'>];
};

export type ContainerRoute = CanvasRoute | SceneRoute | TimelineRoute;

export type SimpleViewerContext = {
  items: ContainerReference[];
  sequence: number[][];
  currentRoute: ContainerRoute | null;
  hasNext: boolean;
  hasPrevious: boolean;
  setSequenceIndex: (newId: number) => void;
  setCurrentCanvasId: (newId: string) => void;
  setCurrentCanvasIndex: (newId: number) => void;
  currentSequenceIndex: number;
  nextCanvas: () => void;
  previousCanvas: () => void;
  /** Navigate by container ID, including Canvas, Scene, and Timeline. */
  setCurrentContainerId: (newId: string) => void;
  setCurrentRouteIndex: (newId: number) => void;
  next: () => void;
  previous: () => void;
};

export type SimpleViewerProps = {
  vault?: Vault | Vault4;
  manifest: string;
  pagingEnabled?: boolean;
  children: ReactNode;
  startCanvas?: string;
  startContainer?: string;
  rangeId?: string;
};

export type SimpleViewerReducerState = {
  sequence: number[][];
  availableCanvases: Reference<'Canvas'>[];
  visibleCanvases: Reference<'Canvas'>[];
  currentCanvas: string | null;
  isPaged: boolean;
  rangeId: string | null;
};

export interface SimpleViewerActions {
  setCurrentCanvasId(newId: string): void;
  setCurrentCanvasIndex(newId: number): void;
  nextCanvas(): void;
  previousCanvas(): void;
  setCurrentRange(newId: string): void;
  clearRange(): void;
  setPagingEnabled(isEnabled: boolean): void;
}

export type SimpleViewerActionsType = {
  [T in keyof SimpleViewerActions]: {
    type: T;
    payload: Parameters<SimpleViewerActions[T]>[0];
  };
}[keyof SimpleViewerActions];
