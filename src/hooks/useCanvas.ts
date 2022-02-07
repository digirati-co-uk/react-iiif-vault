import { useResourceContext } from '../context/ResourceContext';
import { CanvasNormalized } from '@iiif/presentation-3';
import { useVault } from './useVault';
import { useMemo } from 'react';
import { IIIFStore } from '@iiif/vault';

export function useCanvas(options?: { id: string }): CanvasNormalized | undefined;
export function useCanvas<T>(
  options?: { id: string; selector: (canvas: CanvasNormalized) => T },
  deps?: any[]
): T | undefined;
export function useCanvas<T = CanvasNormalized>(
  options: {
    id?: string;
    selector?: (canvas: CanvasNormalized) => T;
  } = {},
  deps: any[] = []
): CanvasNormalized | T | undefined {
  const { id, selector } = options;
  const ctx = useResourceContext();
  const vault = useVault();
  const canvasId = id ? id : ctx.canvas;

  const canvas = canvasId ? vault.select((s: IIIFStore) => s.iiif.entities.Canvas[canvasId]) : undefined;

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
