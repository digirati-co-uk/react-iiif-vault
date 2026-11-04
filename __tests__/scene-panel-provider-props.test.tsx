import uenoChoice from './fixtures/scene-ueno-choice.json';
import { useCurrentScenePaintables } from '../src/scene-panel/scene-composition';
import { useSceneControls } from '../src/scene-panel/controls';
/**
 * @vitest-environment happy-dom
 */

import React, { useEffect } from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { describe, expect, test, vi } from 'vitest';
import { Vault4 } from '@iiif/helpers/vault-4';
import { ScenePanel, ScenePanelViewer } from '../src/scene-panel/ScenePanel';
import { SceneProvider, useScene, useSceneRuntime } from '../src/scene-panel/context';
import { useSceneAnnotations } from '../src/scene-panel/annotations';
import { ManifestContext } from '../src/context/ManifestContext';
import { VaultProvider } from '../src/context/VaultContext';
import { createSceneClock } from '../src/scene-panel/clock';
import type { ScenePanelHandle } from '../src/scene-panel/types';
import scopeCameraScene from './fixtures/scene-scope-camera.json';

vi.mock('../src/scene-panel/rendering', () => ({
  SceneCanvas: ({ children, composition, ...props }: React.PropsWithChildren<Record<string, any>>) => (
    <div data-testid="scene-canvas" {...props}>
      {composition}
      {children}
    </div>
  ),
}));

const scene = { id: 'https://example.org/scene', type: 'Scene', items: [] } as any;

const manifestAnnotationScene = {
  id: 'https://example.org/manifest/annotations',
  type: 'Manifest',
  label: { en: ['Manifest annotations'] },
  items: [
    {
      id: 'https://example.org/scene/one',
      type: 'Scene',
      items: [
        {
          id: 'https://example.org/scene/one/painting',
          type: 'AnnotationPage',
          items: [
            {
              id: 'https://example.org/camera/painting',
              type: 'Annotation',
              motivation: ['painting'],
              behavior: ['hidden'],
              body: { id: 'https://example.org/camera', type: 'PerspectiveCamera' },
              target: { id: 'https://example.org/scene/one', type: 'Scene' },
            },
          ],
        },
      ],
    },
    { id: 'https://example.org/scene/two', type: 'Scene', items: [] },
  ],
  annotations: [
    {
      id: 'https://example.org/manifest/comments',
      type: 'AnnotationPage',
      items: [
        {
          id: 'https://example.org/comment/one',
          type: 'Annotation',
          motivation: ['commenting'],
          body: { type: 'TextualBody', value: 'Scene one' },
          target: {
            type: 'SpecificResource',
            source: { id: 'https://example.org/scene/one', type: 'Scene' },
            selector: { type: 'PointSelector', x: 1, y: 2, z: 3 },
          },
        },
        {
          id: 'https://example.org/comment/two',
          type: 'Annotation',
          motivation: ['commenting'],
          body: { type: 'TextualBody', value: 'Scene two' },
          target: { id: 'https://example.org/scene/two', type: 'Scene' },
        },
        {
          id: 'https://example.org/activation/one',
          type: 'Annotation',
          motivation: ['activating'],
          target: { id: 'https://example.org/comment/one', type: 'Annotation' },
          body: {
            type: 'SpecificResource',
            source: { id: 'https://example.org/camera/painting', type: 'Annotation' },
            action: ['show', 'enable', 'select'],
          },
        },
      ],
    },
  ],
} as any;

describe('ScenePanel provider props and lifecycle', () => {
  test('lets a host replace the icon without replacing the metadata loading status', async () => {
    const vault = new Vault4();
    vi.spyOn(vault, 'load').mockImplementation((() => new Promise(() => {})) as any);
    const { unmount } = render(
      <SceneProvider
        vault={vault}
        scene="https://example.org/pending-scene"
        loadingIcon={<svg data-testid="host-loading-icon" aria-hidden="true" />}
      >
        <div>Loaded Scene</div>
      </SceneProvider>
    );
    expect(await screen.findByTestId('host-loading-icon')).toBeTruthy();
    expect(screen.getByRole('status', { name: 'Loading 3D scene' }).textContent).toContain('Loading 3D scene');
    expect(screen.queryByText('Loaded Scene')).toBeNull();
    unmount();
  });
  test('exposes provider and viewer primitives for host-owned layouts', () => {
    expect(ScenePanel.Provider).toBe(SceneProvider);
    expect(ScenePanel.Viewer).toBe(ScenePanelViewer);
    expect('Controls' in ScenePanel).toBe(false);
  });

  test('reuses a Presentation 4 vault from another package copy', async () => {
    const backingVault = new Vault4();
    const crossCopyVault = new Proxy(
      { presentationVersion: 4 },
      {
        get(target, property) {
          if (property in target) return target[property as keyof typeof target];
          const value = backingVault[property as keyof Vault4];
          return typeof value === 'function' ? value.bind(backingVault) : value;
        },
      }
    ) as unknown as Vault4;
    expect(crossCopyVault).not.toBeInstanceOf(Vault4);

    function Probe() {
      return <span>{useSceneRuntime().vault === crossCopyVault ? 'reused' : 'replaced'}</span>;
    }

    render(
      <VaultProvider vault={crossCopyVault} version={4}>
        <SceneProvider scene={scene}>
          <Probe />
        </SceneProvider>
      </VaultProvider>
    );

    await waitFor(() => expect(screen.getByText('reused')).toBeTruthy());
  });

  test('forwards viewer options through ScenePanel', async () => {
    function Probe() {
      const runtime = useSceneRuntime();
      return (
        <span>
          {runtime.annotations}:{runtime.transitionDuration}:{runtime.stage ? runtime.stage.size : 'off'}:
          {String(runtime.debugLights)}:{runtime.annotationMarkerSize}:{String(runtime.cameraCue)}:
          {runtime.cameraPadding}:{runtime.cameraZoom.sensitivity}:{runtime.ktx2TranscoderPath}:
          {runtime.cameraControls.mode}:{runtime.cameraControls.movementSpeed}:{runtime.cameraControls.lookSpeed}:
          {String(runtime.cameraControls.invertLook)}:{runtime.orbitTarget?.toString()}:{runtime.hoverHighlightModels}
        </span>
      );
    }

    render(
      <ScenePanel
        scene={scene}
        annotations="none"
        transitions={{ duration: 0.25 }}
        stage={{ size: 24 }}
        debug={{ lights: true }}
        annotationMarkerSize={20}
        cameraCue={false}
        cameraPadding={1.8}
        cameraZoom={{ sensitivity: 2 }}
        cameraControls={{ mode: 'fly', movementSpeed: 3 }}
        orbitTarget={[1, 2, 3]}
        hoverHighlightModels="rgba(255, 0, 0, 0.3)"
        ktx2TranscoderPath="/basis"
        canvasProps={{ id: 'forwarded-canvas' }}
        composition={<span>custom-composition</span>}
      >
        <Probe />
      </ScenePanel>
    );

    await waitFor(() =>
      expect(
        screen.getByText('none:0.25:24:true:20:false:1.8:2:/basis/:fly:3:0.005:false:1,2,3:rgba(255, 0, 0, 0.3)')
      ).toBeTruthy()
    );
    expect(screen.getByTestId('scene-canvas').id).toBe('forwarded-canvas');
    expect(screen.getByText('custom-composition')).toBeTruthy();
  });

  test('uses a Scene reached through a Manifest start SpecificResource', async () => {
    const manifest = {
      id: 'https://example.org/manifest',
      type: 'Manifest',
      label: { en: ['Manifest'] },
      items: [
        { id: 'https://example.org/scene/one', type: 'Scene', items: [] },
        { id: 'https://example.org/scene/two', type: 'Scene', items: [] },
      ],
      start: {
        type: 'SpecificResource',
        source: { id: 'https://example.org/scene/two', type: 'Scene' },
        selector: { type: 'PointSelector', x: 1, y: 2, z: 3 },
      },
    } as any;

    function Probe() {
      return <span>{useSceneRuntime().scene.id}</span>;
    }

    render(
      <SceneProvider manifest={manifest}>
        <Probe />
      </SceneProvider>
    );

    await waitFor(() => expect(screen.getByText('https://example.org/scene/two')).toBeTruthy());
  });

  test('fetches a URL Scene when only a normalized reference is cached', async () => {
    const vault = new Vault4();
    vault.loadManifestSync('https://example.org/reference-manifest', {
      id: 'https://example.org/reference-manifest',
      type: 'Manifest',
      items: [{ id: scene.id, type: 'Scene' }],
    } as any);
    const load = vi
      .spyOn(vault, 'load')
      .mockImplementation(async (id: any) => vault.loadSync(id, { ...scene, label: { en: ['Fetched Scene'] } }) as any);
    function Probe() {
      return <span>{useScene().label?.en?.[0]}</span>;
    }
    render(
      <SceneProvider vault={vault} scene={scene.id}>
        <Probe />
      </SceneProvider>
    );
    await screen.findByText('Fetched Scene');
    expect(load).toHaveBeenCalledOnce();
  });

  test('loads external painting pages before onReady and exposes their content', async () => {
    const vault = new Vault4();
    const input = { ...scene, items: [{ id: 'https://example.org/painting-page', type: 'AnnotationPage' }] };
    const onReady = vi.fn();
    let finish!: () => void;
    const loading = new Promise<void>((resolve) => {
      finish = resolve;
    });
    vi.spyOn(vault, 'load').mockImplementation(async (id: any) => {
      await loading;
      return vault.loadSync(id, {
        id,
        type: 'AnnotationPage',
        items: [
          {
            id: 'https://example.org/painting',
            type: 'Annotation',
            motivation: ['painting'],
            target: { id: scene.id, type: 'Scene' },
            body: { id: 'https://example.org/model.glb', type: 'Model' },
          },
        ],
      }) as any;
    });
    render(
      <SceneProvider vault={vault} scene={input} onReady={onReady} loadingFallback={<span>waiting for page</span>}>
        <span>painting ready</span>
      </SceneProvider>
    );
    await waitFor(() => expect(vault.load).toHaveBeenCalledWith('https://example.org/painting-page'));
    expect(onReady).not.toHaveBeenCalled();
    expect(screen.getByText('waiting for page')).toBeTruthy();
    await act(async () => finish());
    await screen.findByText('painting ready');
    expect(onReady).toHaveBeenCalledOnce();
    expect(vault.get<any>('https://example.org/painting').body).toBeTruthy();
  });

  test('reports a failed painting page instead of publishing an empty ready Scene', async () => {
    const vault = new Vault4();
    vi.spyOn(vault, 'load').mockRejectedValue(new Error('offline'));
    const onReady = vi.fn();
    const onDiagnostic = vi.fn();
    render(
      <SceneProvider
        vault={vault}
        scene={{ ...scene, items: [{ id: 'https://example.org/offline-page', type: 'AnnotationPage' }] }}
        onReady={onReady}
        onDiagnostic={onDiagnostic}
        children={null}
      />
    );
    await screen.findByRole('alert');
    expect(onReady).not.toHaveBeenCalled();
    expect(onDiagnostic).toHaveBeenCalledWith(expect.objectContaining({ code: 'scene-load-failed' }));
  });

  test('replaces loading with a render error and recovers when composition changes', async () => {
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    function BrokenComposition(): React.ReactNode {
      throw new Error('broken composition');
    }
    const onDiagnostic = vi.fn();
    try {
      const view = render(
        <ScenePanel
          scene={scene}
          composition={<BrokenComposition />}
          onDiagnostic={onDiagnostic}
          loadingFallback={<span>loading resources</span>}
        />
      );
      await screen.findByRole('alert');
      expect(screen.queryByText('loading resources')).toBeNull();
      expect(onDiagnostic).toHaveBeenCalledWith(expect.objectContaining({ code: 'scene-render-failed' }));
      view.rerender(<ScenePanel scene={scene} composition={<span>recovered composition</span>} />);
      await screen.findByText('recovered composition');
      expect(screen.queryByRole('alert')).toBeNull();
    } finally {
      quiet.mockRestore();
    }
  });

  test('honors an intentionally empty loading fallback', async () => {
    render(<ScenePanel scene={scene} loadingFallback={null} />);

    await waitFor(() => expect(screen.getByTestId('scene-canvas')).toBeTruthy());
    expect(screen.queryByRole('region', { name: 'Scene controls' })).toBeNull();
    expect(screen.queryByText('Loading scene resources…')).toBeNull();
    expect(screen.queryByText('Loading 3D scene…')).toBeNull();
  });

  test('uses the latest callback when an in-flight Scene load completes', async () => {
    let resolveScene!: (value: unknown) => void;
    const loaded = new Promise((resolve) => {
      resolveScene = resolve;
    });
    const vault = new Vault4();
    vi.spyOn(vault, 'load').mockReturnValue(loaded as any);
    const firstReady = vi.fn();
    const latestReady = vi.fn();
    const view = render(
      <SceneProvider vault={vault} scene={scene.id} onReady={firstReady}>
        <span>ready</span>
      </SceneProvider>
    );

    view.rerender(
      <SceneProvider vault={vault} scene={scene.id} onReady={latestReady}>
        <span>ready</span>
      </SceneProvider>
    );
    resolveScene(scene);

    await waitFor(() => expect(screen.getByText('ready')).toBeTruthy());
    expect(firstReady).not.toHaveBeenCalled();
    expect(latestReady).toHaveBeenCalledWith(expect.objectContaining({ id: scene.id }));
    expect(vault.load).toHaveBeenCalledOnce();
  });

  test('rejects a loaded resource that is not a Scene', async () => {
    const vault = new Vault4();
    vi.spyOn(vault, 'load').mockResolvedValue({ id: scene.id, type: 'Canvas' } as any);
    const onDiagnostic = vi.fn();

    render(
      <SceneProvider vault={vault} scene={scene.id} onDiagnostic={onDiagnostic}>
        <span>ready</span>
      </SceneProvider>
    );

    await waitFor(() =>
      expect(onDiagnostic).toHaveBeenCalledWith(expect.objectContaining({ code: 'scene-not-found' }))
    );
    expect(screen.queryByText('ready')).toBeNull();
  });

  test('preserves registrations and the imperative handle across option rerenders', async () => {
    let runtime!: ReturnType<typeof useSceneRuntime>;
    const firstDiagnostic = vi.fn();
    const latestDiagnostic = vi.fn();

    function Probe() {
      runtime = useSceneRuntime();
      useEffect(
        () =>
          runtime.register({
            path: 'model',
            ids: ['model'],
            type: 'model',
          }),
        [runtime.register]
      );
      return <span>{runtime.cameraZoom.sensitivity}</span>;
    }

    const view = render(
      <SceneProvider scene={scene} cameraZoom={{ sensitivity: 1 }} onDiagnostic={firstDiagnostic}>
        <Probe />
      </SceneProvider>
    );
    await waitFor(() => expect(runtime.store.getState().resources.model).toBeTruthy());
    const register = runtime.register;
    const handle = runtime.handle();
    act(() =>
      runtime.store.setState((state) => ({
        resources: { ...state.resources, model: { ...state.resources.model, selected: true } },
      }))
    );

    view.rerender(
      <SceneProvider scene={scene} cameraZoom={{ sensitivity: 2 }} onDiagnostic={latestDiagnostic}>
        <Probe />
      </SceneProvider>
    );
    await waitFor(() => expect(screen.getByText('2')).toBeTruthy());

    expect(runtime.register).toBe(register);
    expect(runtime.handle()).toBe(handle);
    expect(runtime.store.getState().resources.model.selected).toBe(true);

    act(() => {
      runtime.diagnostic({
        code: 'model-load-failed',
        resourceId: 'model',
        severity: 'warning',
        message: 'First failure',
      });
      runtime.diagnostic({
        code: 'model-load-failed',
        resourceId: 'model',
        severity: 'warning',
        message: 'Latest failure',
      });
    });
    expect(runtime.handle().getSnapshot().errors).toEqual({ 'model-load-failed:model': 'Latest failure' });
    expect(firstDiagnostic).not.toHaveBeenCalled();
    expect(latestDiagnostic).toHaveBeenCalledTimes(2);
  });

  test('replaces same-ID embedded Scene content and runtime ownership', async () => {
    let runtime!: ReturnType<typeof useSceneRuntime>;
    const first = { ...scene, label: { en: ['first'] }, duration: 1 } as any;
    const second = { ...scene, label: { en: ['second'] }, duration: 9 } as any;
    function Probe() {
      runtime = useSceneRuntime();
      const current = useScene();
      return <span>{`${current.label?.en?.[0]}:${runtime.store.getState().duration}`}</span>;
    }
    const view = render(
      <SceneProvider scene={first}>
        <Probe />
      </SceneProvider>
    );
    await screen.findByText('first:1');
    const firstStore = runtime.store;

    view.rerender(
      <SceneProvider scene={second}>
        <Probe />
      </SceneProvider>
    );
    await screen.findByText('second:9');
    expect(runtime.store).not.toBe(firstStore);
    expect(runtime.clock.getSnapshot().time).toBe(0);
    expect(runtime.handle().getSnapshot()).toMatchObject({ sceneId: scene.id, duration: 9 });
  });

  test('refreshes runtime state after a same-ID Vault mutation', async () => {
    const vault = new Vault4();
    let runtime!: ReturnType<typeof useSceneRuntime>;
    function Probe() {
      runtime = useSceneRuntime();
      return <span>{runtime.scene.duration}</span>;
    }
    render(
      <SceneProvider vault={vault} scene={{ ...scene, duration: 1 } as any}>
        <Probe />
      </SceneProvider>
    );
    await screen.findByText('1');
    act(() => vault.modifyEntityField({ id: scene.id, type: 'Scene' }, 'duration', 7));
    await screen.findByText('7');
    expect(runtime.store.getState().duration).toBe(7);
    expect(runtime.handle().getSnapshot().duration).toBe(7);
  });

  test('reconciles temporal activations at zero, reset, and crossed seeks', async () => {
    const zero = 'https://example.org/painting/zero';
    const crossed = 'https://example.org/painting/crossed';
    const temporalScene = {
      id: 'https://example.org/scene/temporal',
      type: 'Scene',
      duration: 20,
      items: [
        {
          id: 'https://example.org/scene/temporal/paintings',
          type: 'AnnotationPage',
          items: [zero, crossed].map((id) => ({
            id,
            type: 'Annotation',
            motivation: ['painting'],
            body: { id: `${id}/model`, type: 'Model' },
            target: 'https://example.org/scene/temporal',
          })),
        },
      ],
      annotations: [
        {
          id: 'https://example.org/scene/temporal/activations',
          type: 'AnnotationPage',
          items: [
            { id: 'zero', source: zero, interval: 't=0,5' },
            { id: 'crossed', source: crossed, interval: 't=3,5' },
          ].map(({ id, source, interval }) => ({
            id: `https://example.org/activation/${id}`,
            type: 'Annotation',
            motivation: ['activating'],
            body: { type: 'SpecificResource', source: { id: source, type: 'Annotation' }, action: ['show'] },
            target: {
              type: 'SpecificResource',
              source: { id: 'https://example.org/scene/temporal', type: 'Scene' },
              selector: { type: 'FragmentSelector', value: interval },
            },
          })),
        },
      ],
    } as any;
    const clock = createSceneClock(20);
    let runtime!: ReturnType<typeof useSceneRuntime>;
    function Probe() {
      runtime = useSceneRuntime();
      useEffect(() => {
        const unregisterZero = runtime.register({
          path: 'zero',
          ids: [zero],
          type: 'model',
          supportedActions: ['show'],
          initial: { visible: false },
        });
        const unregisterCrossed = runtime.register({
          path: 'crossed',
          ids: [crossed],
          type: 'model',
          supportedActions: ['show'],
          initial: { visible: false },
        });
        return () => {
          unregisterCrossed();
          unregisterZero();
        };
      }, [runtime.register]);
      return <span>temporal-ready</span>;
    }
    render(
      <SceneProvider scene={temporalScene} clock={clock}>
        <Probe />
      </SceneProvider>
    );
    await screen.findByText('temporal-ready');
    await waitFor(() => expect(runtime.store.getState().resources.zero.hidden).toBe(false));
    expect(runtime.store.getState().resources.crossed.hidden).toBe(true);

    act(() => clock.seek(10));
    expect(runtime.store.getState().resources.crossed.hidden).toBe(false);
    act(() => {
      runtime.store.setState((state) => ({
        resources: { ...state.resources, crossed: { ...state.resources.crossed, hidden: true } },
      }));
      clock.seek(0);
    });
    expect(runtime.store.getState().resources.crossed.hidden).toBe(false);
    act(() => runtime.reset());
    expect(runtime.store.getState().resources.zero.hidden).toBe(false);
  });

  test('activates a scoped hidden camera when its Scene resource registers', async () => {
    const panel = React.createRef<ScenePanelHandle>();
    let runtime!: ReturnType<typeof useSceneRuntime>;
    function Probe() {
      runtime = useSceneRuntime();
      return null;
    }
    render(
      <ScenePanel ref={panel} scene={scopeCameraScene as any}>
        <Probe />
      </ScenePanel>
    );
    await waitFor(() => expect(panel.current).toBeTruthy());

    let activation!: ReturnType<ScenePanelHandle['activate']>;
    act(() => {
      activation = panel.current!.activate('https://example.org/annotation/comment');
    });
    expect(activation).toEqual({
      ok: true,
      annotationIds: ['https://example.org/annotation/comment'],
    });

    const cameraPath = `${scopeCameraScene.id}/https://example.org/annotation/camera/0`;
    act(() => {
      runtime.register({
        path: cameraPath,
        ids: ['https://example.org/annotation/camera', 'https://example.org/camera'],
        annotationId: 'https://example.org/annotation/camera',
        resourceId: 'https://example.org/camera',
        resourceType: 'PerspectiveCamera',
        type: 'perspective-camera',
        supportedActions: ['show', 'enable', 'select'],
        initial: { visible: false },
      });
    });

    await waitFor(() =>
      expect(panel.current!.getSnapshot()).toMatchObject({
        activeCamera: cameraPath,
        resources: { [cameraPath]: { visible: true, disabled: false, selected: true } },
        errors: {},
      })
    );
  });

  test('inherits and filters Manifest annotations for the current Scene', async () => {
    const vault = new Vault4();
    vault.loadManifestSync(manifestAnnotationScene.id, manifestAnnotationScene);
    const panel = React.createRef<ScenePanelHandle>();
    let runtime!: ReturnType<typeof useSceneRuntime>;
    function Probe() {
      runtime = useSceneRuntime();
      return (
        <span>
          {useSceneAnnotations()
            .map((annotation) => annotation.id)
            .join(',')}
        </span>
      );
    }
    render(
      <VaultProvider vault={vault} version={4}>
        <ManifestContext manifest={manifestAnnotationScene.id}>
          <ScenePanel ref={panel} scene="https://example.org/scene/one">
            <Probe />
          </ScenePanel>
        </ManifestContext>
      </VaultProvider>
    );
    await screen.findByText('https://example.org/comment/one');
    expect(screen.queryByText(/https:\/\/example\.org\/comment\/two/)).toBeNull();

    const cameraPath = 'https://example.org/scene/one/https://example.org/camera/painting/0';
    act(() => {
      runtime.register({
        path: cameraPath,
        ids: ['https://example.org/camera/painting', 'https://example.org/camera'],
        annotationId: 'https://example.org/camera/painting',
        resourceId: 'https://example.org/camera',
        resourceType: 'PerspectiveCamera',
        type: 'perspective-camera',
        supportedActions: ['show', 'enable', 'select'],
        initial: { visible: false },
      });
    });
    let activation!: ReturnType<ScenePanelHandle['activate']>;
    act(() => {
      activation = panel.current!.activate('https://example.org/comment/one');
    });
    expect(activation).toMatchObject({ ok: true });
    expect(panel.current!.getSnapshot()).toMatchObject({
      activeCamera: cameraPath,
      resources: { [cameraPath]: { visible: true, disabled: false, selected: true } },
      errors: {},
    });
  });

  test('renders the dedicated fallback during server rendering', () => {
    const html = renderToString(
      <SceneProvider scene={scene} ssrFallback={<p>Server scene fallback</p>} loadingFallback={<p>Loading</p>}>
        <span>ready</span>
      </SceneProvider>
    );

    expect(html).toContain('Server scene fallback');
    expect(html).not.toContain('Loading');
  });
});

test('selection returns real activation failures, ordinary notes succeed, and preview is isolated', async () => {
  const panel = React.createRef<ScenePanelHandle>();
  let runtime!: ReturnType<typeof useSceneRuntime>;
  function Probe() {
    runtime = useSceneRuntime();
    return null;
  }
  render(
    <ScenePanel ref={panel} scene={scopeCameraScene as any}>
      <Probe />
    </ScenePanel>
  );
  await waitFor(() => expect(panel.current).toBeTruthy());
  act(() => runtime.store.setState({ resourcesReady: true }));
  let result: any;
  act(() => {
    result = panel.current!.selectAnnotation('https://example.org/annotation/comment');
  });
  expect(result).toMatchObject({ ok: false, error: expect.stringContaining('Activation source not rendered:') });
  expect(panel.current!.getSnapshot().activeActivations).toEqual([]);
  act(() => {
    result = panel.current!.selectAnnotation(null);
  });
  expect(result).toEqual({ ok: true, annotationIds: [] });
  act(() => {
    result = panel.current!.selectAnnotation('ordinary-note');
  });
  expect(result).toEqual({ ok: true, annotationIds: [] });
  const before = panel.current!.getSnapshot();
  act(() => panel.current!.previewAnnotation('model'));
  expect(runtime.store.getState().previewAnnotation).toBe('model');
  expect(panel.current!.getSnapshot()).toEqual(before);
  act(() => panel.current!.previewAnnotation(null));
  expect(runtime.store.getState().previewAnnotation).toBeNull();
});

test('selection applies a real reset activation exactly once', async () => {
  const fixture = {
    ...scopeCameraScene,
    annotations: [
      {
        id: 'notes',
        type: 'AnnotationPage',
        items: [
          {
            id: 'trigger',
            type: 'Annotation',
            motivation: ['commenting'],
            target: scopeCameraScene.id,
            body: { type: 'TextualBody', value: 'Reset' },
          },
          {
            id: 'transaction',
            type: 'Annotation',
            motivation: ['activating'],
            target: { id: 'trigger', type: 'Annotation' },
            body: { type: 'SpecificResource', source: { id: 'model', type: 'Model' }, action: ['reset'] },
          },
        ],
      },
    ],
  };
  const panel = React.createRef<ScenePanelHandle>();
  let runtime!: ReturnType<typeof useSceneRuntime>;
  function Probe() {
    runtime = useSceneRuntime();
    return null;
  }
  render(
    <ScenePanel ref={panel} scene={fixture as any}>
      <Probe />
    </ScenePanel>
  );
  await waitFor(() => expect(panel.current).toBeTruthy());
  act(() => {
    runtime.register({ path: 'model-path', ids: ['model'], type: 'model', supportedActions: ['reset'] });
    runtime.store.setState({ resourcesReady: true });
  });
  let result: any;
  act(() => {
    result = panel.current!.selectAnnotation('trigger');
  });
  expect(result).toEqual({ ok: true, annotationIds: ['transaction'] });
  expect(runtime.store.getState().resources['model-path'].resetVersion).toBe(1);
});

test('Ueno Choice switches the painted model and controls publish the selected option', async () => {
  const panel = React.createRef<ScenePanelHandle>();
  let paintables: any;
  let controls: any;
  function Probe() {
    paintables = useCurrentScenePaintables();
    controls = useSceneControls();
    return null;
  }
  render(
    <ScenePanel ref={panel} manifest={uenoChoice as any}>
      <Probe />
    </ScenePanel>
  );
  await waitFor(() => expect(panel.current).toBeTruthy());
  const group = panel.current!.getChoices()!.items[0];
  expect(group.items.length).toBeGreaterThan(1);
  expect(controls.choice).toEqual(panel.current!.getChoices());
  const alternative = group.items.find((item) => !item.selected)!;
  act(() => {
    expect(controls.setChoice(alternative.id)).toBe(true);
  });
  expect(
    paintables.paintables.items.filter((item: any) => item.type === 'model').map((item: any) => item.resource.id)
  ).toEqual([alternative.id]);
  expect(controls.choices.items[0].items.find((item: any) => item.id === alternative.id).selected).toBe(true);
  const stateAfterChoice = controls.sceneChoices;
  act(() => {
    expect(controls.makeChoice(alternative.id, { deselectOthers: true })).toBe(true);
    expect(
      panel.current!.selectChoice(group.items.find((item) => item.id !== alternative.id)!.id, { deselect: true })
    ).toBe(true);
  });
  expect(controls.sceneChoices).toBe(stateAfterChoice);
  expect(controls.choice.items[0].items.find((item: any) => item.id === alternative.id).selected).toBe(true);
  expect(panel.current!.setChoice('missing')).toBe(false);
});

test('Home reset defaults to reduced motion and accepts a host animation override', async () => {
  const panel = React.createRef<ScenePanelHandle>();
  let runtime!: ReturnType<typeof useSceneRuntime>;
  function Probe() {
    runtime = useSceneRuntime();
    return null;
  }
  render(
    <ScenePanel ref={panel} scene={scene}>
      <Probe />
    </ScenePanel>
  );
  await waitFor(() => expect(panel.current).toBeTruthy());
  vi.stubGlobal('matchMedia', () => ({ matches: true }));
  try {
    act(() => panel.current!.resetView());
    expect(runtime.store.getState().viewResetAnimate).toBe(false);
    act(() => panel.current!.resetView({ animate: true }));
    expect(runtime.store.getState().viewResetAnimate).toBe(true);
    act(() => runtime.store.setState({ activeCamera: 'authored', freeViewActive: true }));
    act(() => panel.current!.resetView({ animate: false }));
    expect(runtime.store.getState().freeViewActive).toBe(false);
  } finally {
    vi.unstubAllGlobals();
  }
});

test('controlled highlightedAnnotations forwards preview ids without changing selection or camera', async () => {
  const panel = React.createRef<ScenePanelHandle>();
  let runtime!: ReturnType<typeof useSceneRuntime>;
  function Probe() {
    runtime = useSceneRuntime();
    return null;
  }
  const view = render(
    <ScenePanel ref={panel} scene={scene}>
      <Probe />
    </ScenePanel>
  );
  await waitFor(() => expect(panel.current).toBeTruthy());
  const before = panel.current!.getSnapshot();
  view.rerender(
    <ScenePanel ref={panel} scene={scene} highlightedAnnotations={['model']} hoverHighlightModels="red">
      <Probe />
    </ScenePanel>
  );
  expect(runtime.highlightedAnnotations).toEqual(['model']);
  expect(runtime.hoverHighlightModels).toBe('red');
  expect(panel.current!.getSnapshot()).toEqual(before);
  view.rerender(
    <ScenePanel ref={panel} scene={scene} highlightedAnnotations={[]}>
      <Probe />
    </ScenePanel>
  );
  expect(runtime.highlightedAnnotations).toEqual([]);
});

test('camera interactions replace atomically, cycle back, and preserve the previous camera on failure', async () => {
  const id = 'https://example.org/camera-cycling';
  const camera = (name: string) => `${id}/${name}`;
  const trigger = (name: string) => `${id}/trigger-${name}`;
  const transaction = (name: string) => `${id}/transaction-${name}`;
  const input = {
    id,
    type: 'Scene',
    items: [
      {
        id: `${id}/paintings`,
        type: 'AnnotationPage',
        items: ['a', 'b'].map((name) => ({
          id: `${id}/painting-${name}`,
          type: 'Annotation',
          motivation: ['painting'],
          body: { id: camera(name), type: 'PerspectiveCamera' },
          target: { id, type: 'Scene' },
        })),
      },
    ],
    annotations: [
      {
        id: `${id}/comments`,
        type: 'AnnotationPage',
        items: ['a', 'b'].flatMap((name) => [
          {
            id: trigger(name),
            type: 'Annotation',
            motivation: ['commenting'],
            body: { type: 'TextualBody', value: name },
            target: { id, type: 'Scene' },
          },
          {
            id: transaction(name),
            type: 'Annotation',
            motivation: ['activating'],
            target: { id: trigger(name), type: 'Annotation' },
            body: {
              type: 'SpecificResource',
              source: { id: camera(name), type: 'PerspectiveCamera' },
              action: ['select'],
            },
          },
        ]),
      },
    ],
  };
  const panel = React.createRef<ScenePanelHandle>();
  let runtime!: ReturnType<typeof useSceneRuntime>;
  const onSelect = vi.fn();
  function Probe() {
    runtime = useSceneRuntime();
    return null;
  }
  const mounted = render(
    <ScenePanel ref={panel} scene={input as any} onSelectAnnotation={onSelect}>
      <Probe />
    </ScenePanel>
  );
  await waitFor(() => expect(panel.current).toBeTruthy());
  let unregisterB!: () => void;
  act(() => {
    for (const name of ['a', 'b']) {
      const unregister = runtime.register({
        path: name,
        ids: [camera(name)],
        type: 'perspective-camera',
        supportedActions: ['select'],
      });
      if (name === 'b') unregisterB = unregister;
    }
    runtime.store.setState({ resourcesReady: true });
  });
  act(() => {
    expect(panel.current!.selectAnnotation(trigger('a')).ok).toBe(true);
  });
  expect(panel.current!.getSnapshot().activeCamera).toBe('a');
  act(() => {
    expect(panel.current!.replaceCameraActivation(transaction('a'), trigger('b')).ok).toBe(true);
  });
  expect(panel.current!.getSnapshot().activeCamera).toBe('b');
  expect(panel.current!.getSnapshot().activeActivations.map((entry) => entry.annotationId)).toEqual([transaction('b')]);
  act(() => {
    expect(panel.current!.replaceCameraActivation(transaction('b'), trigger('a')).ok).toBe(true);
  });
  expect(panel.current!.getSnapshot().activeCamera).toBe('a');
  expect(onSelect).toHaveBeenCalledTimes(3);
  act(() => unregisterB());
  const before = panel.current!.getSnapshot();
  act(() => {
    expect(panel.current!.replaceCameraActivation(transaction('a'), trigger('b')).ok).toBe(false);
  });
  expect(panel.current!.getSnapshot()).toEqual(before);
  expect(onSelect).toHaveBeenCalledTimes(3);
  mounted.unmount();
});

test.each([{ actions: ['select'] }, { actions: ['show', 'enable', 'select'] }])('scoped camera replacement accepts resource paths: $actions', async ({ actions }) => {
  const id = 'https://example.org/camera-cycling';
  const camera = (name: string) => `${id}/${name}`;
  const trigger = (name: string) => `${id}/trigger-${name}`;
  const transaction = (name: string) => `${id}/transaction-${name}`;
  const input = {
    id,
    type: 'Scene',
    items: [
      {
        id: `${id}/paintings`,
        type: 'AnnotationPage',
        items: ['a', 'b'].map((name) => ({
          id: `${id}/painting-${name}`,
          type: 'Annotation',
          motivation: ['painting'],
          body: { id: camera(name), type: 'PerspectiveCamera' },
          target: { id, type: 'Scene' },
        })),
      },
    ],
    annotations: [
      {
        id: `${id}/comments`,
        type: 'AnnotationPage',
        items: ['a', 'b'].flatMap((name) => [
          {
            id: trigger(name),
            type: 'Annotation',
            motivation: ['commenting'],
            body: { type: 'TextualBody', value: name },
            target: { id, type: 'Scene' },
          },
          {
            id: transaction(name),
            type: 'Annotation',
            motivation: ['activating'],
            target: { id: trigger(name), type: 'Annotation' },
            body: {
              type: 'SpecificResource',
              source: { id: camera(name), type: 'PerspectiveCamera' },
              action: actions,
            },
          },
        ]),
      },
    ],
  };
  const panel = React.createRef<ScenePanelHandle>();
  let runtime!: ReturnType<typeof useSceneRuntime>;
  const onSelect = vi.fn();
  function Probe() {
    runtime = useSceneRuntime();
    return null;
  }
  const mounted = render(
    <ScenePanel ref={panel} scene={input as any} onSelectAnnotation={onSelect}>
      <Probe />
    </ScenePanel>
  );
  await waitFor(() => expect(panel.current).toBeTruthy());
  let unregisterB!: () => void;
  act(() => {
    for (const name of ['a', 'b']) {
      const unregister = runtime.register({
        path: `copy/${name}`,
        instancePath: 'copy',
        ids: [camera(name)],
        type: 'perspective-camera',
        supportedActions: ['show', 'enable', 'select'],
        initial: { visible: actions.length === 1, disabled: actions.length > 1 },
      });
      if (name === 'b') unregisterB = unregister;
    }
    runtime.store.setState({ resourcesReady: true });
  });
  act(() => {
    expect(panel.current!.selectAnnotation({ id: trigger('a'), path: 'copy/a' }).ok).toBe(true);
  });
  expect(panel.current!.getSnapshot().activeCamera).toBe('copy/a');
  act(() => {
    expect(panel.current!.replaceCameraActivation({ id: transaction('a'), path: 'copy/a' }, { id: trigger('b'), path: 'copy/b' }).ok).toBe(true);
  });
  expect(panel.current!.getSnapshot().activeCamera).toBe('copy/b');
  if (actions.length > 1) expect(panel.current!.getSnapshot().resources['copy/a']).toMatchObject({ visible: false, disabled: true });
  expect(panel.current!.getSnapshot().activeActivations.map((entry) => entry.annotationId)).toEqual([transaction('b')]);
  act(() => {
    expect(panel.current!.replaceCameraActivation({ id: transaction('b'), path: 'copy' }, { id: trigger('a'), path: 'copy/a' }).ok).toBe(true);
  });
  expect(panel.current!.getSnapshot().activeCamera).toBe('copy/a');
  expect(onSelect).toHaveBeenCalledTimes(3);
  act(() => unregisterB());
  const before = panel.current!.getSnapshot();
  act(() => {
    expect(panel.current!.replaceCameraActivation({ id: transaction('a'), path: 'copy/a' }, { id: trigger('b'), path: 'copy/b' }).ok).toBe(false);
  });
  expect(panel.current!.getSnapshot()).toEqual(before);
  expect(onSelect).toHaveBeenCalledTimes(3);
  mounted.unmount();
});
