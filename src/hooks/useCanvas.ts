import { useResourceContext } from '../context/ResourceContext';
import type { CanvasNormalized } from '@iiif/parser/presentation-3-normalized/types';
import { type DependencyList, useMemo } from 'react';
import { useVaultSelector } from './useVaultSelector';

export function useCanvas(options?: { id?: string; selector?: undefined }): CanvasNormalized | undefined;
export function useCanvas<T>(
  options?: { id: string; selector: (canvas: CanvasNormalized) => T },
  deps?: DependencyList
): T | undefined;
export function useCanvas<T = CanvasNormalized>(
  options: {
    id?: string;
    selector?: (canvas: CanvasNormalized) => T;
  } = {},
  deps: DependencyList = []
): CanvasNormalized | T | undefined {
  const { id, selector } = options;
  const ctx = useResourceContext();
  const canvasId = id ? id : ctx.canvas;

  const canvas = useVaultSelector((s) => (canvasId ? s.iiif.entities.Canvas[canvasId] : undefined), [canvasId]);

  return useMemo(() => {
    if (!canvas) {
      return undefined;
    }
    if (selector) {
      return selector(canvas);
    }
    return canvas;
  }, [canvas, selector, ...deps]);
}
