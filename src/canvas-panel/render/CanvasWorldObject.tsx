import { type ReactNode, useEffect, useMemo } from 'react';
import { useStore } from 'zustand';
import { useStrategy } from '../../context/StrategyContext';
import { useAtlasContextMenu } from '../../hooks/useAtlasContextMenu';
import { useCanvas } from '../../hooks/useCanvas';
import { useResourceEvents } from '../../hooks/useResourceEvents';
import { useAtlasStore } from '../context/atlas-store-provider';
import { useWorldSize } from '../context/world-size';

interface CanvasWorldObjectProps {
  x?: number;
  y?: number;
  keepCanvasScale?: boolean;
  children?: ReactNode;
  renderContextMenu?: (options: { canvasId?: string; position: { x: number; y: number } }) => ReactNode;
}

export function CanvasWorldObject({
  x = 0,
  y = 0,
  keepCanvasScale = true,
  renderContextMenu,
  children,
}: CanvasWorldObjectProps) {
  const { strategy } = useStrategy();
  const canvas = useCanvas();
  const store = useAtlasStore();
  const elementProps = useResourceEvents(canvas, ['deep-zoom']);
  const setCanvasRelativePosition = useStore(store, (s) => s.setCanvasRelativePosition);
  const clearCanvasRelativePosition = useStore(store, (s) => s.clearCanvasRelativePosition);
  const [contextMenu, contextMenuProps] = useAtlasContextMenu(
    `context-menu/${canvas?.id}`,
    canvas?.id,
    renderContextMenu,
  );

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
        : []),
    );
  }, [keepCanvasScale, strategy]);

  useEffect(() => {
    if (canvas) {
      setCanvasRelativePosition(canvas.id, { x, y, width: canvas.width, height: canvas.height });
      return () => {
        clearCanvasRelativePosition(canvas.id);
      };
    }
  }, [x, y, canvas, clearCanvasRelativePosition, setCanvasRelativePosition]);

  useEffect(() => {
    if (canvas) {
      store.getState().reset();
    }
  }, [store, canvas]);

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
      scale={bestScale}
      x={x}
      y={y}
      {...contextMenuProps}
      {...elementProps}
    >
      {contextMenu}
      {children}
    </world-object>
  );
}
