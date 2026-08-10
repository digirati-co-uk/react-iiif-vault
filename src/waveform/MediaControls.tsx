import {
  lazy,
  Suspense,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
  useLayoutEffect,
  useState,
} from 'react';
import type WaveSurfer from 'wavesurfer.js';
import { useMediaActions, useMediaElements, useMediaState } from '../context/MediaContext';
import { formatTime } from '../hooks/useSimpleMediaPlayer';
import type { WaveformOptions } from './Waveform';

const Waveform = lazy(() => import('./Waveform'));

const defaultLabels = {
  play: 'Play',
  pause: 'Pause',
  seek: 'Seek',
  volume: 'Volume',
  mute: 'Mute',
  unmute: 'Unmute',
  loading: 'Loading waveform…',
  error: 'Waveform unavailable',
};

export interface MediaControlsProps {
  className?: string;
  style?: CSSProperties;
  waveformOptions?: WaveformOptions;
  loadingFallback?: ReactNode;
  errorFallback?: ReactNode;
  labels?: Partial<typeof defaultLabels>;
  onWaveformReady?: (waveform: WaveSurfer) => void;
  onWaveformError?: (error: Error) => void;
}

export function MediaControls({
  className,
  style,
  waveformOptions,
  loadingFallback,
  errorFallback,
  labels: customLabels,
  onWaveformReady,
  onWaveformError,
}: MediaControlsProps = {}) {
  const { progress, currentTime, element } = useMediaElements();
  const { duration, isMuted, volume, isPlaying, playRequested } = useMediaState();
  const { play, pause, setVolume, toggleMute, setDurationPercent, setTime } = useMediaActions();
  const [isAudio, setIsAudio] = useState(false);
  const labels = { ...defaultLabels, ...customLabels };

  useLayoutEffect(() => {
    setIsAudio(element.current?.tagName === 'AUDIO');
  }, [element]);

  const seekWithKeyboard = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    setTime((time) => time + (event.key === 'ArrowLeft' ? -5 : 5));
  };

  return (
    <div
      className={['riv-waveform-media-controls', className].filter(Boolean).join(' ')}
      style={style}
      data-waveform={isAudio || undefined}
    >
      {isAudio ? (
        <Suspense fallback={<div className="riv-waveform-status">{loadingFallback ?? labels.loading}</div>}>
          <Waveform
            options={waveformOptions}
            loadingFallback={loadingFallback ?? labels.loading}
            errorFallback={errorFallback === undefined ? labels.error : errorFallback}
            onReady={onWaveformReady}
            onError={onWaveformError}
          />
        </Suspense>
      ) : null}
      <button
        type="button"
        className="riv-waveform-seek"
        aria-label={labels.seek}
        onKeyDown={seekWithKeyboard}
        onClick={(event) => {
          if (!event.detail) return;
          const { left, width } = event.currentTarget.getBoundingClientRect();
          setDurationPercent((event.clientX - left) / width);
        }}
      >
        <span ref={progress} />
      </button>
      <div className="riv-waveform-toolbar">
        <button
          type="button"
          className="riv-waveform-button"
          disabled={playRequested}
          aria-label={isPlaying || playRequested ? labels.pause : labels.play}
          onClick={isPlaying ? pause : play}
        >
          {isPlaying || playRequested ? labels.pause : labels.play}
        </button>
        <div className="riv-waveform-time">
          <span ref={currentTime}>0:00</span>
          <span aria-hidden="true"> / </span>
          <span>{formatTime(duration)}</span>
        </div>
        <label className="riv-waveform-volume">
          <span>{labels.volume}</span>
          <input
            type="range"
            min="0"
            max="100"
            value={volume}
            aria-label={labels.volume}
            onChange={(event) => setVolume(Number(event.currentTarget.value))}
          />
        </label>
        <button
          type="button"
          className="riv-waveform-button"
          aria-label={isMuted ? labels.unmute : labels.mute}
          aria-pressed={isMuted}
          onClick={toggleMute}
        >
          {isMuted ? labels.unmute : labels.mute}
        </button>
      </div>
    </div>
  );
}
