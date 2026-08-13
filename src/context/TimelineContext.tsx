import type { ReactNode } from 'react';
import { ResourceProvider } from './ResourceContext';

export function TimelineContext({ timeline, children }: { timeline: string; children: ReactNode }) {
  return <ResourceProvider value={{ timeline }}>{children}</ResourceProvider>;
}
