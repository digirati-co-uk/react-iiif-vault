import { afterEach, expect, test, vi } from 'vitest';
import { createComplexTimelineStore, resolveKeyframeChanges } from '../src/future-helpers/complex-timeline-store';
import type { ComplexTimelineStrategy, TimelineKeyframe } from '../src/features/rendering-strategy/strategies';

const keyframes: TimelineKeyframe[] = [
  { id: 'a', type: 'enter', time: 0, resourceType: 'video', isPrime: true },
  { id: 'b', type: 'enter', time: 2, resourceType: 'audio' },
  { id: 'a', type: 'exit', time: 5, resourceType: 'video' },
  { id: 'b', type: 'change', time: 5, resourceType: 'audio', isPrime: true },
  { id: 'b', type: 'exit', time: 10, resourceType: 'audio' },
];
function timeline(media = true): ComplexTimelineStrategy {
  return {
    type: 'complex-timeline',
    duration: 10,
    highlights: [],
    keyframes,
    items: media
      ? ['a', 'b'].map(
          (id, i) =>
            ({
              type: i ? 'Sound' : 'Video',
              annotationId: id,
              url: 'same.mp4',
              target: { type: 'TemporalSelector', temporal: { startTime: i * 2, endTime: i ? 10 : 5 } },
              selector: { type: 'TemporalSelector', temporal: { startTime: i ? 7 : 0 } },
            }) as any
        )
      : [],
  };
}
function media() {
  const el = new EventTarget() as HTMLMediaElement;
  Object.assign(el, {
    currentTime: 0,
    readyState: 4,
    volume: 1,
    muted: false,
    paused: true,
    ended: false,
    play: vi.fn(() => {
      Object.assign(el, { paused: false });
      return Promise.resolve();
    }),
    pause: vi.fn(() => {
      Object.assign(el, { paused: true });
    }),
  });
  return el;
}
afterEach(() => {
  vi.unstubAllGlobals();
});

test('final keyframes, backward seeks, prime transitions and public time snapshot', () => {
  const controller = createComplexTimelineStore({ complexTimeline: timeline(false) });
  const state = controller.store.getState();
  const listener = vi.fn();
  controller.subscribe(listener);
  expect(state.isReady).toBe(true);
  state.setTime(6);
  expect(controller.getSnapshot().currentPrime?.id).toBe('b');
  expect(controller.getSnapshot().currentPrime?.time).toBe(2);
  state.setTime(10);
  expect(controller.getSnapshot().visibleElements.a).toBeNull();
  expect(controller.getSnapshot().visibleElements.b).toBeNull();
  expect(controller.getSnapshot().nextKeyframeIndex).toBe(keyframes.length);
  expect(controller.getSnapshot().primeTime).toBe(10);
  state.setTime(1);
  expect(controller.getSnapshot().visibleElements.a).toBeTruthy();
  expect(controller.getSnapshot().visibleElements.b).toBeUndefined();
  expect(listener).toHaveBeenCalled();
  controller.dispose();
});

test('attachment cleanup owns the exact binding and readiness follows registration', () => {
  const controller = createComplexTimelineStore({ complexTimeline: timeline() });
  const first = media();
  const replacement = media();
  const other = media();
  const oldCleanup = controller.attachMediaElement('a', first);
  const newCleanup = controller.attachMediaElement('a', replacement);
  controller.attachMediaElement('b', other);
  oldCleanup();
  expect(controller.getSnapshot().isReady).toBe(true);
  expect(first.pause).toHaveBeenCalled();
  controller.getSnapshot().setTime(3);
  controller.getSnapshot().play();
  expect(other.currentTime).toBe(8); // Source crop starts at 7, canvas interval starts at 2.
  expect(replacement.play).toHaveBeenCalled();
  newCleanup();
  expect(controller.getSnapshot().isReady).toBe(false);
  expect(replacement.pause).toHaveBeenCalled();
  controller.dispose();
  expect(other.pause).toHaveBeenCalled();
  other.dispatchEvent(new Event('waiting'));
  expect(controller.getSnapshot().isBuffering).toBe(false);
});

test('clocks restart without a time jump, stop at the end, and dispose cancels RAF', () => {
  let callback: FrameRequestCallback;
  let next = 0;
  vi.stubGlobal(
    'requestAnimationFrame',
    vi.fn((fn) => {
      callback = fn;
      return next++;
    })
  );
  const cancel = vi.fn();
  vi.stubGlobal('cancelAnimationFrame', cancel);
  const controller = createComplexTimelineStore({ complexTimeline: timeline(false) });
  const state = controller.getSnapshot();
  state.startClock();
  state.play();
  callback!(100_000);
  callback!(101_000);
  expect(controller.getSnapshot().primeTime).toBe(1);
  state.stopClock();
  state.startClock();
  callback!(200_000);
  expect(controller.getSnapshot().primeTime).toBe(1);
  callback!(210_000);
  expect(controller.getSnapshot().primeTime).toBe(10);
  expect(controller.getSnapshot().isFinished).toBe(true);
  expect(controller.getSnapshot().isPlaying).toBe(false);
  controller.dispose();
  expect(cancel).toHaveBeenCalled();
  expect(controller.getSnapshot().clockRunning).toBe(false);
});

test('native buffering/pause and rejected play are observable and removed on detach', async () => {
  const controller = createComplexTimelineStore({ complexTimeline: timeline() });
  const a = media();
  const b = media();
  controller.attachMediaElement('a', a);
  controller.attachMediaElement('b', b);
  const state = controller.getSnapshot();
  state.play();
  a.dispatchEvent(new Event('waiting'));
  expect(controller.getSnapshot().isBuffering).toBe(true);
  a.dispatchEvent(new Event('playing'));
  expect(controller.getSnapshot().isBuffering).toBe(false);
  Object.assign(a, { paused: true });
  a.dispatchEvent(new Event('pause'));
  expect(controller.getSnapshot().isPlaying).toBe(false);
  const error = new Error('Autoplay denied');
  a.play = vi.fn(() => Promise.reject(error));
  state.play();
  expect(a.play).toHaveBeenCalled();
  await vi.waitFor(() => expect(controller.getSnapshot().playbackError).toBe(error));
  expect(controller.getSnapshot().playbackError).toBe(error);
  expect(controller.getSnapshot().isPlaying).toBe(false);
  controller.dispose();
});

test('annotation updates preserve playback, and two controllers for the same resource are independent', () => {
  const source = timeline(false);
  const one = createComplexTimelineStore({ complexTimeline: source });
  const two = createComplexTimelineStore({ complexTimeline: source });
  one.getSnapshot().setTime(3);
  one.getSnapshot().play();
  one.getSnapshot().updateTimeline({ ...source, annotations: { pages: [] } });
  expect(one.getSnapshot().primeTime).toBe(3);
  expect(one.getSnapshot().isPlaying).toBe(true);
  expect(two.getSnapshot().primeTime).toBe(0);
  expect(two.getSnapshot().isPlaying).toBe(false);
  one.dispose();
  two.dispose();
});

test('media readiness waits for data and handles detach before a rejected play settles', async () => {
  const controller = createComplexTimelineStore({ complexTimeline: timeline() });
  const a = media();
  const b = media();
  Object.assign(a, { readyState: 0 });
  const detach = controller.attachMediaElement('a', a);
  controller.attachMediaElement('b', b);
  expect(controller.getSnapshot().isReady).toBe(false);
  Object.assign(a, { readyState: 4 });
  a.dispatchEvent(new Event('loadeddata'));
  expect(controller.getSnapshot().isReady).toBe(true);
  let reject: (error: unknown) => void;
  a.play = vi.fn(
    () =>
      new Promise<void>((_, fn) => {
        reject = fn;
      })
  );
  controller.getSnapshot().play();
  detach();
  controller.attachMediaElement('a', media());
  reject!(new Error('Old attachment failed'));
  await Promise.resolve();
  expect(controller.getSnapshot().playbackError).toBeNull();
  expect(controller.getSnapshot().isPlaying).toBe(true);
  controller.dispose();
});

test('native canplay/playing events never seek back into a buffering loop', () => {
  const controller = createComplexTimelineStore({ complexTimeline: timeline() });
  const a = media();
  const b = media();
  controller.attachMediaElement('a', a);
  controller.attachMediaElement('b', b);
  let currentTime = 0;
  const seeks = vi.fn((value: number) => {
    currentTime = value;
  });
  Object.defineProperty(a, 'currentTime', { get: () => currentTime, set: seeks });
  controller.getSnapshot().play();
  for (let i = 0; i < 10; i++) {
    a.dispatchEvent(new Event('canplay'));
    a.dispatchEvent(new Event('playing'));
  }
  expect(seeks).not.toHaveBeenCalled();
  controller.dispose();
});

test('a playing seek is not overwritten by the native clock before seeking completes', () => {
  let callback: FrameRequestCallback;
  vi.stubGlobal(
    'requestAnimationFrame',
    vi.fn((fn) => {
      callback = fn;
      return 1;
    })
  );
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  const controller = createComplexTimelineStore({ complexTimeline: timeline() });
  const a = media();
  const b = media();
  controller.attachMediaElement('a', a);
  controller.attachMediaElement('b', b);
  let nativeTime = 0;
  const seeks = vi.fn(() => {
    Object.assign(a, { seeking: true });
  });
  Object.defineProperty(a, 'currentTime', { get: () => nativeTime, set: seeks });
  const state = controller.getSnapshot();
  state.startClock();
  state.play();
  callback!(1000);
  state.setTime(4);
  callback!(1016);
  expect(controller.getSnapshot().primeTime).toBe(4);
  expect(seeks.mock.calls).toHaveLength(1);
  nativeTime = 4.2;
  Object.assign(a, { seeking: false });
  callback!(1032);
  expect(controller.getSnapshot().primeTime).toBe(4.2);
  state.setTime(1);
  callback!(1048);
  expect(controller.getSnapshot().primeTime).toBe(1);
  expect(seeks.mock.calls).toHaveLength(2);
  nativeTime = 1.1;
  Object.assign(a, { seeking: false });
  callback!(1064);
  expect(controller.getSnapshot().primeTime).toBe(1.1);
  controller.dispose();
});

test('an unseekable stream reports the failed seek without resetting playing media', () => {
  const controller = createComplexTimelineStore({ complexTimeline: timeline() });
  const a = media();
  const b = media();
  controller.attachMediaElement('a', a);
  controller.attachMediaElement('b', b);
  controller.getSnapshot().setTime(1);
  controller.getSnapshot().play();
  Object.assign(a, { seekable: { length: 1, start: () => 0, end: () => 0 } });
  const seeks = vi.fn();
  Object.defineProperty(a, 'currentTime', { get: () => 1, set: seeks });
  controller.getSnapshot().setTime(4);
  expect(seeks).not.toHaveBeenCalled();
  expect(controller.getSnapshot().primeTime).toBe(1);
  expect(controller.getSnapshot().isPlaying).toBe(true);
  expect(controller.getSnapshot().playbackError).toBeInstanceOf(Error);
  controller.dispose();
});
