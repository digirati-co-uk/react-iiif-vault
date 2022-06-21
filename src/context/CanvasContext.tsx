import { ResourceProvider } from './ResourceContext';
import React, { ReactNode } from 'react';

export function CanvasContext({ canvas, children }: { canvas: string; children: ReactNode }) {
  return <ResourceProvider value={{ canvas }}>{children}</ResourceProvider>;
}
