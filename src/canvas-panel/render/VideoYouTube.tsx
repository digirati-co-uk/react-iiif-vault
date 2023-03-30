import { useSimpleMediaPlayer } from '../../hooks/useSimpleMediaPlayer';
import { useOverlay } from '../context/overlays';
import { SingleYouTubeVideo } from '../../features/rendering-strategy/resource-types';
import { ReactNode, RefObject, useRef } from 'react';

export function VideoYouTubeHTML({
  element,
  media,
  playPause,
}: {
  element: RefObject<any>;
  media: SingleYouTubeVideo;
  playPause: () => void;
}) {
  const player = useRef<HTMLIFrameElement>(null);

  if (!media.youTubeId) {
    return null;
  }

  const Component = 'div' as any;
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
            .video-yt {
              border: none;
              width: 100%;
              object-fit: contain;
            }
          `}
      </style>
      <iframe
        className="video-yt"
        ref={player}
        src={`https://www.youtube.com/embed/${media.youTubeId}?enablejsapi=1&origin=${window.location.host}`}
        referrerPolicy="no-referrer"
        sandbox="allow-scripts allow-same-origin allow-presentation"
      ></iframe>
    </Component>
  );
}

export function VideoYouTube({
  media,
  mediaControlsDeps,
  children,
}: {
  media: SingleYouTubeVideo;
  mediaControlsDeps?: any[];
  children: ReactNode;
}) {
  const [{ element, currentTime, progress }, state, actions] = useSimpleMediaPlayer({ duration: media.duration });

  useOverlay('overlay', 'video-element', VideoYouTubeHTML, {
    element,
    media,
    playPause: actions.playPause,
  });

  return null;
}
