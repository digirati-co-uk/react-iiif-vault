import type { BoxStyle } from '@atlas-viewer/atlas';
import { useStrategy } from '../../context/StrategyContext';
import { useCanvas } from '../../hooks/useCanvas';
import { getCanvasBackgroundColor } from '../../utility/canvas-compat';
import { CanvasBackground } from '../render/CanvasBackground';

interface RenderEmptyStrategyProps {
  backgroundStyle?: BoxStyle;
  alwaysShowBackground?: boolean;
}

export function RenderEmptyStrategy({ backgroundStyle, alwaysShowBackground }: RenderEmptyStrategyProps) {
  const { strategy } = useStrategy();
  const backgroundColor = getCanvasBackgroundColor(useCanvas());

  if (strategy.type !== 'empty' && !alwaysShowBackground && !backgroundColor) return null;

  return <CanvasBackground style={backgroundStyle} />;
}
