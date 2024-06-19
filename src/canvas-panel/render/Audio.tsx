import { ReactNode } from 'react';
import { useSimpleMediaPlayer } from '../../hooks/useSimpleMediaPlayer';
import { SingleAudio } from '../../features/rendering-strategy/resource-types';
import { MediaPlayerProvider } from '../../context/MediaContext';
import { useOverlay } from '../context/overlays';
import { useCanvasStartTime } from '../../hooks/useCanvasStartTime';

export function AudioHTML({
  media,
  startTime,
  children,
}: {
  media: SingleAudio;
  startTime?: number | null;
  children: ReactNode;
}) {
  const [{ element, currentTime, progress }, state, actions] = useSimpleMediaPlayer({ duration: media.duration });
  const mediaUrl = startTime ? `${media.url}#t=${startTime}` : media.url;

  return (
    <MediaPlayerProvider
      state={state}
      actions={actions}
      currentTime={currentTime}
      progress={progress}
      element={element}
    >
      <audio ref={element} src={mediaUrl} />
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
  const start = useCanvasStartTime();

  useOverlay('portal', 'audio', AudioHTML, { media, startTime: start ? start.startTime : null, children }, [
    media,
    start,
    ...(mediaControlsDeps || []),
  ]);

  return null;
}
