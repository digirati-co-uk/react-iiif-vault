import { ReactNode, useMemo } from 'react';
import { useStrategy } from '../../context/StrategyContext';
import { useCanvas } from '../../hooks/useCanvas';
import { useResourceEvents } from '../../hooks/useResourceEvents';
import { useWorldSize } from '../context/world-size';

interface CanvasWorldObjectProps {
  x?: number;
  y?: number;
  keepCanvasScale?: boolean;
  children?: ReactNode;
}

export function CanvasWorldObject({ x = 0, y = 0, keepCanvasScale, children }: CanvasWorldObjectProps) {
  const { strategy } = useStrategy();
  const canvas = useCanvas();
  const elementProps = useResourceEvents(canvas, ['deep-zoom']);
  const bestScale = useMemo(() => {
    if (keepCanvasScale) {
      return 1;
    }
    return Math.max(
      1,
      ...(strategy.type === 'images'
        ? strategy.images.map((i) => {
            return (i.width || 0) / i.target?.spatial.width;
          })
        : [])
    );
  }, [keepCanvasScale, strategy]);

  useWorldSize(bestScale);

  const totalKey = strategy.type === 'images' ? strategy.images.length : 0;

  if (!canvas) {
    return null;
  }

  return (
    <world-object
      key={`${canvas.id}/${strategy.type}/${totalKey}`}
      height={canvas.height}
      width={canvas.width}
      // scale={bestScale}
      x={x}
      y={y}
      {...elementProps}
    >
      {children}
    </world-object>
  );
}
