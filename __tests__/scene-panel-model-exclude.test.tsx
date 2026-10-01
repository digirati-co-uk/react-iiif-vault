/**
 * @vitest-environment happy-dom
 */

import React from 'react';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { act } from '@testing-library/react';
import { AnimationClip, BoxGeometry, Group, Matrix4, Mesh, PerspectiveCamera, PointLight } from 'three';
import { describe, expect, test, vi } from 'vitest';
import { SceneRuntimeContext } from '../src/scene-panel/context';
import { ModelResource } from '../src/scene-panel/rendering-model';

const mocks = vi.hoisted(() => ({ useAnimations: vi.fn(), useGLTF: vi.fn() }));

vi.mock('@react-three/drei', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@react-three/drei')>()),
  useAnimations: mocks.useAnimations,
  useGLTF: mocks.useGLTF,
}));

vi.mock('three/addons/loaders/KTX2Loader.js', () => ({
  KTX2Loader: class {
    setTranscoderPath() {
      return this;
    }
    detectSupport() {
      return this;
    }
    dispose() {}
  },
}));

class EmbeddedAudio extends Group {
  constructor() {
    super();
    (this as any).type = 'Audio';
  }
}

describe('built-in glTF model exclusions', () => {
  test('removes embedded cameras, lights, audio, and animation clips before mounting', async () => {
    const scene = new Group();
    const mesh = new Mesh(new BoxGeometry(1, 1, 1));
    mesh.name = 'geometry';
    const camera = new PerspectiveCamera();
    camera.name = 'embedded-camera';
    const light = new PointLight();
    light.name = 'embedded-light';
    const audio = new EmbeddedAudio();
    audio.name = 'embedded-audio';
    scene.add(mesh, camera, light, audio);
    const animations = [new AnimationClip('embedded-animation', 1, [])];
    mocks.useGLTF.mockReturnValue({ scene, animations });
    mocks.useAnimations.mockReturnValue({ actions: {} });

    let renderer!: Awaited<ReturnType<typeof ReactThreeTestRenderer.create>>;
    await act(async () => {
      renderer = await ReactThreeTestRenderer.create(
        <SceneRuntimeContext.Provider value={{ ktx2TranscoderPath: '/' } as any}>
          <ModelResource
            resource={{ id: 'model.glb', type: 'Model' }}
            annotation={
              { id: 'annotation', type: 'Annotation', exclude: ['audio', 'lights', 'cameras', 'animations'] } as any
            }
            paintable={
              {
                exclude: ['audio', 'lights', 'cameras', 'animations'],
                bodySelector: null,
                timeMode: 'trim',
              } as any
            }
            target={{ temporal: null } as any}
            path="model"
            matrix={new Matrix4().toArray() as any}
            state={{
              visible: true,
              disabled: false,
              selected: false,
              playing: true,
              activeAnimation: 'embedded-animation',
            }}
            clock={{ time: 0, playing: true, playbackRate: 1 }}
            register={vi.fn()}
            setStatus={vi.fn()}
            activate={vi.fn()}
            onDiagnostic={vi.fn()}
            setBounds={vi.fn()}
            highlight={false}
          />
        </SceneRuntimeContext.Provider>
      );
    });

    expect(mocks.useAnimations).toHaveBeenCalledWith([], expect.any(Group));
    const mounted = mocks.useAnimations.mock.calls[0][1] as Group;
    const names: string[] = [];
    mounted.traverse((child) => names.push(child.name));
    expect(names).toContain('geometry');
    expect(names).not.toContain('embedded-camera');
    expect(names).not.toContain('embedded-light');
    expect(names).not.toContain('embedded-audio');
    expect(scene.children.map((child) => child.name)).toEqual([
      'geometry',
      'embedded-camera',
      'embedded-light',
      'embedded-audio',
    ]);

    await act(() => renderer.unmount());
  });
});
