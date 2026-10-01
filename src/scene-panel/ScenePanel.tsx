import React, { forwardRef, useImperativeHandle, type ForwardRefExoticComponent, type RefAttributes } from 'react';
import { useProgress } from '@react-three/drei';
import { ErrorBoundary } from 'react-error-boundary';
import { Annotation3D, AnnotationPage3D } from './annotations';
import { SceneSpatialScale, SceneTimeline } from './controls';
import { SceneProvider, useSceneRuntime, useSceneStore } from './context';
import { SceneCanvas } from './rendering';
import { SceneAuxiliaryContainer, SceneRequiredStatements } from './presentation-ui';
import {
  Annotations,
  AutoFrame,
  Background,
  CameraRig,
  DefaultComposition,
  FallbackLighting,
  Paintables,
  SceneComposition,
  Stage,
} from './scene-composition';
import type { ScenePanelHandle, ScenePanelProps, ScenePanelViewerProps } from './types';

type ScenePanelComponent = ForwardRefExoticComponent<ScenePanelProps & RefAttributes<ScenePanelHandle>> & {
  Canvas: typeof SceneCanvas;
  Provider: typeof SceneProvider;
  Viewer: typeof ScenePanelViewer;
  Annotation: typeof Annotation3D;
  AnnotationPage: typeof AnnotationPage3D;
  Timeline: typeof SceneTimeline;
  Composition: typeof SceneComposition;
  DefaultComposition: typeof DefaultComposition;
  Paintables: typeof Paintables;
  Background: typeof Background;
  Stage: typeof Stage;
  FallbackLighting: typeof FallbackLighting;
  CameraRig: typeof CameraRig;
  Annotations: typeof Annotations;
  AutoFrame: typeof AutoFrame;
};

const ScenePanelBase = forwardRef<ScenePanelHandle, ScenePanelProps>(function ScenePanel(
  {
    children,
    composition,
    overlay,
    requiredStatements = true,
    annotations = 'auto',
    transitions = true,
    stage = true,
    debug = false,
    annotationMarkerSize = 16,
    annotationMarker,
    annotationPopover,
    cameraCue = true,
    cameraPadding = 1.4,
    cameraZoom,
    cameraControls,
    selectedAnnotation,
    onSelectAnnotation,
    onResourceStatusChange,
    ktx2TranscoderPath,
    canvasProps,
    className,
    style,
    ssrFallback,
    loadingFallback,
    errorFallback,
    ...providerProps
  },
  ref
) {
  return (
    <SceneProvider
      {...providerProps}
      annotations={annotations}
      transitions={transitions}
      stage={stage}
      debug={debug}
      annotationMarkerSize={annotationMarkerSize}
      annotationMarker={annotationMarker}
      annotationPopover={annotationPopover}
      cameraCue={cameraCue}
      cameraPadding={cameraPadding}
      cameraZoom={cameraZoom}
      cameraControls={cameraControls}
      selectedAnnotation={selectedAnnotation}
      onSelectAnnotation={onSelectAnnotation}
      onResourceStatusChange={onResourceStatusChange}
      ktx2TranscoderPath={ktx2TranscoderPath}
      ssrFallback={ssrFallback}
      loadingFallback={loadingFallback}
      errorFallback={errorFallback}
    >
      <ScenePanelViewer
        ref={ref}
        overlay={overlay}
        requiredStatements={requiredStatements}
        canvasProps={canvasProps}
        composition={composition}
        className={className}
        style={style}
        loadingFallback={loadingFallback}
        errorFallback={errorFallback}
      >
        {children}
      </ScenePanelViewer>
    </SceneProvider>
  );
});

export const ScenePanelViewer = forwardRef<ScenePanelHandle, ScenePanelViewerProps>(function ScenePanelViewer(
  {
    children,
    composition,
    overlay,
    requiredStatements = true,
    canvasProps,
    className,
    style,
    loadingFallback,
    errorFallback,
  },
  ref
) {
  const runtime = useSceneRuntime();
  const showPlaceholder = useSceneStore(
    (state) =>
      !!runtime.scene.placeholderContainer &&
      (!state.resourcesReady || (!!state.duration && state.time === 0 && !state.playing))
  );
  useImperativeHandle(ref, runtime.handle, [runtime.handle]);
  return (
    <div className={['riv-scene-panel', className].filter(Boolean).join(' ')} style={style}>
      <div className="riv-scene-viewport">
        <ErrorBoundary
          onError={(cause) =>
            runtime.diagnostic({
              code: 'scene-render-failed',
              severity: 'error',
              message: 'The Scene could not be rendered.',
              cause,
            })
          }
          fallbackRender={() => (
            <div className="riv-scene-render-error" role="alert">
              {errorFallback !== undefined ? errorFallback : 'The Scene could not be rendered.'}
            </div>
          )}
        >
          <SceneCanvas {...canvasProps} composition={composition}>
            {children}
          </SceneCanvas>
        </ErrorBoundary>
        {overlay ? <div className="riv-scene-overlay">{overlay}</div> : null}
        <SceneLoading fallback={loadingFallback} />
        <ScenePlaceholder show={showPlaceholder} />
        <SceneSpatialScale />
        {requiredStatements ? <SceneRequiredStatements includePlaceholder={showPlaceholder} /> : null}
      </div>
      <SceneAccompanying />
    </div>
  );
});

function SceneLoading({ fallback }: { fallback?: React.ReactNode }) {
  const ready = useSceneStore((state) => state.resourcesReady);
  const { progress, loaded, total, item } = useProgress();
  // SceneContents commits only after suspending model loaders resolve. Texture
  // refinement is deliberately non-blocking: an already useful Canvas should
  // remain visible while a sharper IIIF tile is fetched.
  if (ready) return null;
  if (fallback !== undefined)
    return (
      <div className="riv-scene-loading" role="status">
        {fallback}
      </div>
    );
  const determinate = total > 0;
  return (
    <div className="riv-scene-loading" role="status" aria-live="polite" aria-label="Loading 3D scene">
      <span className="riv-scene-spinner" aria-hidden="true" />
      <span>{determinate ? `Loading scene resources ${loaded} of ${total}` : 'Loading scene resources…'}</span>
      {determinate ? (
        <progress max={100} value={progress}>
          {Math.round(progress)}%
        </progress>
      ) : null}
      {item ? <span className="riv-scene-loading-item">{item.split('/').pop()}</span> : null}
    </div>
  );
}

function ScenePlaceholder({ show }: { show: boolean }) {
  const runtime = useSceneRuntime();
  if (!show || !runtime.scene.placeholderContainer) return null;
  return <SceneAuxiliaryContainer kind="placeholder" reference={runtime.scene.placeholderContainer} />;
}

function SceneAccompanying() {
  const runtime = useSceneRuntime();
  if (!runtime.scene.accompanyingContainer) return null;
  return <SceneAuxiliaryContainer kind="accompanying" reference={runtime.scene.accompanyingContainer} />;
}

export const ScenePanel = Object.assign(ScenePanelBase, {
  Canvas: SceneCanvas,
  Provider: SceneProvider,
  Viewer: ScenePanelViewer,
  Annotation: Annotation3D,
  AnnotationPage: AnnotationPage3D,
  Timeline: SceneTimeline,
  Composition: SceneComposition,
  DefaultComposition,
  Paintables,
  Background,
  Stage,
  FallbackLighting,
  CameraRig,
  Annotations,
  AutoFrame,
}) as ScenePanelComponent;
