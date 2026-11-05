import { Vault, createPaintingAnnotationsHelper } from '@iiif/helpers';
import { Vault4 } from '@iiif/helpers/vault-4';
import { describe, expect, test } from 'vitest';
import { getRenderingStrategy } from '../src/features/rendering-strategy/get-rendering-strategy';

// Cached uc05_movie.json (spec-009); unrelated placeholder omitted.
const movie = {
  '@context': 'http://iiif.io/api/presentation/4/context.json',
  id: 'https://iiif.io/api/presentation/4.0/example/uc05_movie.json',
  type: 'Manifest',
  label: {
    en: ['Use Case 4: Movie with Subtitles'],
  },
  items: [
    {
      id: 'https://iiif.io/api/presentation/4.0/example/uc05/canvas',
      type: 'Canvas',
      height: 360,
      width: 480,
      duration: 572.034,
      timeMode: 'trim',
      items: [
        {
          id: 'https://iiif.io/api/presentation/4.0/example/uc05/annopage1',
          type: 'AnnotationPage',
          items: [
            {
              id: 'https://iiif.io/api/presentation/4.0/example/uc05/anno1',
              type: 'Annotation',
              motivation: ['painting'],
              body: {
                type: 'Choice',
                items: [
                  {
                    id: 'https://fixtures.iiif.io/video/indiana/lunchroom_manners/low/lunchroom_manners_256kb.mp4',
                    type: 'Video',
                    label: {
                      en: ['Low resolution (75 MB)'],
                    },
                    height: 360,
                    width: 480,
                    duration: 572.034,
                    format: 'video/mp4',
                    fileSize: 78666676,
                  },
                  {
                    id: 'https://fixtures.iiif.io/video/indiana/lunchroom_manners/high/lunchroom_manners_1024kb.mp4',
                    type: 'Video',
                    label: {
                      en: ['High resolution (75 MB)'],
                    },
                    height: 360,
                    width: 480,
                    duration: 572.034,
                    format: 'video/mp4',
                    fileSize: 78666676,
                  },
                ],
              },
              target: {
                id: 'https://iiif.io/api/presentation/4.0/example/uc05/canvas',
                type: 'Canvas',
              },
            },
          ],
        },
      ],
      annotations: [
        {
          id: 'https://iiif.io/api/presentation/4.0/example/uc05/subtitles',
          type: 'AnnotationPage',
          items: [
            {
              id: 'https://iiif.io/api/presentation/4.0/example/uc05/subtitles/anno',
              type: 'Annotation',
              motivation: ['supplementing'],
              provides: ['subtitles'],
              body: {
                id: 'https://fixtures.iiif.io/video/indiana/lunchroom_manners/lunchroom_manners.vtt',
                type: 'Text',
                format: 'text/vtt',
                label: {
                  en: ['Subtitles in WebVTT format'],
                },
                language: ['en'],
              },
              target: {
                id: 'https://iiif.io/api/presentation/4.0/example/uc05/canvas',
                type: 'Canvas',
              },
            },
          ],
        },
      ],
    },
  ],
};

describe.each([
  { name: 'Vault 3 / P3', create: () => new Vault(), version: 3 },
  { name: 'Vault 4 / P4', create: () => new Vault4(), version: 4 },
])('$name video subtitles', ({ create, version }) => {
  function select(body: unknown, motivation: string | string[] = ['supplementing']) {
    const input = structuredClone(movie) as any;
    input['@context'] = `http://iiif.io/api/presentation/${version}/context.json`;
    const subtitle = input.items[0].annotations[0].items[0];
    subtitle.body = body;
    subtitle.motivation = motivation;
    const vault = create();
    const manifest = vault.loadManifestSync(input.id, input)!;
    const canvas = vault.getState().iiif.entities.Canvas[manifest.items[0].id]!;
    const paintables = createPaintingAnnotationsHelper(vault).getPaintables(canvas);
    const strategy = getRenderingStrategy({
      canvas,
      paintables,
      vault,
      supports: ['media'],
      loadImageService: () => undefined,
    });
    expect(strategy.type).toBe('media');
    if (strategy.type !== 'media') throw new Error('Expected video strategy');
    expect(strategy.media).toMatchObject({ type: 'Video', duration: 572.034, format: 'video/mp4' });
    return strategy.captions;
  }

  const english = movie.items[0].annotations[0].items[0].body;
  const french = { ...english, id: 'https://example.org/fr.vtt', language: ['fr'], label: { fr: ['Français'] } };
  const unrelated = { id: 'https://example.org/transcript', type: 'Text', format: 'text/plain' };

  test('selects the actual movie with a native single subtitle body', () => {
    expect(select(english)).toEqual([english]);
  });

  test('collects multiple VTT bodies without including other formats', () => {
    expect(select([english, unrelated, french], 'supplementing')).toEqual([english, french]);
  });

  test('resolves normalized Choice references and preserves caption metadata', () => {
    expect(select({ type: 'Choice', items: [english, unrelated, french] })).toEqual([english, french]);
  });

  test('ignores non-supplementing annotations and empty bodies', () => {
    expect(select(english, 'commenting')).toEqual([]);
    expect(select([])).toEqual([]);
  });
});
