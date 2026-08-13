import { Canvas, useFrame, useThree, type CanvasProps } from '@react-three/fiber';
import React, { Suspense, useCallback, useEffect, useState } from 'react';
import { VaultProvider } from '../context/VaultContext';
import { ResourceProvider } from '../context/ResourceContext';
import type { InternalSceneClock } from './clock';
import { SceneRuntimeContext, useSceneRuntime, useSceneStore } from './context';
import { ContinuousFramesContext } from './render-context';
import { SceneCompositionRoot } from './scene-composition';
import { selectSceneFrameloop } from './rendering-helpers';

export type SceneCanvasProps = Omit<CanvasProps, 'children'> & {
  children?: React.ReactNode;
  composition?: React.ReactNode | null;
};

export function SceneCanvas({ children, composition, ...canvasProps }: SceneCanvasProps) {
  const runtime = useSceneRuntime();
  const playing = useSceneStore(
    (state) => state.playing || Object.values(state.resources).some((resource) => resource.playing)
  );
  const [continuousFrames, setContinuousFrames] = useState(0);
  const acquireContinuousFrames = useCallback(() => {
    let active = true;
    setContinuousFrames((count) => count + 1);
    return () => {
      if (!active) return;
      active = false;
      setContinuousFrames((count) => Math.max(0, count - 1));
    };
  }, []);
  const { frameloop = 'demand', onPointerMissed, ...restCanvasProps } = canvasProps;
  return (
    <Canvas
      aria-label="IIIF 3D Scene"
      {...restCanvasProps}
      frameloop={selectSceneFrameloop(playing, continuousFrames, frameloop)}
      onPointerMissed={(event) => {
        if (runtime.selectionEnabled) runtime.selectAnnotation(null);
        onPointerMissed?.(event);
      }}
    >
      <ContinuousFramesContext.Provider value={acquireContinuousFrames}>
        <SceneRuntimeContext.Provider value={runtime}>
          <VaultProvider vault={runtime.vault} version={4} resources={{ scene: runtime.scene.id }}>
            <ResourceProvider value={{ scene: runtime.scene.id }}>
              <SceneFrameDriver />
              <Suspense fallback={null}>
                <SceneCompositionRoot composition={composition}>{children}</SceneCompositionRoot>
              </Suspense>
            </ResourceProvider>
          </VaultProvider>
        </SceneRuntimeContext.Provider>
      </ContinuousFramesContext.Provider>
    </Canvas>
  );
}

function SceneFrameDriver() {
  const { clock } = useSceneRuntime();
  const invalidate = useThree((state) => state.invalidate);
  useEffect(() => clock.subscribe(() => invalidate()), [clock, invalidate]);
  useFrame((_, delta) => {
    const internal = clock as Partial<InternalSceneClock>;
    internal.advance?.(delta);
  });
  return null;
}
