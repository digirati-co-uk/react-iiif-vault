import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { ComplexTimelineProvider } from '../src/context/ComplexTimelineContext';
import { ComplexTimelineControls } from '../src/demo/complex-timeline-controls';
import { createComplexTimelineStore } from '../src/future-helpers/complex-timeline-store';

test('the demo scrubber seeks in both directions and follows playback snapshots', () => {
  const controller = createComplexTimelineStore({
    complexTimeline: {
      type: 'complex-timeline',
      duration: 100,
      items: [],
      highlights: [],
      keyframes: [],
    },
  });
  const view = render(
    <ComplexTimelineProvider store={controller.store}>
      <ComplexTimelineControls />
    </ComplexTimelineProvider>
  );
  const slider = view.getByRole('slider', { name: 'Playback position' }) as HTMLInputElement;
  expect(slider.type).toBe('range');
  fireEvent.change(slider, { target: { value: '75' } });
  expect(controller.getSnapshot().primeTime).toBe(75);
  fireEvent.change(slider, { target: { value: '25' } });
  expect(controller.getSnapshot().primeTime).toBe(25);
  act(() => controller.getSnapshot().setTime(42));
  expect(slider.value).toBe('42');
  expect(slider.getAttribute('aria-valuetext')).toBe('0:42');
  view.unmount();
  controller.dispose();
});

test('the demo downloads only unseekable media in the background and releases blobs on unmount', async () => {
  const fetchMedia = vi.fn(async (_url: string, _options: RequestInit) => ({
    ok: true,
    blob: async () => new Blob(['audio']),
  }));
  vi.stubGlobal('fetch', fetchMedia);
  const createUrl = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:downloaded-audio');
  const revokeUrl = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  const controller = createComplexTimelineStore({
    complexTimeline: {
      type: 'complex-timeline',
      duration: 100,
      highlights: [],
      keyframes: ['a', 'b'].map((id) => ({ id, type: 'enter', time: 0, resourceType: 'audio', isPrime: id === 'a' })),
      items: ['a', 'b'].map(
        (id) =>
          ({
            type: 'Sound',
            annotationId: id,
            url: `https://example.org/${id}.mp3`,
            target: { type: 'TemporalSelector', temporal: { startTime: 0, endTime: 100 } },
          }) as any
      ),
    },
  });
  for (const id of ['a', 'b']) {
    const element = Object.assign(new EventTarget(), {
      currentTime: 0,
      readyState: 4,
      duration: 100,
      seekable: { length: 1, start: () => 0, end: () => (id === 'a' ? 0 : 100) },
      volume: 1,
      muted: false,
      paused: false,
      play: vi.fn(async () => {}),
      pause: vi.fn(),
    }) as unknown as HTMLMediaElement;
    controller.attachMediaElement(id, element);
  }
  controller.getSnapshot().play();
  const view = render(
    <ComplexTimelineProvider store={controller.store}>
      <ComplexTimelineControls />
    </ComplexTimelineProvider>
  );
  try {
    await waitFor(() =>
      expect((controller.getSnapshot().complexTimeline.items[0] as any).url).toBe('blob:downloaded-audio')
    );
    expect(fetchMedia).toHaveBeenCalledTimes(1);
    expect(fetchMedia.mock.calls[0][0]).toBe('https://example.org/a.mp3');
    expect((controller.getSnapshot().complexTimeline.items[1] as any).url).toBe('https://example.org/b.mp3');
    expect(controller.getSnapshot().isPlaying).toBe(true);
    view.unmount();
    expect(revokeUrl).toHaveBeenCalledWith('blob:downloaded-audio');
    expect((fetchMedia.mock.calls[0] as any)[1].signal.aborted).toBe(false);
  } finally {
    view.unmount();
    controller.dispose();
    createUrl.mockRestore();
    revokeUrl.mockRestore();
    vi.unstubAllGlobals();
  }
});
