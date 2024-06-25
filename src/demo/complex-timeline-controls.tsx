import { useLayoutEffect, useRef } from 'react';
import { useComplexTimeline } from '../context/ComplexTimelineContext';
import { formatTime } from '../hooks/useSimpleMediaPlayer';

export function ComplexTimelineControls() {
  const {
    play,
    pause,
    setVolume,
    toggleMute,
    setDurationPercent,
    duration,
    isMuted,
    volume,
    isPlaying,
    isReady,
    playRequested,
    setProgressElement,
    setCurrentTimeElement,
    clearProgressElement,
    clearCurrentTimeElement,
  } = useComplexTimeline((s) => s);

  const progress = useRef<HTMLDivElement>(null);
  const currentTime = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (progress.current) {
      setProgressElement(progress.current);
    }

    if (currentTime.current) {
      setCurrentTimeElement(currentTime.current);
    }

    return () => {
      clearProgressElement();
      clearCurrentTimeElement();
    };
  }, [isReady]);

  return (
    <div style={{ display: 'flex', alignItems: 'center', opacity: isReady ? 1 : 0.5 }}>
      <button
        disabled={playRequested}
        onClick={() => {
          if (isPlaying) {
            pause();
          } else {
            play();
          }
        }}
      >
        {isPlaying || playRequested ? 'pause' : 'play'}
      </button>
      <div ref={currentTime} style={{ padding: '0 20px' }}>
        0:00
      </div>
      <div
        style={{
          flex: ' 1 1 0px',
          height: '6px',
          display: 'flex',
          position: 'relative',
          padding: '15px 0',
        }}
        onClick={(e) => {
          const { left, width } = e.currentTarget.getBoundingClientRect();
          const percent = (e.pageX - left) / width;
          console.log('setting percent', percent);
          setDurationPercent(percent);
        }}
      >
        <div
          style={{
            height: '6px',
            pointerEvents: 'none',
            position: 'absolute',
            top: '13px',
            left: '0',
            right: 0,
            borderRadius: '3px',
            transition: 'width 200ms',
            background: '#f9f9f9',
          }}
        />
        {duration ? (
          <div
            style={{
              position: 'absolute',
              top: '13px',
              left: '0',
              height: '6px',
              borderRadius: '3px',
              background: 'cornflowerblue',
              width: '100%',
              pointerEvents: 'none',
            }}
            ref={progress}
          />
        ) : null}
      </div>
      <div style={{ padding: '0 20px' }}>{formatTime(duration)}</div>

      <div style={{ display: 'flex' }}>
        <input
          type="range"
          id="audio-slider"
          role="slider"
          disabled={isMuted}
          min="0"
          max="100"
          value={volume}
          onChange={(e) => setVolume(Number(e.currentTarget.value))}
        />

        <button onClick={() => toggleMute()}>{isMuted ? 'Mute' : 'Unmute'}</button>
      </div>
    </div>
  );
}
