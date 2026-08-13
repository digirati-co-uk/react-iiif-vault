/**
 * @vitest-environment happy-dom
 */

import { Vault4 } from '@iiif/helpers/vault-4';
import React, { act, useLayoutEffect } from 'react';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { PerspectiveCamera } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { render, screen } from '@testing-library/react';
import { AudioContext as ThreeAudioContext } from 'three';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import multipleLights from '../apps/scene-prototype/public/fixtures/parser/11-multiple-lights.json';
import nestedScenes from '../apps/scene-prototype/public/fixtures/parser-official-3d/uc06_scene_in_scene.json';
import { SceneContext } from '../src/context/SceneContext';
import { VaultProvider } from '../src/context/VaultContext';
import { SceneProvider, SceneRuntimeContext, useSceneRuntime } from '../src/scene-panel/context';
import {
  CameraRig,
  DefaultComposition,
  findEnvironmentOwnerPath,
  Paintables,
  SceneCompositionRoot,
} from '../src/scene-panel/scene-composition';
import { SceneContents } from '../src/scene-panel/rendering';
import type { SceneResourceRendererProps } from '../src/scene-panel/types';

beforeEach(() => {
  ThreeAudioContext.setContext({
    currentTime: 0,
    destination: {},
    createGain: () => ({ connect: vi.fn(), disconnect: vi.fn(), gain: { value: 1 } }),
    listener: { setPosition: vi.fn(), setOrientation: vi.fn() },
  } as any);
});

async function runtimeFor(manifest: any, rendered: string[] = []) {
  let runtime!: ReturnType<typeof useSceneRuntime>;
  function Probe() {
    runtime = useSceneRuntime();
    return <span>runtime-ready</span>;
  }
  function Renderer(props: SceneResourceRendererProps) {
    useLayoutEffect(
      () =>
        props.register({
          path: props.path,
          ids: [props.annotation.id, props.resource.id],
          annotationId: props.annotation.id,
          resourceId: props.resource.id,
          resourceType: props.resource.type,
          type: String(props.resource.type),
        }),
      [props.annotation.id, props.path, props.register, props.resource.id, props.resource.type]
    );
    rendered.push(props.resource.type);
    return <group name={`custom-${props.resource.type}`} />;
  }
  const dom = render(
    <SceneProvider
      {...(manifest.type === 'Scene' ? { scene: manifest } : { manifest })}
      stage={false}
      annotations="none"
      cameraCue={false}
      renderers={[
        { id: 'composition-test', supports: ({ resource }) => resource.type !== 'Scene', Component: Renderer },
      ]}
    >
      <Probe />
    </SceneProvider>
  );
  await screen.findByText('runtime-ready');
  return { runtime, dom };
}

describe('ScenePanel composition', () => {
  test('allows an empty composition, keeps children additive, and completes readiness', async () => {
    const { runtime, dom } = await runtimeFor({ id: 'scene:empty', type: 'Scene', items: [] });
    const renderer = await ReactThreeTestRenderer.create(
      <SceneRuntimeContext.Provider value={runtime}>
        <SceneCompositionRoot composition={null}>
          <group name="additive-child" />
        </SceneCompositionRoot>
      </SceneRuntimeContext.Provider>
    );
    await act(async () => undefined);

    expect(renderer.scene.findAllByProps({ name: 'additive-child' })).toHaveLength(1);
    expect(runtime.store.getState().resourcesReady).toBe(true);

    await renderer.unmount();
    dom.unmount();
  });

  test('uses the effective filtered paintables when choosing fallback lighting', async () => {
    const rendered: string[] = [];
    const { runtime, dom } = await runtimeFor(multipleLights, rendered);
    const renderer = await ReactThreeTestRenderer.create(
      <SceneRuntimeContext.Provider value={runtime}>
        <SceneCompositionRoot
          composition={
            <DefaultComposition
              filter={(paintable) => !paintable.type.endsWith('light')}
              stage={false}
              annotations={false}
              cameraRig={false}
            />
          }
        />
      </SceneRuntimeContext.Provider>
    );
    await act(async () => undefined);

    expect(rendered).not.toContain('SpotLight');
    expect(rendered).not.toContain('AmbientLight');
    const lights: string[] = [];
    renderer.scene.instance.traverse((object: any) => {
      if (object.isAmbientLight || object.isDirectionalLight) lights.push(object.type);
    });
    expect(lights).toEqual(['AmbientLight', 'DirectionalLight']);

    await renderer.unmount();
    dom.unmount();
  });

  test('keeps resource paths stable when a filter changes or temporarily renders nothing', async () => {
    const { runtime, dom } = await runtimeFor(multipleLights);
    const contents = (showModel: boolean) => (
      <SceneRuntimeContext.Provider value={runtime}>
        <SceneCompositionRoot
          composition={
            <DefaultComposition
              filter={(paintable) => showModel && paintable.type === 'model'}
              background={false}
              stage={false}
              fallbackLighting={false}
              annotations={false}
              cameraRig={false}
            />
          }
        />
      </SceneRuntimeContext.Provider>
    );
    const renderer = await ReactThreeTestRenderer.create(contents(true));
    await act(async () => undefined);

    const originalPaths = Object.keys(runtime.store.getState().resources);
    expect(originalPaths).toHaveLength(1);
    expect(originalPaths[0]).toMatch(/\/https:\/\/example\.org\/iiif\/3d\/anno4\/3$/);

    await renderer.update(contents(false));
    await act(async () => undefined);
    expect(Object.keys(runtime.store.getState().resources)).toEqual([]);
    expect(runtime.store.getState().resourcesReady).toBe(true);

    await renderer.update(contents(true));
    await act(async () => undefined);
    expect(Object.keys(runtime.store.getState().resources)).toEqual(originalPaths);

    await renderer.unmount();
    dom.unmount();
  });

  test('propagates the composition filter into nested Scenes', async () => {
    const rendered: string[] = [];
    const { runtime, dom } = await runtimeFor(nestedScenes, rendered);
    const renderer = await ReactThreeTestRenderer.create(
      <SceneRuntimeContext.Provider value={runtime}>
        <SceneCompositionRoot
          composition={
            <DefaultComposition
              filter={(paintable) => paintable.type !== 'model'}
              stage={false}
              fallbackLighting={false}
              annotations={false}
              cameraRig={false}
            />
          }
        />
      </SceneRuntimeContext.Provider>
    );
    await act(async () => undefined);

    expect(rendered).not.toContain('Model');

    await renderer.unmount();
    dom.unmount();
  });

  test('does not add fallback lighting when a rendered nested Scene owns a light', async () => {
    const rendered: string[] = [];
    const { runtime, dom } = await runtimeFor(nestedLightManifest(), rendered);
    const renderer = await ReactThreeTestRenderer.create(
      <SceneRuntimeContext.Provider value={runtime}>
        <SceneCompositionRoot
          composition={<DefaultComposition stage={false} annotations={false} cameraRig={false} />}
        />
      </SceneRuntimeContext.Provider>
    );
    await act(async () => undefined);

    expect(rendered).toContain('AmbientLight');
    const fallbackLights: string[] = [];
    renderer.scene.instance.traverse((object: any) => {
      if (object.isAmbientLight || object.isDirectionalLight) fallbackLights.push(object.type);
    });
    expect(fallbackLights).toEqual([]);

    await renderer.unmount();
    dom.unmount();
  });

  test('keeps the public nested SceneContents compatibility path self-contained', async () => {
    const rendered: string[] = [];
    const { runtime, dom } = await runtimeFor(nestedScenes, rendered);
    const nested = runtime.vault.get<any>('https://iiif.io/api/presentation/4.0/example/uc06/scene/1');
    const renderer = await ReactThreeTestRenderer.create(
      <SceneRuntimeContext.Provider value={runtime}>
        <SceneContents scene={nested} />
      </SceneRuntimeContext.Provider>
    );
    await act(async () => undefined);

    expect(rendered).toContain('Model');

    await renderer.unmount();
    dom.unmount();
  });

  test('resolves ScenePanel from a scoped SceneContext', async () => {
    const scene = { id: 'scene:scoped', type: 'Scene', items: [] } as const;
    const vault = new Vault4();
    vault.loadSync(scene.id, scene as any);
    function Probe() {
      return <span>{useSceneRuntime().scene.id}</span>;
    }

    render(
      <VaultProvider vault={vault} version={4}>
        <SceneContext scene={scene.id}>
          <SceneProvider>
            <Probe />
          </SceneProvider>
        </SceneContext>
      </VaultProvider>
    );

    expect(await screen.findByText(scene.id)).toBeTruthy();
  });

  test('keeps imperative view control connected to a custom camera rig', async () => {
    const { runtime, dom } = await runtimeFor({ id: 'scene:custom-camera', type: 'Scene', items: [] });
    let camera: any;
    function CameraProbe() {
      camera = useThree((state) => state.camera);
      return null;
    }
    const renderer = await ReactThreeTestRenderer.create(
      <SceneRuntimeContext.Provider value={runtime}>
        <SceneCompositionRoot
          composition={
            <DefaultComposition
              stage={false}
              fallbackLighting={false}
              paintables={false}
              annotations={false}
              cameraRig={
                <CameraRig fallback={false}>
                  <PerspectiveCamera makeDefault position={[0, 0, 5]} />
                  <CameraProbe />
                </CameraRig>
              }
            />
          }
        />
      </SceneRuntimeContext.Provider>
    );
    await act(async () => undefined);

    act(() =>
      runtime.handle().setView({
        projection: 'perspective',
        position: [2, 3, 4],
        rotation: [0, 0, 0],
        target: [0, 0, 0],
        near: 0.2,
        far: 500,
        fieldOfView: 40,
      })
    );
    expect(camera.position.toArray()).toEqual([2, 3, 4]);
    expect(camera.fov).toBe(40);

    await renderer.unmount();
    dom.unmount();
  });

  test('chooses one deterministic environment across sibling nested Scenes', () => {
    const manifest = {
      id: 'manifest:environments',
      type: 'Manifest',
      items: [
        { id: 'scene:child-a', type: 'Scene', items: [environmentPage('a')] },
        { id: 'scene:child-b', type: 'Scene', items: [environmentPage('b')] },
        { id: 'scene:root', type: 'Scene', items: [nestedScenePage('a'), nestedScenePage('b')] },
      ],
      start: { id: 'scene:root', type: 'Scene' },
    } as any;
    const vault = new Vault4();
    vault.loadManifestSync(manifest.id, manifest);
    const root = vault.get<any>('scene:root');

    expect(findEnvironmentOwnerPath(vault, root, undefined, root.id, [])).toBe(
      'scene:root/annotation:nested-a/0/annotation:environment-a/0'
    );
  });

  test('rejects duplicate Paintables across the default and additive composition layers', async () => {
    const { runtime, dom } = await runtimeFor({ id: 'scene:duplicates', type: 'Scene', items: [] });

    await expect(
      ReactThreeTestRenderer.create(
        <SceneRuntimeContext.Provider value={runtime}>
          <SceneCompositionRoot
            composition={
              <DefaultComposition
                background={false}
                stage={false}
                fallbackLighting={false}
                annotations={false}
                cameraRig={false}
              />
            }
          >
            <Paintables />
          </SceneCompositionRoot>
        </SceneRuntimeContext.Provider>
      )
    ).rejects.toThrow('Only one ScenePanel.Paintables');

    dom.unmount();
  });
});

function nestedScenePage(name: string) {
  return {
    id: `page:nested-${name}`,
    type: 'AnnotationPage',
    items: [
      {
        id: `annotation:nested-${name}`,
        type: 'Annotation',
        motivation: ['painting'],
        body: { id: `scene:child-${name}`, type: 'Scene' },
        target: { id: 'scene:root', type: 'Scene' },
      },
    ],
  };
}

function environmentPage(name: string) {
  return {
    id: `page:environment-${name}`,
    type: 'AnnotationPage',
    items: [
      {
        id: `annotation:environment-${name}`,
        type: 'Annotation',
        motivation: ['painting'],
        body: {
          id: `environment:${name}`,
          type: 'ImageBasedLight',
          environmentMap: { id: `https://example.org/${name}.hdr`, type: 'Image' },
        },
        target: { id: `scene:child-${name}`, type: 'Scene' },
      },
    ],
  };
}

function nestedLightManifest() {
  return {
    id: 'manifest:nested-light',
    type: 'Manifest',
    items: [
      {
        id: 'scene:child-nested-light',
        type: 'Scene',
        items: [
          {
            id: 'page:nested-light',
            type: 'AnnotationPage',
            items: [
              {
                id: 'annotation:nested-light',
                type: 'Annotation',
                motivation: ['painting'],
                body: { id: 'light:nested', type: 'AmbientLight', intensity: 0.5 },
                target: { id: 'scene:child-nested-light', type: 'Scene' },
              },
            ],
          },
        ],
      },
      {
        id: 'scene:root',
        type: 'Scene',
        items: [nestedScenePage('nested-light')],
      },
    ],
    start: { id: 'scene:root', type: 'Scene' },
  };
}
