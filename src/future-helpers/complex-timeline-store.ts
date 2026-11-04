import mitt from 'mitt';
import { createStore } from 'zustand/vanilla';
import type { SingleAudio, SingleVideo } from '../features/rendering-strategy/resource-types';
import type { ComplexTimelineStrategy, TimelineKeyframe } from '../features/rendering-strategy/strategies';
import { formatTime, type MediaPlayerActions } from '../hooks/useSimpleMediaPlayer';

export interface ComplexTimelineStore extends MediaPlayerActions {
  complexTimeline: ComplexTimelineStrategy;
  visibleElements: Record<string, TimelineKeyframe | null>;
  isReady: boolean;
  unseekableMedia: string[];

  // Buffering
  isBuffering: boolean;
  bufferMap: Record<string, boolean>;

  // Media player actions are included too (e.g. play/pause etc.)
  // Compat media player (so it all just works)
  isMuted: boolean;
  playRequested: boolean;
  isPlaying: boolean;
  isFinished: boolean;
  volume: number;

  // Clock management
  duration: number;
  primeTime: number;
  clockRunning: boolean;
  clockStartTime: number;
  currentPrime: TimelineKeyframe | null;
  clockStartRequests: number; // When it's zero we stop the clock.
  startClock: () => void;
  stopClock: () => void;

  playbackError: unknown | null;
  attachMediaElement: (id: string, element: HTMLMediaElement) => () => void;
  dispose: () => void;
  updateTimeline: (timeline: ComplexTimelineStrategy) => void;

  // Element management
  setElement: (id: string, element: HTMLVideoElement | HTMLAudioElement) => void;
  removeElement: (id: string) => void;

  applyKeyframes(newIdx: number, keyframes: TimelineKeyframe[]): void;

  // Keyframe
  nextKeyframeIndex: number;

  // Interative elements
  setProgressElement(div: HTMLDivElement): void;
  setCurrentTimeElement(div: HTMLDivElement): void;
  clearProgressElement(): void;
  clearCurrentTimeElement(): void;
}

export type ComplexTimelineEvents = {
  'complex-timeline.ready': { complexTimeline: ComplexTimelineStrategy };
  'complex-timeline.keyframe': { keyframe: TimelineKeyframe };
  'complex-timeline.prime-change': { prime: TimelineKeyframe | null };
  'complex-timeline.buffering': { id: string; isBuffering: boolean };
  'complex-timeline.finished-buffering': {};
  'complex-timeline.play': { id: string };
  'complex-timeline.pause': { id: string };

  // Hide/show events
  'complex-timeline.exit': { id: string };
  'complex-timeline.enter': { id: string };
};

export function resolveKeyframeChanges({
  currentKeyFrameIndex,
  keyframes,
  targetTime,
  currentTime,
}: {
  currentTime: number;
  targetTime: number;
  currentKeyFrameIndex: number;
  keyframes: TimelineKeyframe[];
}): [number, TimelineKeyframe[]] {
  if (currentTime <= targetTime) {
    const foundIndex = keyframes.findIndex((keyframe) => keyframe.time > targetTime);

    const nextTargetIndex = foundIndex === -1 ? keyframes.length : foundIndex;
    // Record the keyframes we found, and discard any that enter and exit.
    const found: Record<string, TimelineKeyframe> = {};
    const keyframesToCheck = keyframes.slice(currentKeyFrameIndex, nextTargetIndex);
    for (const keyframe of keyframesToCheck) {
      if (keyframe.type === 'enter') {
        found[keyframe.id] = keyframe;
      }
      if (keyframe.type === 'change') {
        found[keyframe.id] =
          found[keyframe.id]?.type === 'enter' ? { ...found[keyframe.id], isPrime: keyframe.isPrime } : keyframe;
      }
      if (keyframe.type === 'exit') {
        if (found[keyframe.id]) {
          delete found[keyframe.id];
        } else {
          found[keyframe.id] = keyframe;
        }
      }
    }

    return [nextTargetIndex, Object.values(found)];
  }

  return [currentKeyFrameIndex, []] as const;
}

export type ComplexTimelineController = ReturnType<typeof createComplexTimelineStore>;

export function createComplexTimelineStore({
  complexTimeline,
  startTime = 0,
}: {
  complexTimeline: ComplexTimelineStrategy;
  startTime?: number;
}) {
  const emitter = mitt<ComplexTimelineEvents>();
  const elements = new Map<string, { element: HTMLMediaElement; cleanup: () => void }>();
  let disposed = false;
  let frame: number | null = null;
  let lastFrame: number | null = null;
  let progress: HTMLDivElement | null = null;
  let timeElement: HTMLDivElement | null = null;

  const mediaItems = () =>
    store
      .getState()
      .complexTimeline.items.filter(
        (item): item is SingleAudio | SingleVideo => item.type === 'Video' || item.type === 'Sound'
      );
  function ready() {
    const isReady =
      !disposed && mediaItems().every((item) => (elements.get(item.annotationId)?.element.readyState || 0) >= 2);
    const wasReady = store.getState().isReady;
    const unseekableMedia = mediaItems()
      .filter((item) => {
        const element = elements.get(item.annotationId)?.element;
        if (!element || element.readyState < 2 || !Number.isFinite(element.duration) || element.duration <= 0)
          return false;
        const ranges = element.seekable;
        return (
          !ranges?.length ||
          !Array.from({ length: ranges.length }, (_, i) => ranges.end(i) > ranges.start(i)).some(Boolean)
        );
      })
      .map((item) => item.annotationId);
    store.setState({ isReady, unseekableMedia });
    if (isReady && !wasReady)
      emitter.emit('complex-timeline.ready', { complexTimeline: store.getState().complexTimeline });
  }
  function publishTime(time: number) {
    store.setState({ primeTime: time });
    if (timeElement) timeElement.textContent = formatTime(time);
    if (progress) progress.style.width = `${store.getState().duration ? (time / store.getState().duration) * 100 : 0}%`;
  }
  function mediaTime(id: string, time: number) {
    const item = mediaItems().find((item) => item.annotationId === id);
    if (!item) return time;
    return Math.max(0, time - (item.target.temporal?.startTime || 0) + (item.selector?.temporal?.startTime || 0));
  }
  function playElement(id: string, element: HTMLMediaElement) {
    const failed = (error: unknown) => {
      if (disposed || elements.get(id)?.element !== element || !store.getState().isPlaying) return;
      store.getState().pause();
      store.setState({ playbackError: error });
    };
    try {
      element.play()?.catch(failed);
    } catch (error) {
      failed(error);
    }
  }
  function synchronize(seek = false) {
    const state = store.getState();
    for (const [id, { element }] of elements) {
      if (state.visibleElements[id]) {
        if (!seek && element.seeking) continue;
        const time = mediaTime(id, state.primeTime);
        const drift = Math.abs(element.currentTime - time);
        if (element.readyState > 0 && drift > (seek ? 0.01 : 0.3)) element.currentTime = time;
        if (state.isPlaying && element.paused) playElement(id, element);
      } else if (!element.paused) element.pause();
    }
    const isBuffering = Object.entries(state.bufferMap).some(
      ([id, buffering]) => buffering && state.visibleElements[id]
    );
    if (state.isBuffering !== isBuffering) store.setState({ isBuffering });
  }
  function tick(timestamp: number) {
    frame = null;
    const state = store.getState();
    const elapsed = lastFrame === null ? 0 : (timestamp - lastFrame) / 1000;
    lastFrame = timestamp;
    // Native currentTime can still report the old position (or zero) during a seek.
    const seeking = [...elements].some(([id, { element }]) => state.visibleElements[id] && element.seeking);
    if (!disposed && state.isPlaying && state.isReady && !state.isBuffering && !seeking) {
      const prime = state.currentPrime && elements.get(state.currentPrime.id)?.element;
      const primeItem = mediaItems().find((item) => item.annotationId === state.currentPrime?.id);
      const mediaClock =
        prime && primeItem && !prime.paused && !prime.ended
          ? prime.currentTime +
            (primeItem.target.temporal?.startTime || 0) -
            (primeItem.selector?.temporal?.startTime || 0)
          : state.primeTime + elapsed;
      const time = Math.min(state.duration, Math.max(0, mediaClock));
      if (time < state.primeTime) {
        state.setTime(time);
      }

      const [index, changes] = resolveKeyframeChanges({
        currentTime: store.getState().primeTime,
        targetTime: time,
        currentKeyFrameIndex: store.getState().nextKeyframeIndex,
        keyframes: state.complexTimeline.keyframes,
      });
      publishTime(time);
      if (index !== state.nextKeyframeIndex) state.applyKeyframes(index, changes);
      synchronize();
      if (time >= state.duration) {
        state.pause();
        store.setState({ isFinished: true });
      }
    }
    if (!disposed && store.getState().clockRunning) frame = requestAnimationFrame(tick);
  }
  function stopFrames() {
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
    lastFrame = null;
  }
  function detach(id: string) {
    const binding = elements.get(id);
    if (!binding) return;
    elements.delete(id);
    binding.cleanup();
    binding.element.pause();
    const bufferMap = { ...store.getState().bufferMap };
    delete bufferMap[id];
    store.setState({
      bufferMap,
      isBuffering: Object.entries(bufferMap).some(([key, value]) => value && store.getState().visibleElements[key]),
    });
    ready();
  }
  function attachMediaElement(id: string, element: HTMLMediaElement) {
    if (disposed) return () => {};
    detach(id);
    const buffering = (value: boolean) => {
      if (elements.get(id)?.element !== element) return;
      const state = store.getState();
      const bufferMap = { ...state.bufferMap, [id]: value };
      const isBuffering = Object.entries(bufferMap).some(([key, value]) => value && state.visibleElements[key]);
      store.setState({ bufferMap, isBuffering });
      emitter.emit('complex-timeline.buffering', { id, isBuffering: value });
      if (state.isBuffering && !isBuffering) emitter.emit('complex-timeline.finished-buffering', {});
    };
    const waiting = () => buffering(true);
    const playing = () => {
      buffering(false);
      ready();
    };
    const metadata = () => {
      ready();
      synchronize(true);
    };
    const paused = () => {
      const state = store.getState();
      if (element.paused && !element.ended && state.isPlaying && state.visibleElements[id]) state.pause();
    };
    const error = () => {
      if (!store.getState().visibleElements[id]) return;
      store.getState().pause();
      store.setState({ playbackError: element.error || new Error(`Media failed: ${id}`) });
    };
    const listeners: Array<[string, () => void]> = [
      ['loadedmetadata', metadata],
      ['loadeddata', ready],
      ['progress', ready],
      ['durationchange', ready],
      ['waiting', waiting],
      ['stalled', waiting],
      ['canplay', playing],
      ['playing', playing],
      ['pause', paused],
      ['error', error],
      ['emptied', ready],
    ];
    for (const [name, fn] of listeners) element.addEventListener(name, fn);
    const binding = {
      element,
      cleanup: () => {
        for (const [name, fn] of listeners) element.removeEventListener(name, fn);
      },
    };
    elements.set(id, binding);
    element.volume = store.getState().volume / 100;
    element.muted = store.getState().isMuted;
    ready();
    synchronize(true);
    return () => {
      if (elements.get(id) === binding) detach(id);
    };
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    store.getState().pause();
    stopFrames();
    for (const id of elements.keys()) detach(id);
    progress = timeElement = null;
    emitter.all.clear();
    store.setState({ isReady: false, clockRunning: false, clockStartRequests: 0 });
  }
  const store = createStore<ComplexTimelineStore>((set, get) => ({
    complexTimeline,
    visibleElements: {},
    isReady: false,
    unseekableMedia: [],
    isBuffering: false,
    bufferMap: {},
    isMuted: false,
    playRequested: false,
    isPlaying: false,
    isFinished: false,
    volume: 100,
    duration: complexTimeline.duration,
    primeTime: 0,
    clockRunning: false,
    clockStartTime: 0,
    currentPrime: null,
    clockStartRequests: 0,
    nextKeyframeIndex: 0,
    playbackError: null,
    attachMediaElement,
    dispose,
    setElement: (id, element) => {
      attachMediaElement(id, element);
    },
    removeElement: detach,
    updateTimeline(timeline) {
      if (disposed) return;
      // Annotation/style changes preserve the clock and attached nodes. Hosts remount for a new canvas.
      const previous = get().complexTimeline;
      if (previous.keyframes === timeline.keyframes && previous.duration === timeline.duration) {
        set({ complexTimeline: timeline });
        for (const id of elements.keys()) if (!mediaItems().some((item) => item.annotationId === id)) detach(id);
        ready();
        return;
      }
      set({
        complexTimeline: timeline,
        duration: timeline.duration,
        visibleElements: {},
        currentPrime: null,
        nextKeyframeIndex: 0,
      });
      for (const id of elements.keys()) if (!mediaItems().some((item) => item.annotationId === id)) detach(id);
      get().setTime(get().primeTime);
      ready();
    },
    startClock() {
      if (disposed) return;
      if (!get().clockRunning) {
        lastFrame = null;
        frame = requestAnimationFrame(tick);
      }
      set({ clockRunning: true, clockStartRequests: get().clockStartRequests + 1 });
    },
    stopClock() {
      const requests = Math.max(0, get().clockStartRequests - 1);
      set({ clockStartRequests: requests, clockRunning: requests > 0 });
      if (!requests) stopFrames();
    },
    applyKeyframes(index, keyframes) {
      const visible = { ...get().visibleElements };
      let prime = get().currentPrime;
      for (const keyframe of keyframes) {
        if (keyframe.type === 'enter') {
          visible[keyframe.id] = keyframe;
          emitter.emit('complex-timeline.enter', { id: keyframe.id });
        }
        if (keyframe.type === 'exit') {
          visible[keyframe.id] = null;
          if (prime?.id === keyframe.id) prime = null;
          emitter.emit('complex-timeline.exit', { id: keyframe.id });
        }
        if (keyframe.isPrime && keyframe.type !== 'exit') prime = visible[keyframe.id] || null;
      }
      set({ visibleElements: visible, currentPrime: prime, nextKeyframeIndex: index });
    },
    play() {
      if (disposed || get().isPlaying) return;
      if (get().isFinished) get().setTime(0);
      set({ isPlaying: true, playRequested: true, isFinished: false, playbackError: null });
      lastFrame = null;
      for (const [id, { element }] of elements) if (get().visibleElements[id]) playElement(id, element);
      set({ playRequested: false });
    },
    pause() {
      set({ isPlaying: false, playRequested: false });
      for (const { element } of elements.values()) if (!element.paused) element.pause();
    },
    playPause() {
      get().isPlaying ? get().pause() : get().play();
    },
    setDurationPercent(percent) {
      get().setTime(get().duration * percent);
    },
    setTime(timeOrFn) {
      if (disposed) return;
      const state = get();
      const requested = typeof timeOrFn === 'function' ? timeOrFn(state.primeTime) : timeOrFn;
      if (!Number.isFinite(requested)) return;
      const time = Math.max(0, Math.min(state.duration, requested));
      for (const item of mediaItems()) {
        const element = elements.get(item.annotationId)?.element;
        const start = item.target.temporal?.startTime || 0;
        const end = item.target.temporal?.endTime ?? state.duration;
        if (!element || time < start || time >= end) continue;
        const target = mediaTime(item.annotationId, time);
        const ranges = element.seekable;
        if (
          ranges?.length &&
          Math.abs(element.currentTime - target) > 0.01 &&
          !Array.from({ length: ranges.length }, (_, i) => target >= ranges.start(i) && target <= ranges.end(i)).some(
            Boolean
          )
        ) {
          set({
            playbackError: new Error(
              `Media cannot seek to ${target.toFixed(1)}s: the source has not made that position seekable.`
            ),
          });
          return;
        }
      }
      set({ playbackError: null });
      let index = state.nextKeyframeIndex;
      let previous = state.primeTime;
      if (time < previous) {
        for (const [id, value] of Object.entries(state.visibleElements))
          if (value) emitter.emit('complex-timeline.exit', { id });
        set({ visibleElements: {}, currentPrime: null });
        index = 0;
        previous = 0;
      }
      const [next, changes] = resolveKeyframeChanges({
        currentTime: previous,
        targetTime: time,
        currentKeyFrameIndex: index,
        keyframes: state.complexTimeline.keyframes,
      });
      publishTime(time);
      state.applyKeyframes(next, changes);
      set({ isFinished: time >= state.duration });
      if (time >= state.duration) get().pause();
      synchronize(true);
      lastFrame = null;
    },
    mute() {
      for (const { element } of elements.values()) element.muted = true;
      set({ isMuted: true });
    },
    unmute() {
      for (const { element } of elements.values()) element.muted = false;
      set({ isMuted: false });
    },
    toggleMute() {
      get().isMuted ? get().unmute() : get().mute();
    },
    setVolume(volume) {
      if (!Number.isFinite(volume)) return;
      volume = Math.min(100, Math.max(0, volume));
      for (const { element } of elements.values()) element.volume = volume / 100;
      set({ volume });
    },
    setProgressElement(div) {
      progress = div;
      publishTime(get().primeTime);
    },
    setCurrentTimeElement(div) {
      timeElement = div;
      publishTime(get().primeTime);
    },
    clearProgressElement() {
      progress = null;
    },
    clearCurrentTimeElement() {
      timeElement = null;
    },
  }));
  ready();
  store.getState().setTime(startTime);
  return { store, emitter, attachMediaElement, dispose, getSnapshot: store.getState, subscribe: store.subscribe };
}
