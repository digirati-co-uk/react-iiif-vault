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
import { VaultProvider } from '../src/context/VaultContext';
import { createSceneClock } from '../src/scene-panel/clock';

vi.mock('../src/scene-panel/rendering', () => ({
  SceneCanvas: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
    <div data-testid="scene-canvas" {...props}>
      {children}
    </div>
  ),
}));

const scene = { id: 'https://example.org/scene', type: 'Scene', items: [] } as any;

describe('ScenePanel provider props and lifecycle', () => {
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
