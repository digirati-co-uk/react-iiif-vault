import { CanvasContext } from '../../context/CanvasContext';
import { useRenderControls } from '../../context/ControlsContext';
import { useStrategy } from '../../context/StrategyContext';
import { useCanvas } from '../../hooks/useCanvas';
import { RenderCanvas } from '../render/Canvas';

export function RenderAccompanyingCanvas() {
  const { strategy } = useStrategy();
  const { renderViewerControls, viewControlsDeps } = useRenderControls();
  const canvas = useCanvas();
  const accompanyingCanvas = canvas?.accompanyingCanvas;
  const placeholderCanvas = canvas?.placeholderCanvas;

  return (
    <>
      {/* Accompanying canvas if its available */}
      {strategy.type === 'media' && strategy.media.type === 'Sound' && accompanyingCanvas ? (
        <CanvasContext canvas={accompanyingCanvas.id}>
          <RenderCanvas renderViewerControls={renderViewerControls} viewControlsDeps={viewControlsDeps} />
        </CanvasContext>
      ) : null}

      {/* Fallback to placeholder canvas, we don't currently have a way to know if the audio is playing at this level.  */}
      {strategy.type === 'media' && strategy.media.type === 'Sound' && placeholderCanvas && !accompanyingCanvas ? (
        <CanvasContext canvas={placeholderCanvas.id}>
          <RenderCanvas renderViewerControls={renderViewerControls} viewControlsDeps={viewControlsDeps} />
        </CanvasContext>
      ) : null}
    </>
  );
}
