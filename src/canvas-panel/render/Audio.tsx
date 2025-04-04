import type { ComponentType, ReactNode } from 'react';
import { MediaPlayerProvider } from '../../context/MediaContext';
import type { SingleAudio } from '../../features/rendering-strategy/resource-types';
import { useCanvasStartTime } from '../../hooks/useCanvasStartTime';
import { useSimpleMediaPlayer } from '../../hooks/useSimpleMediaPlayer';
import { useOverlay } from '../context/overlays';

export interface AudioComponentProps {
  media: SingleAudio;
  startTime?: number | null;
  children: ReactNode;
}

export function AudioHTML({ media, startTime, children }: AudioComponentProps) {
  const [{ element, currentTime, progress }, state, actions] =
    useSimpleMediaPlayer({ duration: media.duration });
  const mediaUrl = startTime ? `${media.url}#t=${startTime}` : media.url;

  return (
    <MediaPlayerProvider
      key={media.url}
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
  audioCopmonent = AudioHTML,
  children,
}: {
  media: SingleAudio;
  mediaControlsDeps?: any[];
  children: ReactNode;
  audioCopmonent?: ComponentType<AudioComponentProps>;
}) {
  const start = useCanvasStartTime();

  useOverlay(
    'portal',
    'audio',
    audioCopmonent,
    { media, startTime: start ? start.startTime : null, children },
    [media, start, ...(mediaControlsDeps || [])],
  );

  return null;
}
