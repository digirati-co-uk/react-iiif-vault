import { type ReactNode, useLayoutEffect, useRef, useState } from 'react';
import WaveSurfer, { type WaveSurferOptions } from 'wavesurfer.js';
import { useMediaElements } from '../context/MediaContext';

export type WaveformOptions = Omit<WaveSurferOptions, 'container' | 'media'>;

export interface WaveformProps {
  className?: string;
  loadingFallback: ReactNode;
  errorFallback: ReactNode;
  options?: WaveformOptions;
  onReady?: (waveform: WaveSurfer) => void;
  onError?: (error: Error) => void;
}

export default function Waveform({
  className,
  loadingFallback,
  errorFallback,
  options,
  onReady,
  onError,
}: WaveformProps) {
  const { element } = useMediaElements();
  const container = useRef<HTMLDivElement>(null);
  const initial = useRef({ options, onReady, onError });
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  useLayoutEffect(() => {
    const media = element.current;
    if (!container.current || !media || media.tagName !== 'AUDIO') return;

    const waveform = WaveSurfer.create({
      height: 128,
      waveColor: '#8c98a8',
      progressColor: '#ffffff',
      cursorColor: '#ffffff',
      cursorWidth: 1,
      barWidth: 2,
      barGap: 2,
      barRadius: 2,
      normalize: true,
      ...initial.current.options,
      container: container.current,
      media,
    });
    const offReady = waveform.on('ready', () => {
      setStatus('ready');
      initial.current.onReady?.(waveform);
    });
    const offError = waveform.on('error', (error) => {
      setStatus('error');
      initial.current.onError?.(error);
    });

    return () => {
      offReady();
      offError();
      waveform.destroy();
    };
  }, [element]);

  return (
    <div className="riv-waveform-visual">
      <div ref={container} className={['riv-waveform', className].filter(Boolean).join(' ')} />
      {status === 'loading' ? <div className="riv-waveform-status">{loadingFallback}</div> : null}
      {status === 'error' && errorFallback ? <div className="riv-waveform-status">{errorFallback}</div> : null}
    </div>
  );
}
