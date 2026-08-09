import React, { forwardRef, useImperativeHandle, type ForwardRefExoticComponent, type RefAttributes } from 'react';
import { useProgress } from '@react-three/drei';
import { ErrorBoundary } from 'react-error-boundary';
import { Annotation3D, AnnotationPage3D } from './annotations';
import { SceneControls, SceneTimeline } from './controls';
import { SceneProvider, useSceneRuntime, useSceneStore } from './context';
import { SceneCanvas } from './rendering';
import type { ScenePanelHandle, ScenePanelProps } from './types';

type ScenePanelComponent = ForwardRefExoticComponent<ScenePanelProps & RefAttributes<ScenePanelHandle>> & {
  Canvas: typeof SceneCanvas;
  Annotation: typeof Annotation3D;
  AnnotationPage: typeof AnnotationPage3D;
  Controls: typeof SceneControls;
  Timeline: typeof SceneTimeline;
};

const ScenePanelBase = forwardRef<ScenePanelHandle, ScenePanelProps>(function ScenePanel(
  {
    children,
    overlay,
    controls = false,
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
      <ScenePanelView
        ref={ref}
        overlay={overlay}
        controls={controls}
        canvasProps={canvasProps}
        className={className}
        style={style}
        loadingFallback={loadingFallback}
        errorFallback={errorFallback}
      >
        {children}
      </ScenePanelView>
    </SceneProvider>
  );
});

const ScenePanelView = forwardRef<
  ScenePanelHandle,
  Pick<
    ScenePanelProps,
    'children' | 'overlay' | 'controls' | 'canvasProps' | 'className' | 'style' | 'loadingFallback' | 'errorFallback'
  >
>(function ScenePanelView(
  { children, overlay, controls, canvasProps, className, style, loadingFallback, errorFallback },
  ref
) {
  const runtime = useSceneRuntime();
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
          <SceneCanvas {...canvasProps}>{children}</SceneCanvas>
        </ErrorBoundary>
        {overlay ? <div className="riv-scene-overlay">{overlay}</div> : null}
        <SceneLoading fallback={loadingFallback} />
        <ScenePlaceholder />
      </div>
      {controls === true ? <SceneControls /> : controls || null}
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

function ScenePlaceholder() {
  const runtime = useSceneRuntime();
  const show = useSceneStore(
    (state) =>
      !!runtime.scene.placeholderContainer &&
      (!state.resourcesReady || (!!state.duration && state.time === 0 && !state.playing))
  );
  if (!show || !runtime.scene.placeholderContainer) return null;
  const container = runtime.vault.get<any>(runtime.scene.placeholderContainer, { skipSelfReturn: false });
  return (
    <div className="riv-scene-placeholder" role="status">
      {container?.label ? Object.values(container.label).flat().join(' ') : 'Scene ready to play'}
    </div>
  );
}

function SceneAccompanying() {
  const runtime = useSceneRuntime();
  if (!runtime.scene.accompanyingContainer) return null;
  const container = runtime.vault.get<any>(runtime.scene.accompanyingContainer, { skipSelfReturn: false });
  return (
    <aside className="riv-scene-accompanying" aria-label="Accompanying content">
      {container?.label ? Object.values(container.label).flat().join(' ') : container?.id || ''}
    </aside>
  );
}

export const ScenePanel = Object.assign(ScenePanelBase, {
  Canvas: SceneCanvas,
  Annotation: Annotation3D,
  AnnotationPage: AnnotationPage3D,
  Controls: SceneControls,
  Timeline: SceneTimeline,
}) as ScenePanelComponent;
