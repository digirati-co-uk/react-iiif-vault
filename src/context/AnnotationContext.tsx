import { ResourceProvider } from './ResourceContext';
import React, { ReactNode } from 'react';

export function AnnotationContext({ annotation, children }: { annotation: string; children: ReactNode }) {
  return <ResourceProvider value={{ annotation }}>{children}</ResourceProvider>;
}
