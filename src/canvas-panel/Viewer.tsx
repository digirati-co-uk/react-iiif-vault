import React, { ReactNode, useLayoutEffect, useRef, useState } from 'react';
import { AtlasAuto, Preset, AtlasProps } from '@atlas-viewer/atlas';
import { ErrorBoundary } from 'react-error-boundary';
import { ContextBridge, useContextBridge } from '../context/ContextBridge';
import { VirtualAnnotationProvider } from '../hooks/useVirtualAnnotationPageContext';
import { DefaultCanvasFallback } from './render/DefaultCanvasFallback';
import { OverlayPortalContext, PortalContext } from '../context/PortalContext';
import { ViewerPresetContext } from '../context/ViewerPresetContext';
import { createRoot, Root } from 'react-dom/client';

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
  const portal = useRef<HTMLDivElement>(null);
  const [portalElement, setPortalElement] = useState<Root | null>();
  const [viewerPreset, setViewerPreset] = useState<Preset | null>();
  const overlayPortal = useRef<HTMLDivElement>(null);
  const [overlayPortalElement, setOverlayPortalElement] = useState<Root | null>();
  const bridge = useContextBridge();
  const ErrorFallback: any = errorFallback || DefaultCanvasFallback;

  useLayoutEffect(() => {
    const roots: Record<string, Root> = {};
    if (portal.current) {
      const $el = document.createElement('div');
      portal.current.appendChild($el);
      roots.portal = createRoot($el);
      setPortalElement(roots.portal);
    }
    if (overlayPortal.current) {
      const $el = document.createElement('div');
      overlayPortal.current.appendChild($el);
      roots.overlayPortal = createRoot($el);
      setOverlayPortalElement(roots.overlayPortal);
    }

    return () => {
      setPortalElement(null);
      setOverlayPortalElement(null);

      setTimeout(() => {
        if (roots.portal) {
          roots.portal.unmount();
        }
        if (roots.overlayPortal) {
          roots.overlayPortal.unmount();
        }
      }, 0);
    };
  }, []);

  return (
    <ErrorBoundary fallbackRender={() => <ErrorFallback {...props} />}>
      <AtlasAuto
        {...props}
        containerProps={{ style: { position: 'relative' }, ...(props.containerProps || {}) }}
        htmlChildren={<div ref={overlayPortal} />}
        onCreated={(preset: any) => {
          setViewerPreset(preset);
          if (props.onCreated) {
            props.onCreated(preset);
          }
        }}
      >
        <ViewerPresetContext.Provider value={viewerPreset}>
          <PortalContext.Provider value={portalElement as any}>
            <OverlayPortalContext.Provider value={overlayPortalElement as any}>
              <ContextBridge bridge={bridge}>
                <VirtualAnnotationProvider>{children}</VirtualAnnotationProvider>
              </ContextBridge>
            </OverlayPortalContext.Provider>
          </PortalContext.Provider>
        </ViewerPresetContext.Provider>
      </AtlasAuto>
      <div ref={portal} />
    </ErrorBoundary>
  );
}
