import { Vault } from '@iiif/helpers/vault';
import type { Reference } from '@iiif/parser/presentation-3/types';
import { ReactNode } from 'react';
import type { ViewableContainerReference } from '../utility/canvas-compat';

export type SimpleViewerContext = {
  items: ViewableContainerReference[];
  sequence: number[][];
  hasNext: boolean;
  hasPrevious: boolean;
  setSequenceIndex: (newId: number) => void;
  setCurrentCanvasId: (newId: string) => void;
  setCurrentCanvasIndex: (newId: number) => void;
  currentSequenceIndex: number;
  nextCanvas: () => void;
  previousCanvas: () => void;
};

export type SimpleViewerProps = {
  vault?: Vault;
  manifest: string;
  pagingEnabled?: boolean;
  children: ReactNode;
  startCanvas?: string;
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
