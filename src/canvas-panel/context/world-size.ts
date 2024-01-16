import { createContext, useContext, useEffect } from 'react';
import { useCanvas } from '../../hooks/useCanvas';

export const WorldSizeContext = createContext<(canvasId: string, size: number) => void>(() => void 0);

export function useWorldSize(size: number) {
  const canvas = useCanvas();
  const fn = useContext(WorldSizeContext);

  useEffect(() => {
    if (canvas && canvas.id) {
      fn(canvas.id, size);

      return () => fn(canvas.id, -1);
    }

    return () => void 0;
  }, [canvas, size]);
}
