import { createContext, useContext, useEffect } from 'react';
import { useCanvasContainer } from '../../hooks/useCanvasContainer';

export const WorldSizeContext = createContext<(canvasId: string, size: number) => void>(() => void 0);

export function useWorldSize(size: number) {
  const canvas = useCanvasContainer();
  const fn = useContext(WorldSizeContext);

  useEffect(() => {
    if (canvas && canvas.id) {
      fn(canvas.id, size);

      return () => fn(canvas.id, -1);
    }

    return () => void 0;
  }, [canvas, size]);
}
