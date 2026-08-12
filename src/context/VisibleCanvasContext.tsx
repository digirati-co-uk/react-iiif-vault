import { useContext } from 'react';
import React from 'react';
import type { CanvasNormalized } from '@iiif/parser/presentation-3-normalized/types';
import type { CompatibleCanvas } from '../utility/canvas-compat';
import { useVaultSelector } from '../hooks/useVaultSelector';

export const VisibleCanvasReactContext = React.createContext<string[]>([]);

export function useVisibleCanvases(): CanvasNormalized[] {
  const ids = useContext(VisibleCanvasReactContext);

  return useVaultSelector<CanvasNormalized[]>(
    (state) => {
      return ids.map((id) => state.iiif.entities.Canvas[id]).filter(Boolean);
    },
    [ids]
  );
}

export function useVisibleCanvasContainers(): CompatibleCanvas[] {
  const ids = useContext(VisibleCanvasReactContext);
  return useVaultSelector<CompatibleCanvas[]>(
    (state) =>
      ids.flatMap((id) => {
        const container =
          state.iiif.mapping[id] === 'Timeline' ? state.iiif.entities.Timeline[id] : state.iiif.entities.Canvas[id];
        return container ? [container] : [];
      }),
    [ids]
  );
}
