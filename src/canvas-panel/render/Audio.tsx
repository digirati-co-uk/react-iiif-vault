import { ReactNode } from 'react';
import { useSimpleMediaPlayer } from '../../hooks/useSimpleMediaPlayer';
import { SingleAudio } from '../../features/rendering-strategy/resource-types';
import { MediaPlayerProvider } from '../../context/MediaContext';
import { CanvasPortal } from '../../context/PortalContext';

export function Audio({ media, children }: { media: SingleAudio; children: ReactNode }) {
  const [{ element, currentTime, progress }, state, actions] = useSimpleMediaPlayer({ duration: media.duration });

  return (
    <>
      <CanvasPortal>
        <MediaPlayerProvider
          state={state}
          actions={actions}
          currentTime={currentTime}
          progress={progress}
          element={element}
        >
          <audio ref={element} src={media.url} />
          {children}
        </MediaPlayerProvider>
      </CanvasPortal>
    </>
  );
}
