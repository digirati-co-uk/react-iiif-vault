import type { ReactNode } from 'react';
import type { ContainerReference } from '../utility/canvas-compat';
import { ResourceProvider } from './ResourceContext';

export function ContainerContext({ container, children }: { container: ContainerReference; children: ReactNode }) {
  return (
    <ResourceProvider
      value={{
        canvas: container.type === 'Canvas' ? container.id : undefined,
        scene: container.type === 'Scene' ? container.id : undefined,
        timeline: container.type === 'Timeline' ? container.id : undefined,
      }}
    >
      {children}
    </ResourceProvider>
  );
}
