import React, { ReactNode, useContext, useLayoutEffect } from 'react';
import { Root } from 'react-dom/client';
import { useViewerPreset, ViewerPresetContext } from './ViewerPresetContext';

export const PortalContext = React.createContext<Root | null>(null);
export const OverlayPortalContext = React.createContext<Root | null>(null);

export function CanvasPortal({ children, overlay }: { children: ReactNode; overlay?: boolean }) {
  const htmlElement = useContext(overlay ? OverlayPortalContext : PortalContext);
  const preset = useViewerPreset();

  useLayoutEffect(() => {
    if (htmlElement) {
      try {
        htmlElement.render(<ViewerPresetContext.Provider value={preset}>{children}</ViewerPresetContext.Provider>);
      } catch (e) {
        // ignore..
      }
    }
  }, [children, preset]);

  return null;
}
