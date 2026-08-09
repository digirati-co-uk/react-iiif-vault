/**
 * @vitest-environment happy-dom
 */

import React, { act } from 'react';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { useThree } from '@react-three/fiber';
import {
  OrthographicCamera as DreiOrthographicCamera,
  PerspectiveCamera as DreiPerspectiveCamera,
} from '@react-three/drei';
import { render, screen, waitFor } from '@testing-library/react';
import { Box3, BoxGeometry, BufferGeometry, Mesh, PerspectiveCamera, Quaternion, Vector3 } from 'three';
import { describe, expect, test, vi } from 'vitest';
import { Vault4 } from '@iiif/helpers/vault-4';
import { parseSceneTarget } from '@iiif/helpers/scenes';
import { ReactVaultContext, VaultProvider } from '../src/context/VaultContext';
import { SceneProvider, SceneRuntimeContext, useScene, useSceneRuntime } from '../src/scene-panel/context';
import { CameraEditorHelper, FreeViewCamera, InitialSceneBounds } from '../src/scene-panel/rendering';
import { createSceneRuntimeStore } from '../src/scene-panel/store';
import {
  dismissAnnotationPopover,
  GeometryMarker,
  prepareSvgAnnotationSelector,
  sanitizeIiifHtml,
  sanitizeSvgSelector,
} from '../src/scene-panel/annotations';

describe('ScenePanel React foundation', () => {
  test('waits for blocking resources before framing the completed initial bounds', async () => {
    const store = createSceneRuntimeStore({ id: 'scene', type: 'Scene', items: [] } as any, {
      time: 0,
      playing: false,
      playbackRate: 1,
    });
    store.setState({ resourcesReady: false });
    let camera: any;
    const onBounds = vi.fn();
    function CameraProbe() {
      camera = useThree((state) => state.camera);
      return null;
    }
    const contents = (complete: boolean) => (
      <SceneRuntimeContext.Provider value={{ store } as any}>
        <CameraProbe />
        <InitialSceneBounds frame padding={1.4} onBounds={onBounds}>
          <mesh position={[0, 0, 0]}>
            <boxGeometry args={[2, 2, 2]} />
          </mesh>
          {complete ? (
            <mesh position={[100, 0, 0]}>
              <boxGeometry args={[2, 2, 2]} />
            </mesh>
          ) : null}
        </InitialSceneBounds>
      </SceneRuntimeContext.Provider>
    );
    const renderer = await ReactThreeTestRenderer.create(contents(false));
    expect(camera.position.toArray()).toEqual([0, 0, 5]);
    await renderer.update(contents(true));
    expect(camera.position.toArray()).toEqual([0, 0, 5]);
    await act(async () => store.setState({ resourcesReady: true }));
    expect(camera.position.x).toBeCloseTo(50);
    expect(camera.position.z).toBeGreaterThan(5);
    await renderer.unmount();
  });

  test('keeps the initial free camera stable when edited model bounds move', async () => {
    const store = createSceneRuntimeStore({ id: 'scene', type: 'Scene', items: [] } as any, {
      time: 0,
      playing: false,
      playbackRate: 1,
    });
    store.setState({ resourcesReady: true });
    const controls = { target: new Vector3(), maxDistance: 0, saveState: vi.fn() };
    let camera: any;
    function WithControls({ children }: React.PropsWithChildren) {
      const set = useThree((state) => state.set);
      const current = useThree((state) => state.controls) as unknown;
      React.useLayoutEffect(() => {
        set({ controls } as any);
        return () => set({ controls: null } as any);
      }, [set]);
      return current === controls ? children : null;
    }
    function CameraProbe() {
      camera = useThree((state) => state.camera);
      return null;
    }
    const contents = (x: number, onBounds: () => void) => (
      <SceneRuntimeContext.Provider value={{ store } as any}>
        <WithControls>
          <CameraProbe />
          <InitialSceneBounds frame padding={1.4} onBounds={onBounds}>
            <mesh position={[x, 0, 0]}>
              <boxGeometry args={[20, 20, 20]} />
            </mesh>
          </InitialSceneBounds>
        </WithControls>
      </SceneRuntimeContext.Provider>
    );
    const renderer = await ReactThreeTestRenderer.create(contents(0, vi.fn()));
    const position = camera.position.clone();
    const quaternion = camera.quaternion.clone();
    const target = controls.target.clone();
    await renderer.update(contents(100, vi.fn()));
    expect(camera.position.toArray()).toEqual(position.toArray());
    expect(1 - Math.abs(camera.quaternion.dot(quaternion))).toBeLessThan(1e-12);
    expect(controls.target.toArray()).toEqual(target.toArray());
    expect(controls.saveState).toHaveBeenCalledOnce();
    await renderer.unmount();
  });

  test('orients a camera helper from a PointSelector without a RotateTransform', async () => {
    const camera = new PerspectiveCamera();
    camera.position.set(0, 0, 10);
    const point = parseSceneTarget(
      {
        type: 'SpecificResource',
        source: { id: 'scene', type: 'Scene' },
        selector: { type: 'PointSelector', x: 4, y: 1, z: 0 },
      },
      { id: 'scene', type: 'Scene' }
    ).point!;
    camera.lookAt(...point);
    camera.updateMatrixWorld();
    const cameraRef = { current: camera };
    const renderer = await ReactThreeTestRenderer.create(
      <SceneRuntimeContext.Provider value={{ selectAnnotation: vi.fn() } as any}>
        <primitive object={camera} />
        <CameraEditorHelper
          camera={cameraRef}
          annotationId="camera-annotation"
          path="camera/path"
          orthographic={false}
          editable
        />
      </SceneRuntimeContext.Provider>
    );
    await renderer.advanceFrames(1, 1 / 60);
    let helper: any;
    renderer.scene.instance.traverse((object) => {
      if (object.userData.annotationId === 'camera-annotation') helper = object;
    });
    expect(1 - Math.abs(helper.getWorldQuaternion(new Quaternion()).dot(camera.quaternion))).toBeLessThan(1e-12);
    expect(1 - Math.abs(camera.quaternion.dot(new Quaternion()))).toBeGreaterThan(1e-4);
    await renderer.unmount();
  });

  test('updates a camera helper when referenced Model bounds move', async () => {
    const model = new Mesh(new BoxGeometry(2, 2, 2));
    model.position.set(5, 0, 0);
    model.updateMatrixWorld();
    const camera = new PerspectiveCamera();
    camera.position.set(0, 0, 10);
    camera.lookAt(new Box3().setFromObject(model).getCenter(new Vector3()));
    camera.updateMatrixWorld();
    const cameraRef = { current: camera };
    const renderer = await ReactThreeTestRenderer.create(
      <SceneRuntimeContext.Provider value={{ selectAnnotation: vi.fn() } as any}>
        <primitive object={model} />
        <primitive object={camera} />
        <CameraEditorHelper
          camera={cameraRef}
          annotationId="referenced-camera"
          path="camera/referenced"
          orthographic={false}
          editable
        />
      </SceneRuntimeContext.Provider>
    );
    await renderer.advanceFrames(1, 1 / 60);
    let helper: any;
    renderer.scene.instance.traverse((object) => {
      if (object.userData.annotationId === 'referenced-camera') helper = object;
    });
    const before = helper.getWorldQuaternion(new Quaternion()).clone();
    model.position.set(-5, 0, 0);
    model.updateMatrixWorld();
    camera.lookAt(new Box3().setFromObject(model).getCenter(new Vector3()));
    camera.updateMatrixWorld();
    await renderer.advanceFrames(1, 1 / 60);
    const current = helper.getWorldQuaternion(new Quaternion());
    expect(1 - Math.abs(current.dot(camera.quaternion))).toBeLessThan(1e-12);
    expect(1 - Math.abs(current.dot(before))).toBeGreaterThan(1e-4);
    await renderer.unmount();
    model.geometry.dispose();
  });

  test.each(['perspective', 'orthographic'] as const)(
    'preserves an authored %s view when editing takes over the camera',
    async (projection) => {
      const store = createSceneRuntimeStore({ id: 'scene', type: 'Scene', items: [] } as any, {
        time: 0,
        playing: false,
        playbackRate: 1,
      });
      const controls = { target: new Vector3(1, 2, 3), saveState: vi.fn() };
      let camera: any;
      function Controls() {
        const set = useThree((state) => state.set);
        React.useLayoutEffect(() => {
          set({ controls } as any);
          return () => set({ controls: null } as any);
        }, [set]);
        return null;
      }
      function CameraProbe() {
        camera = useThree((state) => state.camera);
        return null;
      }
      const contents = (editing: boolean) => (
        <SceneRuntimeContext.Provider value={{ store } as any}>
          <Controls />
          {projection === 'perspective' ? (
            <DreiPerspectiveCamera
              makeDefault={!editing}
              position={[0, 0, 12]}
              rotation={[0.1, 0.2, 0.3]}
              fov={42}
              near={0.2}
              far={900}
            />
          ) : (
            <DreiOrthographicCamera
              makeDefault={!editing}
              userData={{ rivViewHeight: 6 }}
              position={[0, 0, 12]}
              rotation={[0.1, 0.2, 0.3]}
              top={3}
              bottom={-3}
              left={-6}
              right={6}
              near={0.2}
              far={900}
            />
          )}
          <FreeViewCamera active={editing} />
          <CameraProbe />
        </SceneRuntimeContext.Provider>
      );
      const renderer = await ReactThreeTestRenderer.create(contents(false));
      expect(camera.userData.rivSceneFreeView).not.toBe(true);
      await renderer.update(contents(true));
      expect(camera.userData.rivSceneFreeView).toBe(true);
      expect(camera.position.toArray()).toEqual([0, 0, 12]);
      expect(camera.near).toBe(0.2);
      expect(camera.far).toBe(900);
      expect(controls.target.toArray()).toEqual([1, 2, 3]);
      if (projection === 'perspective') expect(camera.fov).toBe(42);
      else {
        expect(camera.isOrthographicCamera).toBe(true);
        expect(camera.top - camera.bottom).toBe(6);
      }
      await renderer.unmount();
    }
  );

  test('VaultProvider version=4 creates a Vault4 without changing the P3 default', () => {
    function Probe() {
      const vault = React.useContext(ReactVaultContext).vault;
      return <span>{vault instanceof Vault4 ? 'v4' : 'v3'}</span>;
    }
    const p3 = render(
      <VaultProvider>
        <Probe />
      </VaultProvider>
    );
    expect(p3.getByText('v3')).toBeTruthy();
    p3.unmount();
    const p4 = render(
      <VaultProvider version={4}>
        <Probe />
      </VaultProvider>
    );
    expect(p4.getByText('v4')).toBeTruthy();
  });

  test('loads an embedded Scene through the lower-level provider', async () => {
    function Probe() {
      return <span>{useScene().id}</span>;
    }
    render(
      <SceneProvider
        scene={{ id: 'https://example.org/scene', type: 'Scene', label: { en: ['Test'] }, items: [] } as any}
      >
        <Probe />
      </SceneProvider>
    );
    await waitFor(() => expect(screen.getByText('https://example.org/scene')).toBeTruthy());
  });

  test('normalizes viewer presentation and camera defaults and accepts overrides', async () => {
    function Probe() {
      const runtime = useSceneRuntime();
      return (
        <span>
          {runtime.transitionDuration}:{runtime.stage ? `${runtime.stage.size}/${runtime.stage.floorOpacity}` : 'off'}:
          {String(runtime.debugLights)}:{runtime.annotationMarkerSize}:{String(runtime.cameraCue)}:
          {runtime.cameraPadding}:{runtime.cameraZoom.duration}/{runtime.cameraZoom.sensitivity}/
          {runtime.cameraZoom.easing(0.5).toFixed(3)}/{String(runtime.cameraZoom.zoomToCursor)}
        </span>
      );
    }
    const input = { id: 'https://example.org/stage-scene', type: 'Scene', items: [] } as any;
    const defaults = render(
      <SceneProvider scene={input}>
        <Probe />
      </SceneProvider>
    );
    await waitFor(() => expect(screen.getByText('0.6:40/0.62:false:16:true:1.4:0.1/1/0.969/true')).toBeTruthy());
    defaults.unmount();
    render(
      <SceneProvider
        scene={input}
        transitions={false}
        stage={false}
        debug
        annotationMarkerSize={2}
        cameraCue={false}
        cameraPadding={1.8}
        cameraZoom={{ duration: -1, sensitivity: -2, easing: (value) => value, zoomToCursor: false }}
      >
        <Probe />
      </SceneProvider>
    );
    await waitFor(() => expect(screen.getByText('0:off:true:4:false:1.8:0/0/0.500/false')).toBeTruthy());
  });

  test('uses a pinned KTX2 transcoder by default and normalizes a self-hosted directory', async () => {
    function Probe() {
      return <span>{useSceneRuntime().ktx2TranscoderPath}</span>;
    }
    const input = { id: 'https://example.org/ktx2-scene', type: 'Scene', items: [] } as any;
    const defaults = render(
      <SceneProvider scene={input}>
        <Probe />
      </SceneProvider>
    );
    await waitFor(() =>
      expect(screen.getByText('https://cdn.jsdelivr.net/npm/three@0.185.1/examples/jsm/libs/basis/')).toBeTruthy()
    );
    defaults.unmount();
    render(
      <SceneProvider scene={input} ktx2TranscoderPath=" /assets/basis ">
        <Probe />
      </SceneProvider>
    );
    await waitFor(() => expect(screen.getByText('/assets/basis/')).toBeTruthy());
  });

  test('applies the IIIF HTML allowlist', () => {
    const html = sanitizeIiifHtml(
      '<p>Hello <strong>world</strong><script>alert(1)</script><a href="javascript:bad">link</a></p>'
    );
    expect(html).toContain('<strong>world</strong>');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('javascript:');
  });

  test('sanitizes SVG selectors and rejects malformed markup', () => {
    const svg = sanitizeSvgSelector(
      `<svg xmlns="http://www.w3.org/2000/svg" onload="bad()">
        <defs><linearGradient id="paint"><stop offset="1" stop-color="#fff"/></linearGradient></defs>
        <style>@\\69mport "https://evil.example/styles.css"; .bad { fill: u/**/rl(https://evil.example/paint) }</style>
        <path class="safe" d="M0 0L1 1" stroke="url(#paint)" style="fill: url(https://evil.example/fill)"/>
        <evil:path xmlns:evil="https://evil.example/ns" d="M0 0L1 1"/>
        <image href="https://example.org/tracker.png"/>
        <foreignObject><div xmlns="http://www.w3.org/1999/xhtml">unsafe</div></foreignObject>
        <script>bad()</script>
      </svg>`
    );
    expect(svg).toContain('<path');
    expect(svg).toContain('stroke="url(#paint)"');
    expect(svg).not.toContain('onload');
    expect(svg).not.toContain('<script');
    expect(svg).not.toContain('tracker.png');
    expect(svg).not.toContain('@import');
    expect(svg).not.toContain('evil.example');
    expect(svg).not.toContain('foreignObject');
    expect(svg).not.toContain('unsafe');
    expect(svg).not.toContain('evil:path');
    expect(sanitizeSvgSelector('<p>not an SVG</p>')).toBe('');
  });

  test('disposes generated GeometryMarker buffers when geometry changes and on unmount', async () => {
    const dispose = vi.spyOn(BufferGeometry.prototype, 'dispose');
    const first = {
      type: 'Polygon',
      coordinates: [
        [
          [0, 0, 0],
          [1, 0, 0],
          [0, 1, 0],
          [0, 0, 0],
        ],
      ],
    } as any;
    const second = {
      type: 'Polygon',
      coordinates: [
        [
          [0, 0, 0],
          [2, 0, 0],
          [0, 2, 0],
          [0, 0, 0],
        ],
      ],
    } as any;
    const marker = (geometry: any) => (
      <GeometryMarker geometry={geometry} selected={false} size={16} activate={() => undefined} />
    );
    const renderer = await ReactThreeTestRenderer.create(marker(first));
    let outline: any = null;
    renderer.scene.instance.traverse((object: any) => {
      if (object.isLineSegments2) outline = object;
    });
    expect(outline).toBeTruthy();
    expect(dispose).not.toHaveBeenCalled();
    await renderer.update(marker(second));
    expect(dispose).toHaveBeenCalledTimes(2);
    await renderer.unmount();
    expect(dispose).toHaveBeenCalledTimes(4);
    dispose.mockRestore();
  });

  test('preserves a complete SVG selector and sizes its plane from the SVG viewport', () => {
    const raw = {
      type: 'SvgSelector',
      value:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="-0.1 0.2 1.4 0.9"><path d="M0 0L1 1" fill="#2563eb"/><path d="M0 1L1 0" fill="#fbbf24"/></svg>',
    };
    const selector = prepareSvgAnnotationSelector(
      {
        type: 'SvgSelector',
        // The target helper extracts paint from the first supported shape.
        // The Scene renderer must still use the complete authored selector.
        svg: '<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0L1 1"/></svg>',
        spatial: { x: 0, y: 0, width: 1, height: 1 },
        boxStyle: { backgroundColor: '#111827', opacity: 0.92 },
      },
      raw
    );
    expect(selector?.svg).toContain('fill="#2563eb"');
    expect(selector?.svg).toContain('fill="#fbbf24"');
    expect(selector?.svg).toContain('<rect x="-0.1" y="0.2" width="1.4" height="0.9" fill="#111827"');
    expect(selector?.spatial).toMatchObject({ x: -0.1, y: 0.2, width: 1.4, height: 0.9 });
    expect(prepareSvgAnnotationSelector({}, { value: '<p>not SVG</p>' })).toBeNull();
  });

  test('stops pointer interaction before dismissing an annotation popover', () => {
    const event = {
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
      nativeEvent: { stopImmediatePropagation: vi.fn() },
    } as any;
    const close = vi.fn();
    dismissAnnotationPopover(event, close);
    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(event.stopPropagation).toHaveBeenCalledOnce();
    expect(event.nativeEvent.stopImmediatePropagation).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledOnce();
  });
});
