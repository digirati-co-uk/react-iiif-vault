/**
 * @vitest-environment happy-dom
 */

import React, { act } from 'react';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { render, screen } from '@testing-library/react';
import { AudioContext as ThreeAudioContext } from 'three';
import { describe, expect, test, vi } from 'vitest';
import excludedModelFeatures from '../apps/scene-prototype/public/fixtures/parser-official-3d/uc06_multiple_3d_objects.json';
import { SceneProvider, SceneRuntimeContext, useSceneRuntime } from '../src/scene-panel/context';
import { SceneContents } from '../src/scene-panel/rendering';
import type { SceneResourceRendererProps } from '../src/scene-panel/types';

describe('ScenePanel fixture renderer contracts', () => {
  test('passes model feature exclusions to a custom renderer unchanged', async () => {
    ThreeAudioContext.setContext({
      currentTime: 0,
      destination: {},
      createGain: () => ({ connect: vi.fn(), disconnect: vi.fn(), gain: { value: 1 } }),
      listener: { setPosition: vi.fn(), setOrientation: vi.fn() },
    } as any);
    const rendered: SceneResourceRendererProps[] = [];
    let runtime!: ReturnType<typeof useSceneRuntime>;

    function RuntimeProbe() {
      runtime = useSceneRuntime();
      return <span>fixture-ready</span>;
    }

    render(
      <SceneProvider
        manifest={excludedModelFeatures as any}
        stage={false}
        annotations="none"
        cameraCue={false}
        renderers={[
          {
            id: 'fixture-probe',
            supports: () => true,
            Component: (props) => {
              rendered.push(props);
              return <group />;
            },
          },
        ]}
      >
        <RuntimeProbe />
      </SceneProvider>
    );
    await screen.findByText('fixture-ready');

    const renderer = await ReactThreeTestRenderer.create(
      <SceneRuntimeContext.Provider value={runtime}>
        <SceneContents />
      </SceneRuntimeContext.Provider>
    );
    await act(async () => undefined);

    const excluded = rendered.find((props) => props.annotation.exclude?.length);
    expect(excluded).toMatchObject({
      resource: { type: 'Model' },
      annotation: { exclude: ['audio', 'lights'] },
    });
    await renderer.unmount();
  });
});
