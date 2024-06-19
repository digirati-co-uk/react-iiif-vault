import { ReactNode } from 'react';
import { useMediaState } from '../../context/MediaContext';
import { SingleImageStrategy } from '../../features/rendering-strategy/image-strategy';
import { EmptyStrategy } from '../../features/rendering-strategy/strategies';
import { useCanvas } from '../../hooks/useCanvas';
import { RenderCanvas } from './Canvas';

interface PlaceholderCanvasProps {
  renderViewerControls?: (strategy: SingleImageStrategy | EmptyStrategy) => ReactNode;
}

export function PlaceholderCanvas(props: PlaceholderCanvasProps) {
  const canvas = useCanvas();

  if (!canvas) return null;

  return <RenderCanvas renderViewerControls={props.renderViewerControls} />;
  // return null;
}
