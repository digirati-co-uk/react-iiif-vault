import { useContext } from 'react';
import React from 'react';
import { CanvasNormalized } from '@iiif/presentation-3';
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
