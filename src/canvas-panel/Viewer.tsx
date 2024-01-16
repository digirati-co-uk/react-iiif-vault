import React, { ReactNode, useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AtlasAuto, Preset, AtlasProps } from '@atlas-viewer/atlas';
import { ErrorBoundary } from 'react-error-boundary';
import { ContextBridge, useContextBridge } from '../context/ContextBridge';
import { VirtualAnnotationProvider } from '../hooks/useVirtualAnnotationPageContext';
import { DefaultCanvasFallback } from './render/DefaultCanvasFallback';
import { ViewerPresetContext } from '../context/ViewerPresetContext';
import { SetOverlaysReactContext, SetPortalReactContext } from './context/overlays';
import { WorldSizeContext } from './context/world-size';
import { useCanvas } from '../hooks/useCanvas';

export function Viewer({
  children,
  errorFallback,
  outerContainerProps = {},
  worldScale: _worldScale,
  ...props
}: AtlasProps & {
  height?: number | string;
  width?: number | string;
  resizeHash?: number;
  containerProps?: any;
  outerContainerProps?: any;
  aspectRatio?: number;
  errorFallback?: any;
  worldScale?: number;
} & { children: ReactNode }) {
  const [viewerPreset, setViewerPreset] = useState<Preset | null>();
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
    return { maxOverZoom: worldScale || 1 };
  }, [worldScale]);

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
          if (props.onCreated) {
            props.onCreated(preset);
          }
        }}
        runtimeOptions={runtimeOptions}
      >
        <ViewerPresetContext.Provider value={viewerPreset}>
          <WorldSizeContext.Provider value={updateWorldSize}>
            <SetOverlaysReactContext.Provider value={updateOverlay}>
              <SetPortalReactContext.Provider value={updatePortal}>
                <ContextBridge bridge={bridge}>
                  <VirtualAnnotationProvider>{children}</VirtualAnnotationProvider>
                </ContextBridge>
              </SetPortalReactContext.Provider>
            </SetOverlaysReactContext.Provider>
          </WorldSizeContext.Provider>
        </ViewerPresetContext.Provider>
      </AtlasAuto>
      <div>
        {portalComponents.map(([key, { element: Element, props }]) => (
          <React.Fragment key={key}>
            <Element {...(props || {})} />
          </React.Fragment>
        ))}
      </div>
    </ErrorBoundary>
  );
}
