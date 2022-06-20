import React, { ReactNode, useContext, useLayoutEffect, useMemo } from 'react';
import { createRoot } from 'react-dom/client';

export const PortalContext = React.createContext<HTMLDivElement | null>(null);
export const OverlayPortalContext = React.createContext<HTMLDivElement | null>(null);

export function CanvasPortal({ children, overlay }: { children: ReactNode; overlay?: boolean }) {
  const htmlElement = useContext(overlay ? OverlayPortalContext : PortalContext);
  const root = useMemo(() => (htmlElement ? createRoot(htmlElement) : null), [htmlElement]);

  useLayoutEffect(() => {
    return () => root?.unmount();
  }, [root]);

  useLayoutEffect(() => {
    if (root) {
      root.render(children);
    }
  }, [children]);

  return null;
}
