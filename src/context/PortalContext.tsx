import React, { ReactNode, useContext, useLayoutEffect, useMemo, useRef } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { useViewerPreset, ViewerPresetContext } from './ViewerPresetContext';

export const PortalContext = React.createContext<HTMLDivElement | null>(null);
export const OverlayPortalContext = React.createContext<HTMLDivElement | null>(null);

export function CanvasPortal({ children, overlay }: { children: ReactNode; overlay?: boolean }) {
  const htmlElement = useContext(overlay ? OverlayPortalContext : PortalContext);
  const rootRef = useRef<Root | null>(null);
  const preset = useViewerPreset();

  useLayoutEffect(() => {
    if (!rootRef.current) {
      rootRef.current = htmlElement ? createRoot(htmlElement) : null;
    }
  }, []);

  useLayoutEffect(() => {
    return () => {
      rootRef.current?.unmount();
      rootRef.current = null;
    };
  }, []);

  useLayoutEffect(() => {
    if (rootRef.current) {
      rootRef.current.render(<ViewerPresetContext.Provider value={preset}>{children}</ViewerPresetContext.Provider>);
    }
  }, [children, preset]);

  return null;
}
