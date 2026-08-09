import { describe, expect, test, vi } from 'vitest';
import {
  canvasTextureTransform,
  clampVideoPlaybackRate,
  createCanvasImageRequestUrl,
  getMediaPlaybackRate,
  isCanvasBodyVisible,
  resolveMediaDuration,
  syncVideoPlayback,
} from '../src/scene-panel/canvas-rendering';
import { applyModelTransformToCenter, syncAnimationPlayback } from '../src/scene-panel/rendering';
import { getLocalMediaTime } from '../src/scene-panel/timing';

describe('ScenePanel rendering lifecycle', () => {
  test('pauses an animation without stopping or rewinding it', () => {
    const action = { paused: false, play: vi.fn() };

    syncAnimationPlayback(action, false);

    expect(action.play).toHaveBeenCalledOnce();
    expect(action.paused).toBe(true);
  });

  test('applies an authored model translation exactly once to its local center', () => {
    expect(applyModelTransformToCenter([1, 2, 3], [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 10, 20, 30, 1])).toEqual([
      11, 22, 33,
    ]);
  });

  test('scales media playback to its authored Scene interval', () => {
    expect(getMediaPlaybackRate(1.5, { start: 2, end: 7 }, 10, 'scale')).toBe(3);
    expect(getMediaPlaybackRate(1.5, { start: 2, end: 7 }, 10, 'loop')).toBe(1.5);
  });

  test('keeps video playback rates inside the range accepted by browsers', () => {
    expect(clampVideoPlaybackRate(100)).toBe(16);
    expect(clampVideoPlaybackRate(0.001)).toBe(0.0625);
    expect(clampVideoPlaybackRate(Number.NaN)).toBe(1);
  });

  test('uses media metadata duration only when no authored duration exists', () => {
    expect(resolveMediaDuration(0, 10)).toBe(10);
    expect(resolveMediaDuration(8, 10)).toBe(8);
    expect(resolveMediaDuration(0, Number.NaN)).toBe(0);
    expect(getLocalMediaTime(12, null, resolveMediaDuration(0, 10), 'loop')).toBe(2);
    expect(getMediaPlaybackRate(1, { start: 0, end: 5 }, resolveMediaDuration(0, 10), 'scale')).toBe(2);
  });

  test('does not pause a video that is already playing during clock sync', () => {
    const video = { paused: false, pause: vi.fn(), play: vi.fn(() => Promise.resolve()) };

    syncVideoPlayback(video, true);

    expect(video.play).not.toHaveBeenCalled();
    expect(video.pause).not.toHaveBeenCalled();
  });

  test('honours temporal targets on bodies painted into a Canvas', () => {
    const target = 'https://example.org/canvas#xywh=10,20,30,40&t=2,4';

    expect(isCanvasBodyVisible(target, 1.99)).toBe(false);
    expect(isCanvasBodyVisible(target, 2)).toBe(true);
    expect(isCanvasBodyVisible(target, 4)).toBe(false);
  });

  test('maps raw-image source crops into Three texture coordinates', () => {
    expect(canvasTextureTransform({ x: 100, y: 50, width: 400, height: 200 }, 1000, 500)).toEqual({
      offset: [0.1, 0.5],
      repeat: [0.4, 0.4],
    });
  });

  test('never emits an invalid width in an Image API request', () => {
    expect(createCanvasImageRequestUrl('https://example.org/image', { id: 'fallback.jpg' }, null, Number.NaN)).toBe(
      'https://example.org/image/full/64,/0/default.jpg'
    );
  });
});
