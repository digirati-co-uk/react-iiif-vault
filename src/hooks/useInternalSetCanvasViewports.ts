import type { Runtime } from '@atlas-viewer/atlas';
import { useEffect, useMemo } from 'react';
import { useAtlasStore } from '../canvas-panel/context/atlas-store-provider';
import { useSimpleViewer } from '../viewers/SimpleViewerContext';
import { useCanvas } from './useCanvas';

export function useInternalSetCanvasViewports(runtime?: Runtime, time = 2000) {
  const { currentSequenceIndex, sequence, items } = useSimpleViewer();
  const canvas = useCanvas();
  const currentCanvases = useMemo(() => {
    const currentSequence = sequence[currentSequenceIndex] || [];
    if (currentSequence.length === 0 && canvas) {
      return [{ id: canvas.id, type: 'Canvas' }];
    }
    return currentSequence.map((idx) => items[idx as any] as { id: string; type: 'Canvas' });
  }, [sequence, currentSequenceIndex, canvas, items]);

  const store = useAtlasStore();

  useEffect(() => {
    const timer = () => {
      if (runtime && time !== -1) {
        // Get the current canvas view.
        const viewport = {
          x: runtime.x,
          y: runtime.y,
          width: runtime.width,
          height: runtime.height,
        };
        const positions = store.getState().canvasRelativePositions;
        const viewports: Record<string, { x: number; y: number; width: number; height: number; zoom?: number }> = {};

        for (const canvas of currentCanvases) {
          const canvasPosition = positions[canvas.id];
          if (canvasPosition) {
            // Intersection with viewport
            const x = canvasPosition.x;
            const y = canvasPosition.y;
            const width = canvasPosition.width;
            const height = canvasPosition.height;
            const intersection = {
              x: Math.max(x, viewport.x),
              y: Math.max(y, viewport.y),
              width: Math.min(x + width, viewport.x + viewport.width) - Math.max(x, viewport.x),
              height: Math.min(y + height, viewport.y + viewport.height) - Math.max(y, viewport.y),
            };

            const doesNotIntersect = intersection.width <= 0 || intersection.height <= 0;

            if (!doesNotIntersect) {
              viewports[canvas.id] = {
                x: intersection.x - canvasPosition.x,
                y: intersection.y - canvasPosition.y,
                width: intersection.width,
                height: intersection.height,
              };
            }

            store.setState({ canvasViewports: viewports });
          }
        }
      }
    };

    const timeoutId = setInterval(timer, time);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [currentCanvases, runtime, store, time]);
}
