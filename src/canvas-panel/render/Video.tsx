import { ReactNode } from 'react';
import { useSimpleMediaPlayer } from '../../hooks/useSimpleMediaPlayer';
import { SingleAudio, SingleVideo } from '../../features/rendering-strategy/resource-types';
import { MediaPlayerProvider } from '../../context/MediaContext';
import { CanvasPortal } from '../../context/PortalContext';

export function Video({ media, children }: { media: SingleVideo; children: ReactNode }) {
  const [{ element, currentTime, progress }, state, actions] = useSimpleMediaPlayer({ duration: media.duration });
  const Component = 'div' as any;

  return (
    <>
      <CanvasPortal overlay>
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
        <Component className="video-container" part="video-container" onClick={() => actions.playPause()}>
          <video ref={element as any} src={media.url} style={{ width: '100%', objectFit: 'contain' }} />
        </Component>
      </CanvasPortal>
      <CanvasPortal>
        <MediaPlayerProvider
          state={state}
          actions={actions}
          currentTime={currentTime}
          progress={progress}
          element={element}
        >
          {children}
        </MediaPlayerProvider>
      </CanvasPortal>
    </>
  );
}
