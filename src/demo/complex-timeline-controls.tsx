import { useEffect, useRef, useState } from 'react';
import { useComplexTimeline, useComplexTimelineStore } from '../context/ComplexTimelineContext';
import { formatTime } from '../hooks/useSimpleMediaPlayer';

export function ComplexTimelineControls() {
  const store = useComplexTimelineStore();
  const download = useRef<AbortController>();
  const objectUrls = useRef(new Map<string, string>());
  const [downloadStatus, setDownloadStatus] = useState('');
  const attemptedSources = useRef(new Set<string>());
  useEffect(
    () => () => {
      download.current?.abort();
      for (const url of objectUrls.current.values()) URL.revokeObjectURL(url);
      objectUrls.current.clear();
      attemptedSources.current.clear();
      download.current = undefined;
    },
    [store]
  );

  async function downloadMedia() {
    if (download.current && !download.current.signal.aborted) return;
    const { complexTimeline: timeline, unseekableMedia } = store.getState();
    const abort = new AbortController();
    download.current = abort;

    setDownloadStatus('Preparing media for seeking in the background…');
    const sources = new Map<string, string>();
    try {
      for (const item of timeline.items) {
        if (
          !unseekableMedia.includes(item.annotationId) ||
          (item.type !== 'Sound' && item.type !== 'Video') ||
          item.url.startsWith('blob:') ||
          sources.has(item.url)
        )
          continue;
        attemptedSources.current.add(item.url);
        const response = await fetch(item.url, { signal: abort.signal });
        if (!response.ok) throw new Error(`Download failed: ${response.status}`);
        const blob = await response.blob();
        if (abort.signal.aborted) return;
        const url = URL.createObjectURL(blob);
        objectUrls.current.set(item.url, url);
        sources.set(item.url, url);
      }
      if (abort.signal.aborted) return;
      const current = store.getState().complexTimeline;
      store
        .getState()
        .updateTimeline({
          ...current,
          items: current.items.map((item) =>
            (item.type === 'Sound' || item.type === 'Video') && sources.has(item.url)
              ? { ...item, url: sources.get(item.url)! }
              : item
          ),
        });
      setDownloadStatus('');
    } catch (error) {
      if (!abort.signal.aborted) setDownloadStatus(error instanceof Error ? error.message : 'Download failed.');
    } finally {
      if (download.current === abort) download.current = undefined;
    }
  }

  const {
    play,
    pause,
    setVolume,
    toggleMute,
    setTime,
    primeTime,
    duration,
    isMuted,
    volume,
    isPlaying,
    isReady,
    unseekableMedia,
    playRequested,
    playbackError,
    complexTimeline,
  } = useComplexTimeline((s) => s);

  useEffect(() => {
    // Keep downloaded sources when annotation or image-service updates rebuild the strategy.
    if (
      complexTimeline.items.some(
        (item) => (item.type === 'Sound' || item.type === 'Video') && objectUrls.current.has(item.url)
      )
    ) {
      store
        .getState()
        .updateTimeline({
          ...complexTimeline,
          items: complexTimeline.items.map((item) =>
            (item.type === 'Sound' || item.type === 'Video') && objectUrls.current.has(item.url)
              ? { ...item, url: objectUrls.current.get(item.url)! }
              : item
          ),
        });
      return;
    }
    if (
      unseekableMedia.length &&
      complexTimeline.items.some(
        (item) =>
          unseekableMedia.includes(item.annotationId) &&
          (item.type === 'Sound' || item.type === 'Video') &&
          !item.url.startsWith('blob:') &&
          !attemptedSources.current.has(item.url)
      )
    ) {
      void downloadMedia();
    }
  }, [unseekableMedia.join(','), complexTimeline.items]);

  return (
    <>
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
        <div style={{ padding: '0 20px' }}>{formatTime(primeTime)}</div>
        <input
          type="range"
          aria-label="Playback position"
          aria-valuetext={formatTime(primeTime)}
          min={0}
          max={duration}
          step={0.1}
          value={primeTime}
          onChange={(e) => setTime(Number(e.currentTarget.value))}
          style={{ flex: '1 1 0px', minWidth: 0 }}
        />
        <div style={{ padding: '0 20px' }}>{formatTime(duration)}</div>

        <div style={{ display: 'flex' }}>
          <input
            type="range"
            aria-label="Volume"
            role="slider"
            disabled={isMuted}
            min="0"
            max="100"
            value={volume}
            onChange={(e) => setVolume(Number(e.currentTarget.value))}
          />

          <button onClick={() => toggleMute()}>{isMuted ? 'Unmute' : 'Mute'}</button>
        </div>
      </div>
      {downloadStatus ? <p role="status">{downloadStatus}</p> : null}
      {playbackError ? (
        <p role="status">{playbackError instanceof Error ? playbackError.message : 'Playback failed.'}</p>
      ) : null}
    </>
  );
}
