import { AtlasAuto, type AtlasProps, ModeContext, type Preset } from '@atlas-viewer/atlas';
import React, { type ReactNode, useCallback, useMemo, useState } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { useStore } from 'zustand';
import { ContextBridge, useContextBridge, useCustomContextBridge } from '../context/ContextBridge';
import { ViewerPresetContext } from '../context/ViewerPresetContext';
import { useInternalSetCanvasViewports } from '../hooks/useInternalSetCanvasViewports';
import { VirtualAnnotationProvider } from '../hooks/useVirtualAnnotationPageContext';
import { AtlasStoreProvider, useAtlasStore } from './context/atlas-store-provider';
import { SetOverlaysReactContext, SetPortalReactContext } from './context/overlays';
import { WorldSizeContext } from './context/world-size';
import { DefaultCanvasFallback } from './render/DefaultCanvasFallback';

type ViewerProps = AtlasProps & {
  name?: string;
  height?: number | string;
  width?: number | string;
  resizeHash?: number;
  containerProps?: any;
  outerContainerProps?: any;
  aspectRatio?: number;
  errorFallback?: any;
  renderPreset?: Preset;
  worldScale?: number;
  updateViewportTimeout?: number;
} & { children: ReactNode };

export function Viewer(props: ViewerProps) {
  const existingAtlas = useAtlasStore();
  return (
    <AtlasStoreProvider name={props.name} existing={existingAtlas}>
      <ViewerOuter {...props} />
    </AtlasStoreProvider>
  );
}

function ViewerOuter({
  name,
  children,
  errorFallback,
  outerContainerProps = {},
  worldScale: _worldScale,
  updateViewportTimeout,
  ...props
}: AtlasProps & {
  name?: string;
  height?: number | string;
  width?: number | string;
  resizeHash?: number;
  containerProps?: any;
  outerContainerProps?: any;
  aspectRatio?: number;
  errorFallback?: any;
  renderPreset?: Preset;
  worldScale?: number;
  updateViewportTimeout?: number;
} & { children: ReactNode }) {
  const existingAtlas = useAtlasStore();
  const mode = useStore(existingAtlas, (s) => s.mode);
  const setAtlasRuntime = useStore(existingAtlas, (s) => s.setAtlasRuntime);
  const [viewerPreset, setViewerPreset] = useState<Preset | null>();
  const customBridge = useCustomContextBridge();
  const bridge = useContextBridge();
  const ErrorFallback: any = errorFallback || DefaultCanvasFallback;
  const [overlays, setOverlays] = useState<Record<string, any>>({});
  const overlayComponents = Object.entries(overlays);
  const [portals, setPortals] = useState<Record<string, any>>({});
  const portalComponents = Object.entries(portals);
  const [worldSizes, setWorldSizes] = useState<Record<string, number>>({});
  const worldScale = useMemo(() => {
    return _worldScale || Math.max(...Object.values(worldSizes));
  }, [worldSizes]);
  const runtimeOptions = useMemo(() => {
    return { maxOverZoom: worldScale || 1, ...(props.runtimeOptions || {}) };
  }, [worldScale, props.runtimeOptions]);

  useInternalSetCanvasViewports(viewerPreset?.runtime, updateViewportTimeout);

  const updateWorldSize = useCallback((canvasId: string, size: number) => {
    setWorldSizes((sizes) => {
      if (size === -1) {
        const { [canvasId]: _, ...rest } = sizes;
        return rest;
      }
      return { ...sizes, [canvasId]: size };
    });
  }, []);

  const updateOverlay = useCallback((key: string, element: ReactNode, props: any) => {
    setOverlays(({ [key]: _, ...prev }) => {
      if (!element) {
        return prev;
      }

      return {
        ...prev,
        [key]: { element, props },
      };
    });
  }, []);

  const updatePortal = useCallback((key: string, element: ReactNode, props: any) => {
    setPortals(({ [key]: _, ...prev }) => {
      if (!element) {
        return prev;
      }

      return {
        ...prev,
        [key]: { element, props },
      };
    });
  }, []);

  return (
    <ErrorBoundary resetKeys={[]} fallbackRender={(fallbackProps) => <ErrorFallback {...props} {...fallbackProps} />}>
      <AtlasAuto
        {...props}
        mode={mode}
        containerProps={{ style: { position: 'relative' }, ...(props.containerProps || {}) }}
        htmlChildren={
          <>
            {overlayComponents.map(([key, { element: Element, props }]) => (
              <React.Fragment key={key}>
                <Element {...(props || {})} />
              </React.Fragment>
            ))}
          </>
        }
        onCreated={(preset: any) => {
          setViewerPreset(preset);
          setAtlasRuntime(preset.runtime);
          if (props.onCreated) {
            props.onCreated(preset);
          }
        }}
        runtimeOptions={runtimeOptions}
      >
        <AtlasStoreProvider name={name} existing={existingAtlas}>
          <ViewerPresetContext.Provider value={viewerPreset}>
            <WorldSizeContext.Provider value={updateWorldSize}>
              <SetOverlaysReactContext.Provider value={updateOverlay}>
                <SetPortalReactContext.Provider value={updatePortal}>
                  <ContextBridge bridge={bridge} custom={customBridge}>
                    <VirtualAnnotationProvider>{children}</VirtualAnnotationProvider>
                  </ContextBridge>
                </SetPortalReactContext.Provider>
              </SetOverlaysReactContext.Provider>
            </WorldSizeContext.Provider>
          </ViewerPresetContext.Provider>
        </AtlasStoreProvider>
      </AtlasAuto>
      <div>
        {portalComponents.map(([key, { element: Element, props }]) => (
          <React.Fragment key={key}>
            <Element {...(props || {})} />
          </React.Fragment>
        ))}
      </div>
      <div id="atlas-floating-ui" style={{ position: 'relative', zIndex: 999999 }} />
    </ErrorBoundary>
  );
}
