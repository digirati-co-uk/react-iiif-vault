import { Reference } from '@iiif/presentation-3';
import { ReactNode } from 'react';

export type SimpleViewerContext = {
  items: Reference<'Canvas'>[];
  sequence: number[][];
  setSequenceIndex: (newId: number) => void;
  setCurrentCanvasId: (newId: string) => void;
  setCurrentCanvasIndex: (newId: number) => void;
  currentSequenceIndex: number;
  nextCanvas: () => void;
  previousCanvas: () => void;
};

export type SimpleViewerProps = {
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
