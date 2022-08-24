import React, { ReactNode } from 'react';
import { ResourceProvider } from './ResourceContext';

export function AnnotationPageContext({ annotationPage, children }: { annotationPage: string; children: ReactNode }) {
  return <ResourceProvider value={{ annotationPage }}>{children}</ResourceProvider>;
}
