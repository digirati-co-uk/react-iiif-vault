import { ReactNode } from 'react';
import { useSimpleMediaPlayer } from '../../hooks/useSimpleMediaPlayer';
import { SingleAudio } from '../../features/rendering-strategy/resource-types';
import { MediaPlayerProvider } from '../../context/MediaContext';
import { useOverlay } from '../context/overlays';

export function AudioHTML({ media, children }: { media: SingleAudio; children: ReactNode }) {
  const [{ element, currentTime, progress }, state, actions] = useSimpleMediaPlayer({ duration: media.duration });

  return (
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
  );
}

export function Audio({
  media,
  mediaControlsDeps,
  children,
}: {
  media: SingleAudio;
  mediaControlsDeps?: any[];
  children: ReactNode;
}) {
  useOverlay('portal', 'audio', AudioHTML, { media, children }, [media, ...(mediaControlsDeps || [])]);

  return null;
}
