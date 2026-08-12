import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useRef } from 'react';
import { describe, expect, test, vi } from 'vitest';
import { MediaPlayerProvider } from '../src/context/MediaContext';
import type { MediaPlayerActions, MediaPlayerState } from '../src/hooks/useSimpleMediaPlayer';
import { MediaControls } from '../src/waveform';

const waveSurfer = vi.hoisted(() => ({
  create: vi.fn(),
  destroy: vi.fn(),
}));

vi.mock('wavesurfer.js', () => ({
  default: { create: waveSurfer.create },
}));

function Controls({ actions, state }: { actions: MediaPlayerActions; state: MediaPlayerState }) {
  const element = useRef<HTMLAudioElement>(null);
  const currentTime = useRef<HTMLDivElement>(null);
  const progress = useRef<HTMLDivElement>(null);
  return (
    <MediaPlayerProvider
      actions={actions}
      state={state}
      element={element}
      currentTime={currentTime}
      progress={progress}
    >
      <audio ref={element} />
      <MediaControls waveformOptions={{ waveColor: '#123456' }} />
    </MediaPlayerProvider>
  );
}

describe('waveform media controls', () => {
  test('loads WaveSurfer for audio and delegates playback and seeking', async () => {
    const listeners = new Map<string, (...args: any[]) => void>();
    waveSurfer.create.mockReturnValue({
      on: vi.fn((event: string, listener: (...args: any[]) => void) => {
        listeners.set(event, listener);
        return vi.fn();
      }),
      destroy: waveSurfer.destroy,
    });
    const actions: MediaPlayerActions = {
      play: vi.fn(),
      pause: vi.fn(),
      playPause: vi.fn(),
      mute: vi.fn(),
      unmute: vi.fn(),
      toggleMute: vi.fn(),
      setVolume: vi.fn(),
      setDurationPercent: vi.fn(),
      setTime: vi.fn(),
    };
    const state: MediaPlayerState = {
      isPlaying: false,
      isMuted: false,
      playRequested: false,
      volume: 75,
      isFinished: false,
      duration: 120,
    };

    render(<Controls actions={actions} state={state} />);

    await waitFor(() => expect(waveSurfer.create).toHaveBeenCalledOnce());
    expect(waveSurfer.create.mock.calls[0][0]).toMatchObject({
      media: expect.any(HTMLAudioElement),
      waveColor: '#123456',
      barWidth: 2,
    });
    fireEvent.click(screen.getByRole('button', { name: 'Play' }));
    expect(actions.play).toHaveBeenCalledOnce();

    fireEvent.keyDown(screen.getByRole('button', { name: 'Seek' }), { key: 'ArrowRight' });
    const updateTime = vi.mocked(actions.setTime).mock.calls[0][0];
    expect(typeof updateTime === 'function' ? updateTime(10) : updateTime).toBe(15);

    act(() => listeners.get('ready')?.());
    expect(screen.queryByText('Loading waveform…')).toBeNull();
  });
});
