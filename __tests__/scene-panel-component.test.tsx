/**
 * @vitest-environment happy-dom
 */

import React from 'react';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { render, screen, waitFor } from '@testing-library/react';
import { BufferGeometry } from 'three';
import { describe, expect, test, vi } from 'vitest';
import { Vault4 } from '@iiif/helpers/vault-4';
import { ReactVaultContext, VaultProvider } from '../src/context/VaultContext';
import { SceneProvider, useScene, useSceneRuntime } from '../src/scene-panel/context';
import {
  dismissAnnotationPopover,
  GeometryMarker,
  prepareSvgAnnotationSelector,
  sanitizeIiifHtml,
  sanitizeSvgSelector,
} from '../src/scene-panel/annotations';

describe('ScenePanel React foundation', () => {
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
