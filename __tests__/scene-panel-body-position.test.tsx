/** @vitest-environment happy-dom */
import React from 'react';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { Vault4 } from '@iiif/helpers/vault-4';
import { describe, expect, test, vi } from 'vitest';
import { Vector3 } from 'three';
import { Annotation3D } from '../src/scene-panel/annotations';
import { SceneRuntimeContext } from '../src/scene-panel/context';
import { createSceneRuntimeStore } from '../src/scene-panel/store';

// Exact supplementary annotations from the cached requirements payloads.
const cases = [
  {
    name: '043-row-044',
    sceneId: 'https://example.org/iiif/scene1',
    annotation: {
      id: 'https://example.org/iiif/3d/anno3',
      type: 'Annotation',
      motivation: ['commenting'],
      body: {
        type: 'TextualBody',
        value: '<p>Right pterygoid hamulus</p>',
        format: 'text/html',
        language: ['en'],
        position: {
          id: 'https://example.org/iiif/3d/anno3/body/position',
          type: 'SpecificResource',
          source: {
            id: 'https://example.org/iiif/scene1',
            type: 'Scene',
          },
          selector: [
            {
              type: 'PointSelector',
              x: 0.04,
              y: 0.0,
              z: -0.066,
            },
          ],
        },
      },
      target: {
        id: 'https://example.org/iiif/3d/anno3/target',
        type: 'SpecificResource',
        source: {
          id: 'https://example.org/iiif/scene1',
          type: 'Scene',
        },
        selector: [
          {
            type: 'PointSelector',
            x: 0.04,
            y: 0.063,
            z: -0.066,
          },
        ],
      },
    },
    marker: [0.04, 0.063, -0.066],
    body: [0.04, 0, -0.066],
  },
  {
    name: '044-row-045',
    sceneId: 'https://example.org/iiif/scene1',
    annotation: {
      id: 'https://example.org/iiif/3d/anno3',
      type: 'Annotation',
      motivation: ['commenting'],
      body: {
        type: 'TextualBody',
        value: '<p>Right pterygoid hamulus</p>',
        format: 'text/html',
        language: ['en'],
        position: {
          id: 'https://example.org/iiif/3d/anno3/body/position',
          type: 'SpecificResource',
          source: {
            id: 'https://example.org/iiif/scene1',
            type: 'Scene',
          },
          selector: [
            {
              type: 'PointSelector',
              x: 0.04,
              y: 0.0,
              z: -0.066,
            },
          ],
          transform: [
            {
              type: 'RotateTransform',
              x: 0.0,
              y: 180.0,
              z: 0.0,
            },
          ],
        },
      },
      target: {
        id: 'https://example.org/iiif/3d/anno3/target',
        type: 'SpecificResource',
        source: {
          id: 'https://example.org/iiif/scene1',
          type: 'Scene',
        },
        selector: [
          {
            type: 'PointSelector',
            x: 0.04,
            y: 0.063,
            z: -0.066,
          },
        ],
      },
    },
    marker: [0.04, 0.063, -0.066],
    body: [0.04, 0, -0.066],
  },
  {
    name: '065-spec-018',
    sceneId: 'https://iiif.io/api/presentation/4.0/example/uc08/scene/1',
    annotation: {
      id: 'https://example.org/iiif/presentation/examples/commenting/anno/3',
      type: 'Annotation',
      motivation: ['commenting'],
      body: {
        id: 'https://example.org/iiif/presentation/examples/commenting/anno/3/comment1',
        type: 'TextualBody',
        language: 'en',
        format: 'text/plain',
        value:
          'This sculpture embodies the Hellenistic synthesis of idealised form and expressive naturalism that emerged in the late Greek period.',
        position: {
          type: 'SpecificResource',
          source: {
            id: 'https://iiif.io/api/presentation/4.0/example/uc08/scene/1',
            type: 'Scene',
          },
          selector: [
            {
              type: 'PointSelector',
              x: 0.75,
              y: 1.5,
              z: 0.1,
            },
          ],
        },
      },
      target: {
        id: 'https://iiif.io/api/presentation/4.0/example/uc08/scene/1',
        type: 'Scene',
      },
    },
    marker: [0, 0, 0],
    body: [0.75, 1.5, 0.1],
  },
];

async function points(input: any, sceneId: string) {
  const vault = new Vault4();
  const scene = vault.loadSync(sceneId, {
    id: sceneId,
    type: 'Scene',
    annotations: [{ id: `${sceneId}/page`, type: 'AnnotationPage', items: [input] }],
  }) as any;
  const annotation = vault.get<any>(input.id)!;
  const store = createSceneRuntimeStore(scene, { time: 0, playing: false, playbackRate: 1 });
  store.setState({ selectedAnnotation: annotation.id });
  const runtime = {
    scene,
    vault,
    store,
    annotationMarkerSize: 16,
    resolvePoint: () => null,
    register: vi.fn(() => () => undefined),
    selectAnnotation: vi.fn(),
  } as any;
  const renderer = await ReactThreeTestRenderer.create(
    <SceneRuntimeContext.Provider value={runtime}>
      <group position={[10, 20, 30]} scale={[2, 2, 2]}>
        <Annotation3D
          annotation={annotation}
          instancePath="instance"
          popover={({ point }) => <group name="body" position={point} />}
        >
          {({ point }) => <group name="marker" position={point} />}
        </Annotation3D>
      </group>
    </SceneRuntimeContext.Provider>
  );
  const marker = renderer.scene.findByProps({ name: 'marker' }).instance;
  const body = renderer.scene.findByProps({ name: 'body' }).instance;
  const result = {
    marker: marker.position.toArray(),
    body: body.position.toArray(),
    world: body.getWorldPosition(new Vector3()).toArray(),
    annotation,
    vault,
  };
  await renderer.unmount();
  return result;
}

describe('TextualBody popover position', () => {
  test.each(cases)('$name keeps the marker target and independently anchors the body', async (entry) => {
    const result = await points(entry.annotation, entry.sceneId);
    expect(result.marker).toEqual(entry.marker);
    expect(result.body).toEqual(entry.body);
    expect(result.world).toEqual(entry.body.map((value, axis) => value * 2 + [10, 20, 30][axis]));
    // Exercise native normalized body references rather than only inline objects.
    expect(result.annotation.body).not.toHaveProperty('value');
  });

  test('falls back to the annotation target when the textual body has no position', async () => {
    const entry = cases[0];
    const annotation = structuredClone(entry.annotation) as any;
    delete annotation.body.position;
    const result = await points(annotation, entry.sceneId);
    expect(result.body).toEqual(entry.marker);
    expect(result.marker).toEqual(entry.marker);
  });

  test('preserves an explicitly authored origin rather than using the marker target', async () => {
    const entry = cases[0];
    const annotation = structuredClone(entry.annotation) as any;
    Object.assign(annotation.body.position.selector[0], { x: 0, y: 0, z: 0 });
    expect((await points(annotation, entry.sceneId)).body).toEqual([0, 0, 0]);
  });

  test('resolves a normalized Choice and its referenced textual body position', async () => {
    const entry = cases[2];
    const annotation = structuredClone(entry.annotation) as any;
    annotation.body = { id: 'https://example.org/body-choice', type: 'Choice', items: [annotation.body] };
    const result = await points(annotation, entry.sceneId);
    expect(result.annotation.body).not.toHaveProperty('items');
    expect(result.body).toEqual(entry.body);
    expect(result.marker).toEqual(entry.marker);
  });

  test('retains legacy annotation.position when the textual body has no anchor', async () => {
    const entry = cases[0];
    const annotation = structuredClone(entry.annotation) as any;
    annotation.position = annotation.body.position;
    delete annotation.body.position;
    expect((await points(annotation, entry.sceneId)).body).toEqual(entry.body);
  });
});
