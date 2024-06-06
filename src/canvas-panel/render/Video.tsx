import { FC, ReactNode, RefObject } from 'react';
import { useSimpleMediaPlayer } from '../../hooks/useSimpleMediaPlayer';
import { SingleVideo } from '../../features/rendering-strategy/resource-types';
import { MediaPlayerProvider } from '../../context/MediaContext';
import { useOverlay } from '../context/overlays';

export interface VideoComponentProps {
  element: RefObject<HTMLVideoElement>;
  media: SingleVideo;
  playPause: () => void;
}

export function VideoHTML({ element, media, playPause }: VideoComponentProps) {
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
          `}
      </style>
      <video ref={element} src={media.url} style={{ width: '100%', objectFit: 'contain' }} />
    </Component>
  );
}

export function Video({
  media,
  mediaControlsDeps,
  children,
  videoComponent = VideoHTML,
}: {
  media: SingleVideo;
  mediaControlsDeps?: any[];
  children: ReactNode;
  videoComponent?: FC<VideoComponentProps>;
}) {
  const [{ element, currentTime, progress }, state, actions] = useSimpleMediaPlayer({ duration: media.duration });

  useOverlay('overlay', 'video-element', videoComponent, {
    element,
    media,
    playPause: actions.playPause,
  });

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
