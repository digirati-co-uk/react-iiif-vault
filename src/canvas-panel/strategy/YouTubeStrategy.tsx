import { useRenderControls } from '../../context/ControlsContext';
import { useStrategy } from '../../context/StrategyContext';
import { ThumbnailFallbackImage } from '../render/ThumbnailFallbackImage';
import { VideoYouTube } from '../render/VideoYouTube';

export function RenderYouTubeStrategy() {
  const { strategy } = useStrategy();
  const { renderMediaControls, mediaControlsDeps } = useRenderControls();

  if (strategy.type !== 'media' || strategy.media.type !== 'VideoYouTube') {
    return null;
  }

  return (
    <VideoYouTube media={strategy.media} mediaControlsDeps={mediaControlsDeps}>
      <ThumbnailFallbackImage />
      {renderMediaControls ? renderMediaControls(strategy) : null}
    </VideoYouTube>
  );
}
