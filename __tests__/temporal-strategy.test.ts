import { describe, expect, test } from 'vitest';
import { Vault, createPaintingAnnotationsHelper } from '@iiif/helpers';
import { Vault4 } from '@iiif/helpers/vault-4';
import { getRenderingStrategy } from '../src/features/rendering-strategy/get-rendering-strategy';
import { createComplexTimelineStore } from '../src/future-helpers/complex-timeline-store';

const canvasId = 'https://example.org/canvas';
function annotation(
  type: 'Image' | 'Video' | 'Sound' | 'TextualBody',
  index: number,
  target = canvasId,
  source?: string,
  duration = 30
) {
  const body =
    type === 'TextualBody'
      ? { type, value: 'Timed text', format: 'text/plain' }
      : {
          id: `https://example.org/${type.toLowerCase()}-${index}`,
          type,
          format: type === 'Image' ? 'image/jpeg' : type === 'Video' ? 'video/mp4' : 'audio/mp4',
          width: 600,
          height: 400,
          duration,
        };
  return {
    id: `${canvasId}/annotation/${index}`,
    type: 'Annotation',
    motivation: 'painting',
    target,
    body: source
      ? { type: 'SpecificResource', source: body, selector: { type: 'FragmentSelector', value: source } }
      : body,
  };
}

describe.each([
  { name: 'Vault 3', create: () => new Vault() },
  { name: 'Vault 4', create: () => new Vault4() },
])('$name temporal strategies', ({ create }) => {
  function select(
    items: ReturnType<typeof annotation>[],
    duration: number | null = 12,
    supports = ['images', 'media', 'textual-content', 'complex-timeline']
  ) {
    const vault = create();
    const manifest = vault.loadManifestSync('https://example.org/manifest', {
      '@context': 'http://iiif.io/api/presentation/3/context.json',
      id: 'https://example.org/manifest',
      type: 'Manifest',
      items: [
        {
          id: canvasId,
          type: 'Canvas',
          width: 600,
          height: 400,
          ...(duration === null ? {} : { duration }),
          items: [{ id: `${canvasId}/page`, type: 'AnnotationPage', items }],
        },
      ],
    })!;
    const canvas = vault.getState().iiif.entities.Canvas[manifest.items[0].id]!;
    const paintables = createPaintingAnnotationsHelper(vault).getPaintables(canvas);
    const before = [...paintables.types];
    const strategy = getRenderingStrategy({ canvas, paintables, supports, vault, loadImageService: () => undefined });
    expect(paintables.types).toEqual(before);
    return strategy;
  }

  test('routes timed images through the clock, including gaps and final exits', () => {
    const strategy = select([
      annotation('Image', 1, `${canvasId}#t=0,4`),
      annotation('Image', 2, `${canvasId}#t=6,12`),
    ]);
    expect(strategy.type).toBe('complex-timeline');
    if (strategy.type !== 'complex-timeline') throw new Error('Expected timeline');
    const controller = createComplexTimelineStore({ complexTimeline: strategy });
    try {
      const first = strategy.items[0].annotationId,
        second = strategy.items[1].annotationId;
      expect(controller.getSnapshot().isReady).toBe(true);
      expect(controller.getSnapshot().visibleElements[first]).toBeTruthy();
      controller.getSnapshot().setTime(5);
      expect(controller.getSnapshot().visibleElements[first]).toBeNull();
      expect(controller.getSnapshot().visibleElements[second]).toBeFalsy();
      controller.getSnapshot().setTime(8);
      expect(controller.getSnapshot().visibleElements[second]).toBeTruthy();
      controller.getSnapshot().setTime(1);
      expect(controller.getSnapshot().visibleElements[first]).toBeTruthy();
      expect(controller.getSnapshot().visibleElements[second]).toBeFalsy();
      controller.getSnapshot().setTime(12);
      expect(controller.getSnapshot().visibleElements[first]).toBeFalsy();
      expect(controller.getSnapshot().visibleElements[second]).toBeFalsy();
    } finally {
      controller.dispose();
    }
  });

  test.each(['Video', 'Sound'] as const)('preserves %s target intervals and source offsets', (type) => {
    const strategy = select([
      annotation(type, 1, `${canvasId}#t=0,6`),
      annotation(type, 2, `${canvasId}#t=6,12`, 't=7,13'),
    ]);
    expect(strategy.type).toBe('complex-timeline');
    if (strategy.type !== 'complex-timeline') throw new Error('Expected timeline');
    expect(strategy.items).toHaveLength(2);
    expect(strategy.items[1]).toMatchObject({
      target: { temporal: { startTime: 6, endTime: 12 } },
      selector: { temporal: { startTime: 7, endTime: 13 } },
    });
    expect(strategy.keyframes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: `${canvasId}/annotation/1`, type: 'exit', time: 6 }),
        expect.objectContaining({ id: `${canvasId}/annotation/2`, type: 'enter', time: 6 }),
        expect.objectContaining({ id: `${canvasId}/annotation/2`, type: 'exit', time: 12 }),
      ])
    );
    if (type === 'Video')
      expect(strategy.items[1]).toMatchObject({ target: { spatial: { x: 0, y: 0, width: 600, height: 400 } } });
    const controller = createComplexTimelineStore({ complexTimeline: strategy });
    try {
      controller.getSnapshot().setTime(8);
      expect(controller.getSnapshot().currentPrime?.id).toBe(`${canvasId}/annotation/2`);
      controller.getSnapshot().setTime(1);
      expect(controller.getSnapshot().currentPrime?.id).toBe(`${canvasId}/annotation/1`);
    } finally {
      controller.dispose();
    }
  });

  test.each(['Video', 'Sound'] as const)('infers %s exits from start-only targets and source duration', (type) => {
    const strategy = select([
      annotation(type, 1, `${canvasId}#t=0`, undefined, 6),
      annotation(type, 2, `${canvasId}#t=6`, 't=7,13'),
    ]);
    if (strategy.type !== 'complex-timeline') throw new Error('Expected timeline');
    expect(strategy.items[0]).toMatchObject({ target: { temporal: { startTime: 0, endTime: 6 } } });
    expect(strategy.items[1]).toMatchObject({
      target: { temporal: { startTime: 6, endTime: 12 } },
      selector: { temporal: { startTime: 7, endTime: 13 } },
    });
    const controller = createComplexTimelineStore({ complexTimeline: strategy });
    try {
      controller.getSnapshot().setTime(8);
      expect(controller.getSnapshot().visibleElements[`${canvasId}/annotation/1`]).toBeFalsy();
      expect(controller.getSnapshot().visibleElements[`${canvasId}/annotation/2`]).toBeTruthy();
    } finally {
      controller.dispose();
    }
  });

  test('retains overlapping sources and explicit video placement', () => {
    const strategy = select([
      annotation('Video', 1, `${canvasId}#t=0,8`),
      annotation('Video', 2, `${canvasId}#xywh=20,30,200,100&t=4,12`),
    ]);
    if (strategy.type !== 'complex-timeline') throw new Error('Expected timeline');
    expect(strategy.items[1]).toMatchObject({ target: { spatial: { x: 20, y: 30, width: 200, height: 100 } } });
    const controller = createComplexTimelineStore({ complexTimeline: strategy });
    try {
      controller.getSnapshot().setTime(5);
      expect(Object.values(controller.getSnapshot().visibleElements).filter(Boolean)).toHaveLength(2);
    } finally {
      controller.dispose();
    }
  });

  test.each(['Video', 'Sound'] as const)(
    'keeps ordinary single %s media, but uses a timeline for cropped playback',
    (type) => {
      expect(select([annotation(type, 1)])).toMatchObject({ type: 'media' });
      expect(select([annotation(type, 1, `${canvasId}#t=3,8`)])).toMatchObject({ type: 'complex-timeline' });
      expect(select([annotation(type, 1, canvasId, 't=7,19')])).toMatchObject({ type: 'complex-timeline' });
    }
  );

  test('handles full-duration image and text without explicit temporal fragments', () => {
    for (const type of ['Image', 'TextualBody'] as const) {
      expect(select([annotation(type, 1)])).toMatchObject({
        type: 'complex-timeline',
        keyframes: [
          expect.objectContaining({ time: 0, type: 'enter' }),
          expect.objectContaining({ time: 12, type: 'exit' }),
        ],
      });
    }
  });

  test('keeps untimed images static and respects the timeline capability gate', () => {
    expect(select([annotation('Image', 1)], null)).toMatchObject({ type: 'images' });
    // NaN is not a temporal duration; zero is likewise not a timed canvas.
    expect(select([annotation('Image', 1)], 0)).toMatchObject({ type: 'images' });
    expect(select([annotation('Image', 1)], Number.NaN)).toMatchObject({ type: 'images' });
    expect(select([annotation('Image', 1)], 12, ['images'])).toMatchObject({
      type: 'unknown',
      reason: 'Complex timeline not supported',
    });
    expect(select([annotation('Video', 1), annotation('Video', 2)], 12, ['media'])).toMatchObject({
      type: 'unknown',
      reason: 'Complex timeline not supported',
    });
  });
});

test('routes Presentation 4 Audio resources on a non-spatial Timeline', () => {
  const vault = new Vault4();
  const id = 'https://example.org/timeline';
  vault.loadManifestSync('https://example.org/v4', {
    '@context': 'http://iiif.io/api/presentation/4/context.json',
    id: 'https://example.org/v4',
    type: 'Manifest',
    items: [
      {
        id,
        type: 'Timeline',
        duration: 12,
        items: [
          {
            id: `${id}/page`,
            type: 'AnnotationPage',
            items: [0, 6].map((start, index) => ({
              id: `${id}/annotation/${index}`,
              type: 'Annotation',
              motivation: ['painting'],
              body: { id: `${id}/audio/${index}`, type: 'Audio', format: 'audio/mp4', duration: 6 },
              target: {
                type: 'SpecificResource',
                source: { id, type: 'Timeline' },
                selector: [{ type: 'FragmentSelector', value: `t=${start}` }],
              },
            })),
          },
        ],
      },
    ],
  });
  const timeline = vault.get({ id, type: 'Timeline' });
  const pages = vault.get(timeline.items.map(({ id }) => ({ id, type: 'AnnotationPage' as const })));
  const annotations = pages.flatMap((page) =>
    vault.get(page.items.map(({ id }) => ({ id, type: 'Annotation' as const })))
  );
  const paintables = createPaintingAnnotationsHelper(vault).getPaintables(annotations);
  const strategy = getRenderingStrategy({
    canvas: timeline,
    paintables,
    supports: ['media', 'complex-timeline'],
    vault,
    loadImageService: () => undefined,
  });
  expect(strategy).toMatchObject({
    type: 'complex-timeline',
    items: [
      { type: 'Sound', target: { temporal: { startTime: 0, endTime: 6 } } },
      { type: 'Sound', target: { temporal: { startTime: 6, endTime: 12 } } },
    ],
  });
});
