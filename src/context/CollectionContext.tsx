import { ResourceProvider } from './ResourceContext';
import React, { ReactNode } from 'react';

export function CollectionContext({ collection, children }: { collection: string; children: ReactNode }) {
  return <ResourceProvider value={{ collection }}>{children}</ResourceProvider>;
}
