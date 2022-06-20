import { ResourceProvider } from './ResourceContext';
import React, { ReactNode } from 'react';

export function RangeContext({ range, children }: { range: string; children: ReactNode }) {
  return <ResourceProvider value={{ range }}>{children}</ResourceProvider>;
}
