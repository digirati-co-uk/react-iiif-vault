import { ReactNode } from 'react';
import { useMediaState } from '../../context/MediaContext';
import { SingleImageStrategy } from '../../features/rendering-strategy/image-strategy';
import { EmptyStrategy } from '../../features/rendering-strategy/strategies';
import { useCanvas } from '../../hooks/useCanvas';
import { RenderCanvas } from './Canvas';
import { CanvasContext } from '../../context/CanvasContext';

interface PlaceholderCanvasProps {
  renderViewerControls?: (strategy: SingleImageStrategy | EmptyStrategy) => ReactNode;
}

export function PlaceholderCanvas(props: PlaceholderCanvasProps) {
  const canvas = useCanvas();

  if (!canvas || !canvas.placeholderCanvas) return null;

  return (
    <CanvasContext canvas={canvas.placeholderCanvas.id}>
      <RenderCanvas renderViewerControls={props.renderViewerControls} />
    </CanvasContext>
  );
}
