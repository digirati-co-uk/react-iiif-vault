import React, { useMemo } from 'react';
import { LocaleString, useCreateLocaleString } from '../utility/i18n-utils';
import { useSceneRuntime, useSceneStore } from './context';
import { useSceneAnnotations } from './annotations';

export function useSceneControls() {
  const runtime = useSceneRuntime();
  const snapshot = useSceneStore((state) => ({
    currentTime: state.time,
    duration: state.duration,
    playing: state.playing,
    playbackRate: state.playbackRate,
    selectedAnnotation: state.selectedAnnotation,
    activeCamera: state.activeCamera,
    annotationsVisible: state.annotationVisible,
  }));
  return {
    ...snapshot,
    play: () => runtime.clock.play(),
    pause: () => runtime.clock.pause(),
    seek: (time: number) => runtime.clock.seek(time),
    setPlaybackRate: (rate: number) => runtime.clock.setPlaybackRate(rate),
    activate: runtime.activate,
    reset: runtime.reset,
    resetView: runtime.resetView,
    selectCamera: runtime.selectCamera,
    selectAnnotation: runtime.selectAnnotation,
    setAnnotationsVisible: (visible: boolean) => runtime.store.setState({ annotationVisible: visible }),
    toggleAnnotations: () => runtime.store.setState((state) => ({ annotationVisible: !state.annotationVisible })),
    frameAnnotation: runtime.handle().frameAnnotation,
    frameAll: runtime.handle().frameAll,
    getAnnotationBounds: runtime.handle().getAnnotationBounds,
    getView: runtime.handle().getView,
    setView: runtime.handle().setView,
  };
}

export function SceneTimeline() {
  const { currentTime, duration, playing, play, pause, seek } = useSceneControls();
  if (!duration) return null;
  return (
    <div className="riv-scene-timeline">
      <button type="button" onClick={playing ? pause : play} aria-label={playing ? 'Pause Scene' : 'Play Scene'}>
        {playing ? 'Pause' : 'Play'}
      </button>
      <label>
        <span className="riv-scene-sr-only">Scene time</span>
        <input
          type="range"
          min={0}
          max={duration}
          step="any"
          value={currentTime}
          onChange={(event) => seek(event.currentTarget.valueAsNumber)}
        />
      </label>
      <output aria-live="off">
        {formatTime(currentTime)} / {formatTime(duration)}
      </output>
      <RealWorldTime />
    </div>
  );
}

function RealWorldTime() {
  const scene = useSceneRuntime().scene;
  const time = useSceneStore((state) => state.time);
  const scale = scene.temporalScale as any;
  if (!scale) return null;
  const factor = Number(scale.quantityValue ?? scale.value ?? 1);
  return (
    <span className="riv-scene-real-time">
      {formatNumber(time * factor)} {scale.unit || ''}
    </span>
  );
}

export function SceneCameraSelect() {
  const runtime = useSceneRuntime();
  const createLocaleString = useCreateLocaleString();
  const { cameras, active } = useSceneStore((state) => ({
    active: state.activeCamera,
    cameras: Object.entries(state.resources).filter(
      ([, resource]) => resource.type.endsWith('camera') && !resource.hidden
    ),
  }));
  const options = useMemo(
    () =>
      cameras.map(([path], index) => {
        const ids = Object.entries(runtime.store.getState().idIndex)
          .filter(([, paths]) => paths.includes(path))
          .map(([id]) => id);
        const resourceId = ids.find((id) => String(runtime.vault.get<any>(id)?.type || '').endsWith('Camera'));
        const resource = resourceId ? runtime.vault.get<any>(resourceId) : null;
        return {
          path,
          id: resourceId || ids[0] || path,
          label: createLocaleString(resource?.label, `Camera ${index + 1}`),
        };
      }),
    [cameras, createLocaleString, runtime]
  );
  if (options.length < 2) return null;
  return (
    <label className="riv-scene-camera-select">
      <span>Camera</span>
      <select
        value={active || ''}
        onChange={(event) =>
          runtime.selectCamera(options.find(({ path }) => path === event.currentTarget.value)?.id || '')
        }
      >
        {options.map(({ path, label }) => (
          <option key={path} value={path}>
            {label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function SceneAudioControl() {
  const runtime = useSceneRuntime();
  const audio = useSceneStore((state) => ({
    present: Object.values(state.resources).some((resource) => resource.type.endsWith('audio')),
    locked: state.audioLocked,
    muted: state.muted,
    volume: state.volume,
  }));
  if (!audio.present) return null;
  return (
    <div className="riv-scene-audio">
      {audio.locked ? (
        <button type="button" onClick={() => runtime.store.setState({ audioLocked: false })}>
          Enable audio
        </button>
      ) : (
        <>
          <button
            type="button"
            aria-pressed={audio.muted}
            onClick={() => runtime.store.setState({ muted: !audio.muted })}
          >
            {audio.muted ? 'Unmute' : 'Mute'}
          </button>
          <label>
            <span className="riv-scene-sr-only">Audio volume</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={audio.volume}
              onChange={(event) => runtime.store.setState({ volume: event.currentTarget.valueAsNumber })}
            />
          </label>
        </>
      )}
    </div>
  );
}

export function SceneAnnotationList() {
  const runtime = useSceneRuntime();
  const annotations = useSceneAnnotations();
  const visible = useSceneStore((state) => state.annotationVisible);
  if (!annotations.length) return null;
  return (
    <section className="riv-scene-annotations" aria-label="Scene annotations">
      <button
        type="button"
        aria-pressed={visible}
        onClick={() => runtime.store.setState({ annotationVisible: !visible })}
      >
        {visible ? 'Hide annotations' : 'Show annotations'}
      </button>
      {visible ? (
        <ol>
          {annotations.map((annotation: any) => (
            <li key={annotation.id}>
              <button type="button" onClick={() => runtime.selectAnnotation(annotation.id)}>
                {annotation.label ? <LocaleString>{annotation.label}</LocaleString> : annotation.id}
              </button>
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  );
}

function formatTime(time: number) {
  const minutes = Math.floor(time / 60);
  const seconds = Math.max(0, time - minutes * 60);
  return `${minutes}:${seconds.toFixed(1).padStart(4, '0')}`;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value);
}
