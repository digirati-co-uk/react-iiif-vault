import { type ReactNode, useEffect, useMemo } from 'react';

import { useStrategy } from '../../context/StrategyContext';

import { useCanvasContainer } from '../../hooks/useCanvasContainer';
import { useResourceEvents } from '../../hooks/useResourceEvents';

import { useWorldSize } from '../context/world-size';
import { getCanvasContainerSize } from '../../utility/canvas-compat';

export interface CanvasWorldObjectProps {
  x?: number;
  y?: number;
  keepCanvasScale?: boolean;
  children?: ReactNode;
  events?: Record<string, unknown>;
  onPositionChange?: (
    canvasId: string,
    position: { x: number; y: number; width: number; height: number } | null
  ) => void;
}

export function CanvasWorldObject({
  x = 0,
  y = 0,
  keepCanvasScale = true,
  events,
  onPositionChange,
  children,
}: CanvasWorldObjectProps) {
  const { strategy } = useStrategy();
  const canvas = useCanvasContainer();
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

  useEffect(() => {
    if (canvas) {
      const { width, height } = getCanvasContainerSize(canvas);
      onPositionChange?.(canvas.id, { x, y, width, height });
      return () => onPositionChange?.(canvas.id, null);
    }
  }, [x, y, canvas, onPositionChange]);

  useWorldSize(bestScale);

  const totalKey = strategy.type === 'images' ? strategy.images.length : 0;

  if (!canvas) {
    return null;
  }
  const { width, height } = getCanvasContainerSize(canvas);

  return (
    <world-object
      key={`${canvas.id}/${strategy.type}/${totalKey}`}
      height={height}
      width={width}
      // This is disabled for now.
      // The reason is that it conflicts with how other things are calculated, like zooming to
      // annotation regions and homeCover and positions.
      // scale={bestScale}
      x={x}
      y={y}
      {...events}
      {...elementProps}
    >
      {children}
    </world-object>
  );
}
