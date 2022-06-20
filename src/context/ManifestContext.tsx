import { ResourceProvider } from './ResourceContext';
import React, { ReactNode } from 'react';

export function ManifestContext({ manifest, children }: { manifest: string; children: ReactNode }) {
  return <ResourceProvider value={{ manifest }}>{children}</ResourceProvider>;
}
