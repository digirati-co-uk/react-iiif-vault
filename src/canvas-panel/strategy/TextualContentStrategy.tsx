import { ReactNode } from 'react';
import { useStrategy } from '../../context/StrategyContext';
import { RenderTextualContent } from '../render/TextualContent';
import { useCanvas } from '../../hooks/useCanvas';
import { ViewerPresetContext, useViewerPreset } from '../../context/ViewerPresetContext';
import { useOverlay } from '../context/overlays';
import { useRenderControls } from '../../context/ControlsContext';

interface TextualContextStrategyProps {
  onClickPaintingAnnotation?: (id: string, e: any) => void;
  children?: ReactNode;
}

export function RenderTextualContentStrategy({ onClickPaintingAnnotation, children }: TextualContextStrategyProps) {
  const { strategy } = useStrategy();
  const { renderViewerControls, viewControlsDeps } = useRenderControls();

  const preset = useViewerPreset();
  const canvas = useCanvas();

  useOverlay(
    preset && strategy.type === 'textual-content' && renderViewerControls ? 'overlay' : 'none',
    `canvas-portal-controls-${canvas?.id}`,
    ViewerPresetContext.Provider,
    renderViewerControls
      ? {
          value: preset || null,
          children: renderViewerControls(strategy as any),
        }
      : {},
    [canvas, preset, strategy, ...(viewControlsDeps || [])]
  );

  if (strategy.type !== 'textual-content') return null;

  return (
    <>
      <RenderTextualContent strategy={strategy} onClickPaintingAnnotation={onClickPaintingAnnotation} />
      {children}
    </>
  );
}
