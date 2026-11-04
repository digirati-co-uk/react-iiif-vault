import type { SceneClock, SceneClockSnapshot } from './types';

export type InternalSceneClock = SceneClock & {
  advance(deltaSeconds: number): void;
  setDuration(duration: number): void;
};

function normalizeDuration(duration: number) {
  return duration === Number.POSITIVE_INFINITY ? duration : Number.isFinite(duration) ? Math.max(0, duration) : 0;
}

export function createSceneClock(duration = Number.POSITIVE_INFINITY): SceneClock {
  let snapshot: SceneClockSnapshot = { time: 0, playing: false, playbackRate: 1 };
  let maximum = normalizeDuration(duration);
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((listener) => listener());
  const update = (next: SceneClockSnapshot) => {
    if (next.time === snapshot.time && next.playing === snapshot.playing && next.playbackRate === snapshot.playbackRate)
      return;
    snapshot = next;
    emit();
  };
  const seek = (time: number) => Math.min(maximum, Math.max(0, Number.isFinite(time) ? time : 0));

  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    play() {
      update({ ...snapshot, time: snapshot.time >= maximum ? 0 : snapshot.time, playing: maximum > 0 });
    },
    pause() {
      update({ ...snapshot, playing: false });
    },
    seek(time) {
      update({ ...snapshot, time: seek(time) });
    },
    setPlaybackRate(playbackRate) {
      if (Number.isFinite(playbackRate) && playbackRate > 0) update({ ...snapshot, playbackRate });
    },
    advance(deltaSeconds) {
      if (!snapshot.playing) return;
      const time = seek(snapshot.time + Math.max(0, deltaSeconds) * snapshot.playbackRate);
      update({ ...snapshot, time, playing: time < maximum });
    },
    setDuration(nextDuration) {
      maximum = normalizeDuration(nextDuration);
      update({ ...snapshot, time: seek(snapshot.time), playing: snapshot.playing && snapshot.time < maximum });
    },
  } as InternalSceneClock;
}
