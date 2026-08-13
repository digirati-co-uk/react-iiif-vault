import type { ReactNode } from 'react';
import { ResourceProvider } from './ResourceContext';

export function SceneContext({ scene, children }: { scene: string; children: ReactNode }) {
  return <ResourceProvider value={{ scene }}>{children}</ResourceProvider>;
}
