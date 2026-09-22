import { CanvasContext } from '../../context/CanvasContext';
import { useRenderControls } from '../../context/ControlsContext';
import { useStrategy } from '../../context/StrategyContext';
import { useCanvasContainer } from '../../hooks/useCanvasContainer';
import { getAccompanyingContainer, getPlaceholderContainer } from '../../utility/canvas-compat';
import { RenderCanvas } from '../render/Canvas';

export function RenderAccompanyingCanvas() {
  const { strategy } = useStrategy();
  const { renderViewerControls, viewControlsDeps } = useRenderControls();
  const canvas = useCanvasContainer();
  const accompanyingCanvas = getAccompanyingContainer(canvas);
  const placeholderCanvas = getPlaceholderContainer(canvas);
  const canRenderAccompanying = accompanyingCanvas?.type === 'Canvas';
  const canRenderPlaceholder = placeholderCanvas?.type === 'Canvas';

  return (
    <>
      {/* Accompanying canvas if its available */}
      {strategy.type === 'media' && strategy.media.type === 'Sound' && canRenderAccompanying ? (
        <CanvasContext canvas={accompanyingCanvas.id}>
          <RenderCanvas renderViewerControls={renderViewerControls} viewControlsDeps={viewControlsDeps} />
        </CanvasContext>
      ) : null}

      {/* Fallback to placeholder canvas, we don't currently have a way to know if the audio is playing at this level.  */}
      {strategy.type === 'media' &&
      strategy.media.type === 'Sound' &&
      canRenderPlaceholder &&
      !canRenderAccompanying ? (
        <CanvasContext canvas={placeholderCanvas.id}>
          <RenderCanvas renderViewerControls={renderViewerControls} viewControlsDeps={viewControlsDeps} />
        </CanvasContext>
      ) : null}
    </>
  );
}
