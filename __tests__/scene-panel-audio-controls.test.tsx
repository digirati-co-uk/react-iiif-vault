/** @vitest-environment happy-dom */
import React from "react";
import { act, render, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { AudioContext } from "three";
import { SceneProvider, useSceneRuntime } from "../src/scene-panel/context";
import { useSceneControls } from "../src/scene-panel/controls";

afterEach(() => {
  vi.restoreAllMocks();
});
async function setup(duration?: number) {
  let runtime!: ReturnType<typeof useSceneRuntime>;
  let controls!: ReturnType<typeof useSceneControls>;
  function Probe() {
    runtime = useSceneRuntime();
    controls = useSceneControls();
    return null;
  }
  const view = render(
    <SceneProvider scene={{ id: "https://example.org/audio", type: "Scene", duration, items: [] } as any}>
      <Probe />
    </SceneProvider>,
  );
  await waitFor(() => expect(runtime).toBeTruthy());
  return {
    view,
    get runtime() {
      return runtime;
    },
    get controls() {
      return controls;
    },
  };
}

test("resumes audio directly in the gesture and unlocks only after success, without autoplay", async () => {
  const f = await setup(60);
  let resolve!: () => void;
  const resume = vi.fn(
    () =>
      new Promise<void>((done) => {
        resolve = done;
      }),
  );
  vi.spyOn(AudioContext, "getContext").mockReturnValue({ resume } as any);
  let unlocking!: Promise<void>;
  act(() => {
    unlocking = f.controls.unlockAudio();
  });
  expect(resume).toHaveBeenCalledOnce();
  expect(f.controls.audio).toMatchObject({ locked: true });
  await act(async () => {
    resolve();
    await unlocking;
  });
  expect(f.controls.audio).toMatchObject({ locked: false });
  expect(f.controls.playing).toBe(false);
  act(() => {
    f.controls.play();
    f.controls.seek(30);
  });
  expect(f.controls.currentTime).toBe(30);
  expect(f.controls.playing).toBe(true);
  act(() => f.controls.pause());
  expect(f.controls.playing).toBe(false);
  f.view.unmount();
});

test("blocked audio remains locked and can be retried", async () => {
  const f = await setup(60);
  const resume = vi.fn().mockRejectedValueOnce(new Error("blocked")).mockResolvedValue(undefined);
  vi.spyOn(AudioContext, "getContext").mockReturnValue({ resume } as any);
  await expect(f.controls.unlockAudio()).rejects.toThrow("blocked");
  expect(f.controls.audio.locked).toBe(true);
  await act(async () => {
    await f.controls.unlockAudio();
  });
  expect(f.controls.audio.locked).toBe(false);
  f.view.unmount();
});

test("audio controls react to registrations and clamp volume without changing authored resources", async () => {
  const f = await setup();
  expect(f.controls.audio.present).toBe(false);
  let remove!: () => void;
  act(() => {
    remove = f.runtime.register({ path: "ambient", ids: ["ambient"], type: "ambient-audio" });
  });
  expect(f.controls.audio.present).toBe(true);
  act(() => {
    f.controls.setMuted(true);
    f.controls.setVolume(2);
  });
  expect(f.controls.audio).toMatchObject({ muted: true, volume: 1 });
  act(() => f.controls.setVolume(-1));
  expect(f.controls.audio.volume).toBe(0);
  act(() => f.controls.setVolume(Number.NaN));
  expect(f.controls.audio.volume).toBe(0);
  act(() => {
    f.controls.play();
    (f.runtime.clock as any).advance(2);
  });
  expect(f.controls.currentTime).toBe(2);
  expect(f.controls.playing).toBe(true);
  act(remove);
  expect(f.controls.audio.present).toBe(false);
  f.view.unmount();
});

test.each(["reset", "pause"] as const)("a later %s cancels a pending audio Play request", async (action) => {
  const f = await setup(60);
  let resume!: () => void;
  vi.spyOn(AudioContext, "getContext").mockReturnValue({
    resume: () =>
      new Promise<void>((resolve) => {
        resume = resolve;
      }),
  } as any);
  const pending = f.controls.unlockAudio().then(f.controls.play);
  const rejected = expect(pending).rejects.toMatchObject({ name: "AbortError" });
  act(() => f.controls[action]());
  await act(async () => {
    resume();
    await rejected;
  });
  expect(f.controls.playing).toBe(false);
  expect(f.controls.currentTime).toBe(0);
  f.view.unmount();
});
