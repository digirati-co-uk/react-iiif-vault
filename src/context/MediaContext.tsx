import {
  type ReactNode,
  type RefObject,
  createContext,
  useContext,
} from 'react';
import type {
  MediaPlayerActions,
  MediaPlayerState,
} from '../hooks/useSimpleMediaPlayer';

const MediaReactContextState = createContext<MediaPlayerState | null>(null);
const MediaReactContextActions = createContext<MediaPlayerActions | null>(null);
const MediaReactContextElements = createContext<{
  element: RefObject<HTMLAudioElement | HTMLVideoElement>;
  currentTime: RefObject<HTMLDivElement>;
  progress: RefObject<HTMLDivElement>;
} | null>(null);

export function useMediaState() {
  const ctx = useContext(MediaReactContextState);
  if (!ctx) {
    throw new Error('Ctx not found');
  }
  return ctx;
}

export function useMediaActions() {
  const ctx = useContext(MediaReactContextActions);
  if (!ctx) {
    throw new Error('Ctx not found');
  }
  return ctx;
}

export function useMediaElements() {
  const ctx = useContext(MediaReactContextElements);
  if (!ctx) {
    throw new Error('Ctx not found');
  }
  return ctx;
}

export function MediaPlayerProvider({
  actions,
  state,
  children,
  currentTime,
  progress,
  element,
}: {
  actions: MediaPlayerActions;
  state: MediaPlayerState;
  children: ReactNode;
  currentTime: RefObject<HTMLDivElement>;
  progress: RefObject<HTMLDivElement>;
  element: RefObject<HTMLAudioElement | HTMLVideoElement>;
}) {
  console.log(state.duration);
  return (
    <MediaReactContextElements.Provider
      value={{ currentTime, progress, element }}
    >
      <MediaReactContextActions.Provider value={actions}>
        <MediaReactContextState.Provider value={state}>
          {children}
        </MediaReactContextState.Provider>
      </MediaReactContextActions.Provider>
    </MediaReactContextElements.Provider>
  );
}
