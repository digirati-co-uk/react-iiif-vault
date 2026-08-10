import { ReactNode } from 'react';
import { SingleImageStrategy } from '../../features/rendering-strategy/image-strategy';
import { EmptyStrategy } from '../../features/rendering-strategy/strategies';
import { useCanvas } from '../../hooks/useCanvas';
import { RenderCanvas } from './Canvas';
import { CanvasContext } from '../../context/CanvasContext';
import { getPlaceholderContainer } from '../../utility/canvas-compat';

interface PlaceholderCanvasProps {
  renderViewerControls?: (strategy: SingleImageStrategy | EmptyStrategy) => ReactNode;
}

export function PlaceholderCanvas(props: PlaceholderCanvasProps) {
  const canvas = useCanvas();
  const placeholder = getPlaceholderContainer(canvas);

  if (placeholder?.type !== 'Canvas') return null;

  return (
    <CanvasContext canvas={placeholder.id}>
      <RenderCanvas renderViewerControls={props.renderViewerControls} />
    </CanvasContext>
  );
}
