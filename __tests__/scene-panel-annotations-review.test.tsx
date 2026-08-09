/**
 * @vitest-environment happy-dom
 */

import React, { act } from 'react';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { render, screen, waitFor } from '@testing-library/react';
import { Vault4 } from '@iiif/helpers/vault-4';
import { describe, expect, test, vi } from 'vitest';
import {
  Annotation3D,
  AnnotationPage3D,
  createGeometryMarkerBuffers,
  sanitizeSvgSelector,
  useExternalAnnotationPage,
} from '../src/scene-panel/annotations';
import { SceneRuntimeContext } from '../src/scene-panel/context';
import { createSceneRuntimeStore } from '../src/scene-panel/store';
import { createChessManifest } from '../src/demo/chess-manifest';

function runtimeWith(overrides: Record<string, unknown>) {
  return {
    scene: { id: 'https://example.org/scene', type: 'Scene', items: [] },
    annotationMarkerSize: 16,
    annotationMarker: false,
    annotationPopover: false,
    resolvePoint: () => null,
    diagnostic: vi.fn(),
    ...overrides,
  } as any;
}

describe('Scene annotation regressions', () => {
  test('distinguishes target-less annotations from explicit whole-Scene targets', async () => {
    const input = createChessManifest('1. e4');
    const vault = new Vault4();
    const manifest = vault.loadManifestSync(input.id, input) as any;
    const scene = vault.get<any>(manifest.items, { parent: manifest })[0];
    const page = vault.get<any>(scene.annotations, { parent: scene })[0];
    const annotation = vault
      .get<any>(page.items, { parent: page })
      .find((item: any) => item.motivation.includes('commenting'));
    const store = createSceneRuntimeStore(scene, { time: 0, playing: false, playbackRate: 1 });
    const register = vi.fn(() => () => undefined);
    const runtime = runtimeWith({
      scene,
      store,
      vault,
      register,
      annotationMarker: undefined,
    });
    const renderer = await ReactThreeTestRenderer.create(
      <SceneRuntimeContext.Provider value={runtime}>
        <Annotation3D annotation={annotation} popover={false} />
      </SceneRuntimeContext.Provider>
    );
    let marker: any = null;
    renderer.scene.instance.traverse((object: any) => {
      if (object.geometry?.type === 'SphereGeometry') marker = object.parent;
    });

    expect(annotation.target).toMatchObject({ type: 'List', items: [] });
    expect(marker).toBeNull();
    expect(register).not.toHaveBeenCalled();
    await renderer.unmount();

    const targeted = {
      ...annotation,
      id: `${annotation.id}/targeted`,
      target: { id: scene.id, type: 'Scene' },
    };
    const targetedRenderer = await ReactThreeTestRenderer.create(
      <SceneRuntimeContext.Provider value={runtime}>
        <Annotation3D annotation={targeted} popover={false} />
      </SceneRuntimeContext.Provider>
    );
    targetedRenderer.scene.instance.traverse((object: any) => {
      if (object.geometry?.type === 'SphereGeometry') marker = object.parent;
    });

    expect(marker).toBeTruthy();
    expect(marker.position.toArray()).toEqual([0, 0, 0]);
    expect(register).toHaveBeenCalledOnce();
    await targetedRenderer.unmount();
  });

  test('does not connect separate lines and triangulates polygon holes and multi-polygons independently', () => {
    const lines = createGeometryMarkerBuffers({
      type: 'MultiLineString',
      coordinates: [
        [
          [0, 0, 0],
          [1, 0, 0],
        ],
        [
          [10, 0, 0],
          [11, 0, 0],
        ],
      ],
    });
    expect(lines.outline.getAttribute('position').count).toBe(4);
    expect(lines.surface).toBeNull();
    lines.outline.dispose();

    const polygon = createGeometryMarkerBuffers({
      type: 'Polygon',
      coordinates: [
        [
          [0, 0, 0],
          [4, 0, 0],
          [4, 4, 0],
          [0, 4, 0],
          [0, 0, 0],
        ],
        [
          [1, 1, 0],
          [1, 3, 0],
          [3, 3, 0],
          [3, 1, 0],
          [1, 1, 0],
        ],
      ],
    });
    expect(polygon.surface?.getAttribute('position').count).toBe(8);
    expect(polygon.surface?.getIndex()?.count).toBe(24);
    polygon.outline.dispose();
    polygon.surface?.dispose();

    const multiPolygon = createGeometryMarkerBuffers({
      type: 'MultiPolygon',
      coordinates: [
        [
          [
            [0, 0, 0],
            [1, 0, 0],
            [0, 1, 0],
            [0, 0, 0],
          ],
        ],
        [
          [
            [10, 0, 0],
            [11, 0, 0],
            [10, 1, 0],
            [10, 0, 0],
          ],
        ],
      ],
    });
    expect(multiPolygon.surface?.getAttribute('position').count).toBe(6);
    expect(multiPolygon.surface?.getIndex()?.count).toBe(6);
    multiPolygon.outline.dispose();
    multiPolygon.surface?.dispose();
  });

  test('exposes a WKT geometry center to render props and resource bounds', async () => {
    const annotation = {
      id: 'https://example.org/geometry-annotation',
      type: 'Annotation',
      motivation: ['commenting'],
      body: [],
      target: {
        type: 'SpecificResource',
        source: { id: 'https://example.org/scene', type: 'Scene' },
        selector: {
          type: 'WktSelector',
          value: 'POLYGON Z ((2 4 6, 6 4 6, 6 8 10, 2 8 10, 2 4 6))',
        },
      },
    } as any;
    const store = createSceneRuntimeStore({ id: 'https://example.org/scene', type: 'Scene', items: [] } as any, {
      time: 0,
      playing: false,
      playbackRate: 1,
    });
    let registration: any;
    const register = vi.fn((value: any) => {
      registration = value;
      return () => undefined;
    });
    let markerPoint: [number, number, number] | undefined;
    const runtime = runtimeWith({
      store,
      register,
      vault: {
        get: (input: unknown) => (input === annotation.id ? annotation : undefined),
      },
    });

    const renderer = await ReactThreeTestRenderer.create(
      <SceneRuntimeContext.Provider value={runtime}>
        <Annotation3D annotation={annotation} popover={false}>
          {({ point }) => {
            markerPoint = point;
            return <group name="geometry-marker" position={point} />;
          }}
        </Annotation3D>
      </SceneRuntimeContext.Provider>
    );

    expect(markerPoint).toEqual([4, 6, 8]);
    expect(registration.getBounds()).toEqual([4, 6, 8]);
    await renderer.unmount();
  });

  test('registers repeated transformed annotation instances independently in root coordinates', async () => {
    const annotation = {
      id: 'https://example.org/repeated-comment',
      type: 'Annotation',
      motivation: ['commenting'],
      body: [],
      target: {
        type: 'SpecificResource',
        source: { id: 'https://example.org/scene', type: 'Scene' },
        selector: { type: 'PointSelector', x: 1, y: 0, z: 0 },
      },
    } as any;
    const store = createSceneRuntimeStore({ id: 'https://example.org/scene', type: 'Scene', items: [] } as any, {
      time: 0,
      playing: false,
      playbackRate: 1,
    });
    const registrations = new Map<string, any>();
    const unregistered = new Map<string, any>();
    const runtime = runtimeWith({
      store,
      vault: { get: (input: unknown) => (input === annotation.id ? annotation : undefined) },
      register: (registration: any) => {
        registrations.set(registration.path, registration);
        const cleanup = vi.fn(() => registrations.delete(registration.path));
        unregistered.set(registration.path, cleanup);
        return cleanup;
      },
    });
    const leftPath = `root/left/supplementary/${annotation.id}`;
    const rightPath = `root/right/supplementary/${annotation.id}`;
    const contents = (left: boolean) => (
      <SceneRuntimeContext.Provider value={runtime}>
        {left ? (
          <group position={[-2, 0, 0]}>
            <Annotation3D annotation={annotation} instancePath="root/left" popover={false}>
              {() => <group name="repeated-marker" />}
            </Annotation3D>
          </group>
        ) : null}
        <group position={[2, 0, 0]}>
          <Annotation3D annotation={annotation} instancePath="root/right" popover={false}>
            {() => <group name="repeated-marker" />}
          </Annotation3D>
        </group>
      </SceneRuntimeContext.Provider>
    );
    const renderer = await ReactThreeTestRenderer.create(contents(true));

    expect([...registrations.keys()]).toEqual([leftPath, rightPath]);
    expect(registrations.get(leftPath).getBounds()).toEqual([-1, 0, 0]);
    expect(registrations.get(rightPath).getBounds()).toEqual([3, 0, 0]);
    expect(registrations.get(leftPath).instancePath).toBe('root/left');
    await act(async () =>
      store.setState((state) => ({
        resources: {
          ...state.resources,
          [leftPath]: {
            hidden: true,
            disabled: false,
            selected: false,
            playing: false,
            activeAnimation: null,
            resetVersion: 0,
            transformOverride: null,
            type: 'annotation',
            interactionMode: [],
          },
        },
      }))
    );
    expect(registrations.get(leftPath).getBounds()).toEqual([-1, 0, 0]);
    expect(registrations.get(rightPath).getBounds()).toEqual([3, 0, 0]);
    await renderer.update(contents(false));
    expect(unregistered.get(leftPath)).toHaveBeenCalledOnce();
    expect(unregistered.get(rightPath)).not.toHaveBeenCalled();
    await renderer.unmount();
  });

  test('rejects nested SVG data URLs while retaining local references and raster data', () => {
    const svg = sanitizeSvgSelector(`<svg xmlns="http://www.w3.org/2000/svg">
      <defs><path id="shape" d="M0 0L1 1" /></defs>
      <use href="#shape" />
      <image id="nested" href="data:image/svg+xml,%3Csvg%3E%3Cscript%3Ebad()%3C/script%3E%3C/svg%3E" />
      <image id="raster" href="data:image/png;base64,iVBORw0KGgo=" />
    </svg>`);
    expect(svg).toContain('href="#shape"');
    expect(svg).toContain('data:image/png;base64,iVBORw0KGgo=');
    expect(svg).not.toContain('data:image/svg+xml');
    expect(() =>
      sanitizeSvgSelector('<svg xmlns="http://www.w3.org/2000/svg"><style>.safe { color: \\ffffff }</style></svg>')
    ).not.toThrow();
  });

  test('loads the current external page and ignores a late result for the previous id', async () => {
    const pending = new Map<string, (value: unknown) => void>();
    const vault = {
      get: vi.fn(() => undefined),
      load: vi.fn(
        (id: string) =>
          new Promise((resolve) => {
            pending.set(id, resolve);
          })
      ),
    };
    const runtime = runtimeWith({ vault });
    function Probe({ id }: { id: string }) {
      const page = useExternalAnnotationPage(id);
      return <span>{page?.id || 'loading'}</span>;
    }
    const view = render(
      <SceneRuntimeContext.Provider value={runtime}>
        <Probe id="page-a" />
      </SceneRuntimeContext.Provider>
    );
    await waitFor(() => expect(vault.load).toHaveBeenCalledWith('page-a'));
    view.rerender(
      <SceneRuntimeContext.Provider value={runtime}>
        <Probe id="page-b" />
      </SceneRuntimeContext.Provider>
    );
    await waitFor(() => expect(vault.load).toHaveBeenCalledWith('page-b'));

    await act(async () => pending.get('page-a')?.({ id: 'page-a' }));
    expect(screen.getByText('loading')).toBeTruthy();
    await act(async () => pending.get('page-b')?.({ id: 'page-b' }));
    expect(screen.getByText('page-b')).toBeTruthy();
  });

  test('honors activation hide and disable state for annotations', async () => {
    const annotation = {
      id: 'https://example.org/annotation',
      type: 'Annotation',
      motivation: ['commenting'],
      body: [],
      target: {
        type: 'SpecificResource',
        source: { id: 'https://example.org/scene', type: 'Scene' },
        selector: { type: 'PointSelector', x: 1, y: 2, z: 3 },
      },
    } as any;
    const page = {
      id: 'https://example.org/page',
      type: 'AnnotationPage',
      items: [{ id: annotation.id, type: 'Annotation' }],
    };
    const store = createSceneRuntimeStore({ id: 'https://example.org/scene', type: 'Scene', items: [] } as any, {
      time: 0,
      playing: false,
      playbackRate: 1,
    });
    const selectAnnotation = vi.fn();
    const onSelect = vi.fn();
    const path = 'https://example.org/scene/supplementary/https://example.org/annotation';
    let activate: () => void = () => undefined;
    let popoverPoint: [number, number, number] | undefined;
    const Popover = ({ point }: { point: [number, number, number] }) => {
      popoverPoint = point;
      return <group name="annotation-popover" position={point} />;
    };
    store.setState({ selectedAnnotation: annotation.id });
    const runtime = runtimeWith({
      store,
      selectAnnotation,
      vault: {
        get: (input: unknown) => {
          if (input === page.id) return page;
          if (input === page.items) return [annotation];
          if (input === annotation.id) return annotation;
          return undefined;
        },
      },
      register: (registration: any) => {
        store.setState((state) => ({
          resources: {
            ...state.resources,
            [registration.path]: {
              hidden: false,
              disabled: false,
              selected: false,
              playing: false,
              activeAnimation: null,
              resetVersion: 0,
              transformOverride: null,
              type: registration.type,
              interactionMode: [],
            },
          },
        }));
        return () => undefined;
      },
    });
    const renderer = await ReactThreeTestRenderer.create(
      <SceneRuntimeContext.Provider value={runtime}>
        <AnnotationPage3D page={page.id} onSelect={onSelect} popover={Popover}>
          {(context) => {
            activate = context.activate;
            return <group name="annotation-marker" />;
          }}
        </AnnotationPage3D>
      </SceneRuntimeContext.Provider>
    );
    expect(renderer.scene.findAllByProps({ name: 'annotation-marker' })).toHaveLength(1);
    expect(popoverPoint).toEqual([1, 2, 3]);
    expect(renderer.scene.findAllByProps({ name: 'annotation-popover' })).toHaveLength(1);

    await act(async () => {
      store.setState((state) => ({
        resources: { ...state.resources, [path]: { ...state.resources[path], hidden: true } },
      }));
    });
    expect(renderer.scene.findAllByProps({ name: 'annotation-marker' })).toHaveLength(0);

    await act(async () => {
      store.setState((state) => ({
        resources: { ...state.resources, [path]: { ...state.resources[path], hidden: false, disabled: true } },
      }));
    });
    activate();
    expect(selectAnnotation).not.toHaveBeenCalled();
    expect(onSelect).not.toHaveBeenCalled();

    await act(async () => {
      store.setState((state) => ({
        resources: { ...state.resources, [path]: { ...state.resources[path], disabled: false } },
      }));
    });
    activate();
    expect(selectAnnotation).toHaveBeenCalledWith({ id: annotation.id, path });
    expect(onSelect).toHaveBeenCalledWith(annotation);
    await renderer.unmount();
  });
});
