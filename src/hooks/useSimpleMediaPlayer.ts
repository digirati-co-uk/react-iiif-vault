import { RefObject, useCallback, useEffect, useReducer, useRef } from 'react';

type MediaPlayerAction =
  | { type: 'PLAY_PAUSE' }
  | { type: 'TOGGLE_MUTE' }
  | { type: 'MUTE' }
  | { type: 'UNMUTE' }
  | { type: 'SET_VOLUME'; volume: number }
  | { type: 'PLAY' }
  | { type: 'PLAY_REQUESTED' }
  | { type: 'PAUSE' }
  | { type: 'FINISHED' };

export type MediaPlayerState = {
  isPlaying: boolean;
  isMuted: boolean;
  playRequested: boolean;
  volume: number;
  isFinished: boolean;
  duration: number;
};

export type MediaPlayerActions = {
  play(): void;
  pause(): void;
  playPause(): void;
  mute(): void;
  unmute(): void;
  toggleMute(): void;
  setVolume(volume: number): void;
  setDurationPercent(percent: number): void;
  setTime(time: number | ((t: number) => number)): void;
};

function getDefaultState(duration: number): MediaPlayerState {
  return { isMuted: false, playRequested: false, isPlaying: false, isFinished: false, volume: 100, duration };
}

function reducer(state: MediaPlayerState, action: MediaPlayerAction) {
  switch (action.type) {
    case 'FINISHED':
      return { ...state, isFinished: true, isPlaying: false, playRequested: false };
    case 'PLAY_PAUSE':
      return { ...state, isFinished: false, isPlaying: !state.isPlaying };
    case 'PLAY_REQUESTED':
      return { ...state, isFinished: false, playRequested: true };
    case 'PAUSE':
      return { ...state, isPlaying: false };
    case 'PLAY':
      return { ...state, isFinished: false, playRequested: false, isPlaying: true };
    case 'MUTE':
      return { ...state, isMuted: true };
    case 'SET_VOLUME':
      return { ...state, volume: action.volume, isMuted: action.volume === 0 };
    case 'TOGGLE_MUTE':
      return { ...state, isMuted: !state.isMuted };
    case 'UNMUTE':
      return { ...state, isMuted: false };
  }
  return state;
}

export function formatTime(time: number) {
  const seconds = Math.round(time);
  return `${Math.floor(seconds / 60)}:${`${seconds % 60}`.padStart(2, '0')}`;
}

export function useSimpleMediaPlayer(props: { duration: number }): readonly [
  {
    element: RefObject<HTMLAudioElement | HTMLVideoElement>;
    currentTime: RefObject<HTMLDivElement>;
    progress: RefObject<HTMLDivElement>;
  },
  MediaPlayerState,
  MediaPlayerActions,
] {
  const [state, dispatch] = useReducer(reducer, getDefaultState(props.duration));

  const media = useRef<HTMLAudioElement | HTMLVideoElement>(null);
  const currentTime = useRef<HTMLDivElement>(null);
  const progress = useRef<HTMLDivElement>(null);
  const _isMuted = useRef(false);

  const _updateCurrentTime = useCallback(() => {
    if (currentTime.current && media.current) {
      currentTime.current.innerHTML = formatTime(media.current.currentTime);
      if (progress.current) {
        progress.current.style.width = `${(media.current.currentTime / props.duration) * 100}%`;
      }
      if (_isMuted.current !== media.current.muted) {
        _isMuted.current = media.current.muted;
        dispatch(media.current.muted ? { type: 'MUTE' } : { type: 'UNMUTE' });
      }
    }
  }, [props.duration]);

  const play = useCallback(() => {
    if (media.current) {
      dispatch({ type: 'PLAY_REQUESTED' });
      media.current.play().then(() => {
        dispatch({ type: 'PLAY' });
      });
      _updateCurrentTime();
    }
  }, [_updateCurrentTime]);

  const playPause = useCallback(() => {
    if (media.current) {
      if (media.current.duration > 0 && media.current.paused) {
        play();
      } else {
        pause();
      }
    }
  }, [_updateCurrentTime]);

  const pause = useCallback(() => {
    if (media.current) {
      media.current.pause();
      dispatch({ type: 'PAUSE' });
      _updateCurrentTime();
    }
  }, [_updateCurrentTime]);

  const toggleMute = useCallback(() => {
    if (media.current) {
      media.current.muted = !media.current.muted;
      dispatch(media.current.muted ? { type: 'MUTE' } : { type: 'UNMUTE' });
    }
  }, []);

  const mute = useCallback(() => {
    if (media.current) {
      media.current.muted = true;
      dispatch({ type: 'MUTE' });
    }
  }, []);

  const unmute = useCallback(() => {
    if (media.current) {
      media.current.muted = false;
      dispatch({ type: 'UNMUTE' });
    }
  }, []);

  const setVolume = useCallback((newVolume: number) => {
    if (media.current) {
      media.current.muted = false;
      media.current.volume = newVolume / 100;
      dispatch({ type: 'SET_VOLUME', volume: newVolume });
    }
  }, []);

  const setDurationPercent = useCallback((percent: number) => {
    if (media.current) {
      media.current.currentTime = Math.max(0, Math.min(percent * props.duration, props.duration));
      _updateCurrentTime();
    }
  }, []);

  const setTime = useCallback((time: number | ((t: number) => number)) => {
    if (media.current) {
      let newTime = typeof time === 'function' ? time(media.current.currentTime) : time;
      media.current.currentTime = Math.max(0, Math.min(newTime, props.duration));
      _updateCurrentTime();
    }
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      _updateCurrentTime();
    }, 350);

    return () => clearInterval(interval);
  }, [_updateCurrentTime, props.duration]);

  useEffect(() => {
    const ended = () => {
      dispatch({ type: 'FINISHED' });
    };
    const _media = media.current;

    _media?.addEventListener('ended', ended);

    return () => _media?.removeEventListener('ended', ended);
  }, []);

  return [
    { element: media, currentTime, progress },
    state,
    {
      play,
      pause,
      playPause,
      mute,
      unmute,
      toggleMute,
      setVolume,
      setDurationPercent,
      setTime,
    },
  ];
}
