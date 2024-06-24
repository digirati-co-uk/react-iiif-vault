import { getRenderingStrategy } from '../src/features/rendering-strategy/get-rendering-strategy';
import { describe, test, expect } from 'vitest';
import multimedia from '../fixtures/multimedia.json';
import fire from '../fixtures/fire.json';
import { Vault, createPaintingAnnotationsHelper } from '@iiif/helpers';
import invariant from 'tiny-invariant';
import { CanvasNormalized } from '@iiif/presentation-3-normalized';

describe('Rendering strategy', () => {
  test('multimedia rendering strategy', () => {
    const vault = new Vault();
    const manifest = vault.loadManifestSync(multimedia.id, multimedia);
    const helper = createPaintingAnnotationsHelper(vault);

    invariant(manifest);

    const canvas = vault.get<CanvasNormalized>(manifest.items[0])!;
    const paintables = helper.getPaintables(canvas);
    const strategy = getRenderingStrategy({
      canvas,
      paintables,
      loadImageService: (async (t: any) => t) as any,
      supports: ['video', 'image', 'complex-timeline'],
    });

    expect(strategy).toMatchInlineSnapshot(`
      {
        "duration": 120,
        "items": [
          {
            "annotationId": "https://preview.iiif.io/cookbook/0489-multimedia-canvas/recipe/0489-multimedia-canvas/annotation/p0001-image",
            "height": 3024,
            "id": "https://iiif.io/api/image/3.0/example/reference/918ecd18c2592080851777620de9bcb5-gottingen/full/max/0/default.jpg",
            "selector": {
              "spatial": {
                "height": 3024,
                "width": 4032,
                "x": 0,
                "y": 0,
              },
              "type": "BoxSelector",
            },
            "service": Promise {
              "id": undefined,
            },
            "sizes": [
              {
                "height": 3024,
                "width": 4032,
              },
            ],
            "target": {
              "spatial": {
                "height": 3024,
                "width": 4032,
                "x": 0,
                "y": 0,
              },
              "type": "BoxSelector",
            },
            "type": "Image",
            "width": 4032,
          },
          {
            "annotationId": "https://preview.iiif.io/cookbook/0489-multimedia-canvas/recipe/0489-multimedia-canvas/annotation/p0002-video q",
            "duration": 120,
            "format": "video/mp4",
            "selector": {
              "temporal": {
                "endTime": 30,
                "startTime": 0,
              },
              "type": "TemporalSelector",
            },
            "target": {
              "spatial": {
                "height": 360,
                "unit": "pixel",
                "width": 480,
                "x": 200,
                "y": 200,
              },
              "temporal": {
                "endTime": 57,
                "startTime": 27,
              },
              "type": "TemporalBoxSelector",
            },
            "type": "Video",
            "url": "https://fixtures.iiif.io/video/indiana/donizetti-elixir/vae0637_accessH264_low_act_1.mp4",
          },
        ],
        "keyframes": [
          {
            "id": "https://preview.iiif.io/cookbook/0489-multimedia-canvas/recipe/0489-multimedia-canvas/annotation/p0001-image",
            "resourceType": "image",
            "time": 0,
            "type": "enter",
          },
          {
            "id": "https://preview.iiif.io/cookbook/0489-multimedia-canvas/recipe/0489-multimedia-canvas/annotation/p0002-video q",
            "isPrime": true,
            "resourceType": "video",
            "time": 27,
            "type": "enter",
          },
          {
            "id": "https://preview.iiif.io/cookbook/0489-multimedia-canvas/recipe/0489-multimedia-canvas/annotation/p0002-video q",
            "resourceType": "video",
            "time": 57,
            "type": "exit",
          },
          {
            "id": "https://preview.iiif.io/cookbook/0489-multimedia-canvas/recipe/0489-multimedia-canvas/annotation/p0001-image",
            "resourceType": "image",
            "time": 120,
            "type": "exit",
          },
        ],
        "type": "complex-timeline",
      }
    `);
  });

  test('fire complex timeline rendering strategy', () => {
    const vault = new Vault();
    const manifest = vault.loadManifestSync(fire.id, fire);
    const helper = createPaintingAnnotationsHelper(vault);

    invariant(manifest);

    const canvas = vault.get<CanvasNormalized>(manifest.items[0])!;
    const paintables = helper.getPaintables(canvas);
    const strategy = getRenderingStrategy({
      canvas,
      paintables,
      loadImageService: (async (t: any) => t) as any,
      supports: ['video', 'image', 'complex-timeline'],
    });

    expect(strategy).toMatchInlineSnapshot(`
      {
        "duration": 120,
        "items": [
          {
            "annotationId": "https://tomcrane.github.io/fire/annos/anno1",
            "height": 750,
            "id": "https://tomcrane.github.io/fire/content/main.jpg",
            "selector": {
              "spatial": {
                "height": 750,
                "width": 1000,
                "x": 0,
                "y": 0,
              },
              "type": "BoxSelector",
            },
            "service": undefined,
            "sizes": [
              {
                "height": 1000,
                "width": 750,
              },
            ],
            "target": {
              "spatial": {
                "height": 750,
                "width": 1000,
                "x": 0,
                "y": 0,
              },
              "type": "BoxSelector",
            },
            "type": "Image",
            "width": 1000,
          },
          {
            "annotationId": "https://tomcrane.github.io/fire/annos/anno2",
            "height": 300,
            "id": "https://tomcrane.github.io/fire/content/small.jpg",
            "selector": {
              "spatial": {
                "height": 750,
                "width": 1000,
                "x": 0,
                "y": 0,
              },
              "type": "BoxSelector",
            },
            "service": undefined,
            "sizes": [
              {
                "height": 300,
                "width": 400,
              },
            ],
            "target": {
              "spatial": {
                "height": 300,
                "unit": "pixel",
                "width": 400,
                "x": 200,
                "y": 200,
              },
              "temporal": {
                "endTime": 9,
                "startTime": 2,
              },
              "type": "TemporalBoxSelector",
            },
            "type": "Image",
            "width": 400,
          },
          {
            "annotationId": "https://tomcrane.github.io/fire/annos/anno3",
            "target": {
              "spatial": {
                "height": 100,
                "unit": "pixel",
                "width": 500,
                "x": 70,
                "y": 60,
              },
              "temporal": {
                "endTime": 20,
                "startTime": 5,
              },
              "type": "TemporalBoxSelector",
            },
            "text": {
              "none": [
                "Fire is the rapid oxidation of a material in the exothermic chemical process of combustion, releasing heat, light, and various reaction products. Slower oxidative processes like rusting or digestion are not included by this definition.",
              ],
            },
            "type": "Text",
          },
          {
            "annotationId": "https://tomcrane.github.io/fire/annos/anno4",
            "height": 450,
            "id": "https://tomcrane.github.io/fire/content/still.JPG",
            "selector": {
              "spatial": {
                "height": 750,
                "width": 1000,
                "x": 0,
                "y": 0,
              },
              "type": "BoxSelector",
            },
            "service": undefined,
            "sizes": [
              {
                "height": 450,
                "width": 600,
              },
            ],
            "target": {
              "spatial": {
                "height": 225,
                "unit": "pixel",
                "width": 300,
                "x": 670,
                "y": 30,
              },
              "temporal": {
                "endTime": 20,
                "startTime": 9,
              },
              "type": "TemporalBoxSelector",
            },
            "type": "Image",
            "width": 600,
          },
          {
            "annotationId": "https://tomcrane.github.io/fire/annos/anno5",
            "duration": 120,
            "format": "video/mp4",
            "selector": {
              "temporal": {
                "endTime": 13,
                "startTime": 0,
              },
              "type": "TemporalSelector",
            },
            "target": {
              "spatial": {
                "height": 262,
                "unit": "pixel",
                "width": 360,
                "x": 200,
                "y": 200,
              },
              "temporal": {
                "endTime": 26,
                "startTime": 13,
              },
              "type": "TemporalBoxSelector",
            },
            "type": "Video",
            "url": "https://tomcrane.github.io/fire/content/out720.mp4",
          },
          {
            "annotationId": "https://tomcrane.github.io/fire/annos/anno6",
            "duration": 120,
            "format": "video/mp4",
            "selector": {
              "temporal": {
                "endTime": 12,
                "startTime": 0,
              },
              "type": "TemporalSelector",
            },
            "target": {
              "spatial": {
                "height": 248,
                "unit": "pixel",
                "width": 360,
                "x": 100,
                "y": 200,
              },
              "temporal": {
                "endTime": 38,
                "startTime": 26,
              },
              "type": "TemporalBoxSelector",
            },
            "type": "Video",
            "url": "https://tomcrane.github.io/fire/content/out2720.mp4",
          },
          {
            "annotationId": "https://tomcrane.github.io/fire/annos/anno7",
            "duration": 120,
            "format": "video/mp4",
            "selector": {
              "temporal": {
                "endTime": 7,
                "startTime": 0,
              },
              "type": "TemporalSelector",
            },
            "target": {
              "spatial": {
                "height": 248,
                "unit": "pixel",
                "width": 360,
                "x": 100,
                "y": 200,
              },
              "temporal": {
                "endTime": 45,
                "startTime": 38,
              },
              "type": "TemporalBoxSelector",
            },
            "type": "Video",
            "url": "https://tomcrane.github.io/fire/content/out2720.mp4",
          },
          {
            "annotationId": "https://tomcrane.github.io/fire/annos/anno8",
            "duration": 120,
            "format": "video/mp4",
            "selector": {
              "temporal": {
                "endTime": 19,
                "startTime": 0,
              },
              "type": "TemporalSelector",
            },
            "target": {
              "spatial": {
                "height": 210,
                "unit": "pixel",
                "width": 360,
                "x": 600,
                "y": 420,
              },
              "temporal": {
                "endTime": 48,
                "startTime": 29,
              },
              "type": "TemporalBoxSelector",
            },
            "type": "Video",
            "url": "https://tomcrane.github.io/fire/content/out2722.mp4",
          },
        ],
        "keyframes": [
          {
            "id": "https://tomcrane.github.io/fire/annos/anno1",
            "resourceType": "image",
            "time": 0,
            "type": "enter",
          },
          {
            "id": "https://tomcrane.github.io/fire/annos/anno2",
            "resourceType": "image",
            "time": 2,
            "type": "enter",
          },
          {
            "id": "https://tomcrane.github.io/fire/annos/anno3",
            "resourceType": "text",
            "time": 5,
            "type": "enter",
          },
          {
            "id": "https://tomcrane.github.io/fire/annos/anno2",
            "resourceType": "image",
            "time": 9,
            "type": "exit",
          },
          {
            "id": "https://tomcrane.github.io/fire/annos/anno4",
            "resourceType": "image",
            "time": 9,
            "type": "enter",
          },
          {
            "id": "https://tomcrane.github.io/fire/annos/anno5",
            "isPrime": true,
            "resourceType": "video",
            "time": 13,
            "type": "enter",
          },
          {
            "id": "https://tomcrane.github.io/fire/annos/anno3",
            "resourceType": "text",
            "time": 20,
            "type": "exit",
          },
          {
            "id": "https://tomcrane.github.io/fire/annos/anno4",
            "resourceType": "image",
            "time": 20,
            "type": "exit",
          },
          {
            "id": "https://tomcrane.github.io/fire/annos/anno5",
            "resourceType": "video",
            "time": 26,
            "type": "exit",
          },
          {
            "id": "https://tomcrane.github.io/fire/annos/anno6",
            "isPrime": true,
            "resourceType": "video",
            "time": 26,
            "type": "enter",
          },
          {
            "id": "https://tomcrane.github.io/fire/annos/anno8",
            "resourceType": "video",
            "time": 29,
            "type": "enter",
          },
          {
            "id": "https://tomcrane.github.io/fire/annos/anno6",
            "resourceType": "video",
            "time": 38,
            "type": "exit",
          },
          {
            "id": "https://tomcrane.github.io/fire/annos/anno8",
            "isPrime": true,
            "resourceType": "video",
            "time": 38,
            "type": "change",
          },
          {
            "id": "https://tomcrane.github.io/fire/annos/anno7",
            "resourceType": "video",
            "time": 38,
            "type": "enter",
          },
          {
            "id": "https://tomcrane.github.io/fire/annos/anno7",
            "resourceType": "video",
            "time": 45,
            "type": "exit",
          },
          {
            "id": "https://tomcrane.github.io/fire/annos/anno8",
            "isPrime": true,
            "resourceType": "video",
            "time": 45,
            "type": "change",
          },
          {
            "id": "https://tomcrane.github.io/fire/annos/anno8",
            "resourceType": "video",
            "time": 48,
            "type": "exit",
          },
          {
            "id": "https://tomcrane.github.io/fire/annos/anno1",
            "resourceType": "image",
            "time": 120,
            "type": "exit",
          },
        ],
        "type": "complex-timeline",
      }
    `);
  });
});
