import { type ComponentType, type ReactNode, type RefObject } from 'react';
import { useSimpleMediaPlayer } from '../../hooks/useSimpleMediaPlayer';
import type { SingleVideo } from '../../features/rendering-strategy/resource-types';
import { MediaPlayerProvider } from '../../context/MediaContext';
import { useOverlay } from '../context/overlays';
import { useThumbnail } from '../../hooks/useThumbnail';
import { useCanvas } from '../../hooks/useCanvas';
import { useCanvasStartTime } from '../../hooks/useCanvasStartTime';
import type { MediaStrategy } from '../../features/rendering-strategy/strategies';
import { getPlaceholderContainer, type CompatibleCanvas } from '../../utility/canvas-compat';

export interface VideoComponentProps {
  element: RefObject<HTMLVideoElement>;
  media: SingleVideo;
  playPause: () => void;
  canvas: CompatibleCanvas;
  poster?: string;
  startTime?: number;
  captions?: MediaStrategy['captions'];
}

export function VideoHTML({ element, media, startTime, playPause, poster }: VideoComponentProps) {
  const Component = 'div' as any;
  const mediaUrl = startTime ? `${media.url}#t=${startTime}` : media.url;

  return (
    <Component className="video-container" part="video-container" onClick={playPause}>
      <style>
        {`
            .video-container {
              position: absolute;
              top: 0;
              bottom: 0;
              left: 0;
              right: 0;
              background: #000;
              z-index: 13;
              display: flex;
              justify-content: center;
              pointer-events: visible;
            }
          `}
      </style>
      <video poster={poster} ref={element} src={mediaUrl} style={{ width: '100%', objectFit: 'contain' }} />
    </Component>
  );
}

export function Video({
  media,
  mediaControlsDeps,
  children,
  posterCanvasId: posterCanvasIdProp,
  videoComponent = VideoHTML,
  captions,
}: {
  media: SingleVideo;
  mediaControlsDeps?: any[];
  children: ReactNode;
  posterCanvasId?: string;
  videoComponent?: ComponentType<VideoComponentProps>;
  captions?: MediaStrategy['captions'];
}) {
  const canvas = useCanvas();
  const start = useCanvasStartTime();

  const placeholder = getPlaceholderContainer(canvas);
  const posterCanvasId = posterCanvasIdProp || (placeholder?.type === 'Canvas' ? placeholder.id : undefined);
  const poster = useThumbnail({}, false, { canvasId: posterCanvasId });
  const [{ element, currentTime, progress }, state, actions] = useSimpleMediaPlayer({ duration: media.duration });

  useOverlay(
    'overlay',
    'video-element',
    videoComponent,
    {
      element,
      media,
      playPause: actions.playPause,
      poster: poster?.id,
      canvas,
      startTime: start ? start.startTime : null,
      captions,
    },
    [poster]
  );

  useOverlay(
    'portal',
    'custom-controls',
    MediaPlayerProvider,
    {
      state: state,
      actions: actions,
      currentTime: currentTime,
      progress: progress,
      element: element,
      children,
    },
    [currentTime, state, media, ...(mediaControlsDeps || [])]
  );

  return null;
}
