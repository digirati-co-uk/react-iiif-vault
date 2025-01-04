import { BoxStyle } from '@atlas-viewer/atlas';
import { useStrategy } from '../../context/StrategyContext';
import { CanvasBackground } from '../render/CanvasBackground';

interface RenderEmptyStrategyProps {
  backgroundStyle?: BoxStyle;
  alwaysShowBackground?: boolean;
}

export function RenderEmptyStrategy({ backgroundStyle, alwaysShowBackground }: RenderEmptyStrategyProps) {
  const { strategy } = useStrategy();

  if (strategy.type !== 'empty' && !alwaysShowBackground) return null;

  return <CanvasBackground style={backgroundStyle} />;
}
