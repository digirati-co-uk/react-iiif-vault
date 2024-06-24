import mitt from 'mitt';
import { ComplexTimelineStrategy, TimelineKeyframe } from '../features/rendering-strategy/strategies';
import { MediaPlayerActions, formatTime } from '../hooks/useSimpleMediaPlayer';
import { createStore } from 'zustand/vanilla';

export interface ComplexTimelineStore extends MediaPlayerActions {
  complexTimeline: ComplexTimelineStrategy;
  elements: Record<string, HTMLVideoElement | HTMLAudioElement>;
  visibleElements: Record<string, TimelineKeyframe | null>;
  isReady: boolean;

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
    const nextTargetIndex = keyframes.findIndex((keyframe) => keyframe.time > targetTime);

    if (nextTargetIndex === -1) {
      return [currentKeyFrameIndex, []] as const;
    }
    // Record the keyframes we found, and discard any that enter and exit.
    const found: Record<string, TimelineKeyframe> = {};
    const keyframesToCheck = keyframes.slice(currentKeyFrameIndex, nextTargetIndex);
    for (const keyframe of keyframesToCheck) {
      if (keyframe.type === 'enter') {
        found[keyframe.id] = keyframe;
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

export function createComplexTimelineStore({
  complexTimeline,
  startTime = 0,
}: {
  complexTimeline: ComplexTimelineStrategy;
  startTime?: number;
}) {
  const $ev = mitt<ComplexTimelineEvents>();

  const interactiveElements = {
    progress: null as HTMLDivElement | null,
    currentTime: null as HTMLDivElement | null,
  };

  // Milliseconds
  let clockTime: number = 0;
  let clockTimer: number | null = null;
  let primeTime: number = 0;

  // Sync clock
  let syncClock: number | null = null;

  function getVisibleElements() {
    const $state = store.getState();
    const visible = $state.visibleElements;
    const allElements = $state.elements;

    const visibleElements = [];
    const keys = Object.keys(allElements);
    for (const key of keys) {
      const $el = allElements[key];
      const visibleElement = visible[key];
      if ($el && visibleElement) {
        visibleElements.push($el);
      }
    }
    return visibleElements;
  }

  function getAllElements() {
    const $state = store.getState();
    const keys = Object.keys($state.elements);
    return keys.map((key) => $state.elements[key]);
  }

  function updateInteractiveElements(currentTime: number) {
    // Update elements.
    if (interactiveElements.currentTime) {
      interactiveElements.currentTime.innerHTML = formatTime(currentTime);
      if (interactiveElements.progress) {
        interactiveElements.progress.style.width = `${(currentTime / complexTimeline.duration) * 100}%`;
      }
    }
  }

  let _syncClock = () => {
    const $state = store.getState();
    const currentTime = primeTime / 1000;

    const primeElement = $state.currentPrime;
    if (!primeElement) return;
    const allElements = $state.elements;
    const visible = $state.visibleElements;
    const keys = Object.keys(allElements);
    for (const key of keys) {
      const $el = allElements[key];
      const visibleElement = visible[key];
      if ($el && key !== primeElement.id && visibleElement) {
        const realTime = primeTime - visibleElement.time * 1000;
        const drift = Math.abs(primeTime - visibleElement.time * 1000 - $el.currentTime * 1000);
        if (drift > 300) {
          $el.currentTime = realTime / 1000;
        }
      }
    }
  };

  let _startClock = (time = 0) => {
    const dt = time - clockTime;
    const state = store.getState();

    if (state.isPlaying) {
      // Prime
      const primeElement = state.currentPrime;
      if (primeElement) {
        const $el = state.elements[primeElement.id] as HTMLVideoElement | HTMLAudioElement;
        if ($el.paused) {
          primeTime += dt;
        } else {
          primeTime = (primeElement.time + $el.currentTime) * 1000;
        }
      } else {
        primeTime += dt;
      }

      const currentTime = primeTime / 1000;

      if (currentTime > state.duration) {
        store.getState().setTime(0);
        store.setState({ isPlaying: false });
        _stopClock();
        updateInteractiveElements(0);
        return;
      }

      updateInteractiveElements(currentTime);

      const [newIdx, progress] = resolveKeyframeChanges({
        currentTime,
        currentKeyFrameIndex: state.nextKeyframeIndex,
        keyframes: state.complexTimeline.keyframes,
        targetTime: currentTime,
      });
      if (progress.length) {
        state.applyKeyframes(newIdx, progress);
      }
    }

    clockTime = time;
    clockTimer = requestAnimationFrame(_startClock);
  };

  let _stopClock = () => {
    if (clockTimer) {
      cancelAnimationFrame(clockTimer);
    }
  };

  const bindElementEvents = (element: HTMLVideoElement | HTMLAudioElement, id: string) => {
    // This is for handling the media events on the navtive elements.
    // Primarily, when the media is ready to play, when it's buffering.
    // Also if media is paused, then we check if WE caused it to pause, or if it's a user action.
    // If it's the user action, then we can pause too. NEED TO AVOID INFINITE LOOPS.
    // @TODO
  };

  const store = createStore<ComplexTimelineStore>((set, get) => ({
    complexTimeline,
    elements: {},
    visibleElements: {},
    isBuffering: false,
    bufferMap: {},
    isMuted: false,
    playRequested: false,
    isPlaying: false,
    isFinished: false,
    isReady: false,
    volume: 100,
    duration: complexTimeline.duration,
    clockStartRequests: 0,
    clockStartTime: 0,
    primeTime: 0,
    currentPrime: null,
    clockRunning: false,
    nextKeyframeIndex: 0,
    startClock: () => {
      const isRunning = get().clockRunning;
      if (!isRunning) {
        _startClock();
        syncClock = setInterval(_syncClock, 500);
      }
      set({
        clockRunning: true,
        clockStartRequests: get().clockStartRequests + 1,
      });
    },
    applyKeyframes(newIdx: number, keyframes: TimelineKeyframe[]) {
      const $state = get();
      const visible = { ...$state.visibleElements };
      let prime = $state.currentPrime;

      for (const keyframe of keyframes) {
        if (keyframe.type === 'enter') {
          visible[keyframe.id] = keyframe;
          $ev.emit('complex-timeline.enter', { id: keyframe.id });
        }
        if (keyframe.type === 'exit') {
          visible[keyframe.id] = null;
          $ev.emit('complex-timeline.exit', { id: keyframe.id });
        }

        if (keyframe.isPrime) {
          prime = keyframe;
        }
      }

      set({
        nextKeyframeIndex: newIdx,
        visibleElements: visible,
        currentPrime: prime,
      });
    },
    stopClock: () => {
      const current = get().clockStartRequests;
      if (current === 0) {
        return;
      }
      if (current === 1) {
        _stopClock();
        if (syncClock) {
          clearInterval(syncClock);
        }
        set({ clockRunning: false, clockStartRequests: 0 });
        return;
      }
      set({ clockStartRequests: current - 1 });
    },
    setElement: (id, element) => {
      const current = get().elements;
      const newElements = { ...current, [id]: element };
      set({ elements: newElements });

      // Check if we are "ready" to play
      const elementKeys = Object.keys(newElements);
      const timeline = get().complexTimeline;

      // Bind native events
      bindElementEvents(element, id);

      // @todo this could be limited to the current keyframes required.
      const isReady = timeline.items
        .filter((t) => t.type !== 'Image')
        .every((item) => {
          return elementKeys.includes(item.annotationId);
        });
      if (isReady && !get().isReady) {
        $ev.emit('complex-timeline.ready', { complexTimeline: timeline });
        set({ isReady: true });
      }
    },
    removeElement: (id) => {
      const current = get().elements;
      const { [id]: _, ...rest } = current;
      set({ elements: rest });
    },
    mute() {
      for (const $el of getAllElements()) {
        $el.muted = true;
      }
      set({ isMuted: true });
    },
    unmute() {
      for (const $el of getAllElements()) {
        $el.muted = false;
      }
      set({ isMuted: false });
    },
    play() {
      const $state = get();
      if ($state.isPlaying) return;

      for (const $el of getVisibleElements()) {
        $el.play();
      }

      set({ isPlaying: true });
    },
    pause() {
      const $state = get();
      if (!$state.isPlaying) return;

      for (const $el of getVisibleElements()) {
        $el.pause();
      }

      set({ isPlaying: false });
    },
    playPause() {
      const $state = get();
      if ($state.isPlaying) {
        $state.pause();
      } else {
        $state.play();
      }
    },
    setDurationPercent(percent) {
      const duration = get().duration;
      const time = duration * percent;
      get().setTime(time);
    },
    setTime(time) {
      const state = get();
      let currentTime = primeTime / 1000;
      let nextKeyframeIndex = state.nextKeyframeIndex;

      // Handle backwards.
      if (currentTime > time) {
        set({
          visibleElements: {},
          currentPrime: null,
        });
        const visibleKeys = Object.keys(state.visibleElements);
        for (const visible of visibleKeys) {
          $ev.emit('complex-timeline.exit', { id: visible });
        }
        currentTime = 0;
        nextKeyframeIndex = 0;
      }

      const [newIdx, progress] = resolveKeyframeChanges({
        currentTime,
        currentKeyFrameIndex: nextKeyframeIndex,
        keyframes: state.complexTimeline.keyframes,
        targetTime: time,
      });

      state.applyKeyframes(newIdx, progress);

      // Manually set time.
      primeTime = time * 1000;

      const $state = store.getState();
      const visible = $state.visibleElements;
      const allElements = $state.elements;

      // Set time on all elements
      const keys = Object.keys(visible);
      for (const key of keys) {
        const keyframe = visible[key];
        if (keyframe) {
          const $el = allElements[key];
          if ($el) {
            $el.currentTime = (primeTime - keyframe.time * 1000) / 1000;
          }
        }
      }
    },
    setVolume(volume) {
      for (const $el of getAllElements()) {
        $el.volume = Math.min(1, Math.max(0, volume / 100));
      }
      set({ volume });
    },
    toggleMute() {
      const $state = get();
      if ($state.isMuted) {
        $state.unmute();
        set({ isMuted: false });
      } else {
        $state.mute();
        set({ isMuted: true });
      }
    },
    clearProgressElement() {
      interactiveElements.progress = null;
    },
    setProgressElement(div) {
      interactiveElements.progress = div;
    },
    setCurrentTimeElement(div) {
      interactiveElements.currentTime = div;
    },
    clearCurrentTimeElement() {
      interactiveElements.currentTime = null;
    },
  }));

  $ev.on('complex-timeline.enter', (ev) => {
    const $state = store.getState();
    const id = ev.id;
    const $el = $state.elements[id];
    if ($el && $state.isPlaying) {
      $el.play();
    }
  });

  $ev.on('complex-timeline.exit', (ev) => {
    const $state = store.getState();
    const id = ev.id;
    const $el = $state.elements[id];
    if ($el) {
      $el.currentTime = 0;
      $el.pause();
    }
  });

  return {
    store,
    emitter: $ev,
  };
}
