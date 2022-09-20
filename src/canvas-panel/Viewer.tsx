import React, { ReactNode, useCallback, useLayoutEffect, useRef, useState } from 'react';
import { AtlasAuto, Preset, AtlasProps } from '@atlas-viewer/atlas';
import { ErrorBoundary } from 'react-error-boundary';
import { ContextBridge, useContextBridge } from '../context/ContextBridge';
import { VirtualAnnotationProvider } from '../hooks/useVirtualAnnotationPageContext';
import { DefaultCanvasFallback } from './render/DefaultCanvasFallback';
import { ViewerPresetContext } from '../context/ViewerPresetContext';
import { SetOverlaysReactContext, SetPortalReactContext } from './context/overlays';

export function Viewer({
  children,
  errorFallback,
  outerContainerProps = {},
  ...props
}: AtlasProps & {
  height?: number | string;
  width?: number | string;
  resizeHash?: number;
  containerProps?: any;
  outerContainerProps?: any;
  aspectRatio?: number;
  errorFallback?: any;
} & { children: ReactNode }) {
  const [viewerPreset, setViewerPreset] = useState<Preset | null>();
  const bridge = useContextBridge();
  const ErrorFallback: any = errorFallback || DefaultCanvasFallback;
  const [overlays, setOverlays] = useState<Record<string, any>>({});
  const overlayComponents = Object.entries(overlays);
  const [portals, setPortals] = useState<Record<string, any>>({});
  const portalComponents = Object.entries(portals);

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
    <ErrorBoundary fallbackRender={() => <ErrorFallback {...props} />}>
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
      >
        <ViewerPresetContext.Provider value={viewerPreset}>
          <SetOverlaysReactContext.Provider value={updateOverlay}>
            <SetPortalReactContext.Provider value={updatePortal}>
              <ContextBridge bridge={bridge}>
                <VirtualAnnotationProvider>{children}</VirtualAnnotationProvider>
              </ContextBridge>
            </SetPortalReactContext.Provider>
          </SetOverlaysReactContext.Provider>
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
