import type { ReactNode } from 'react';
import { ResourceProvider } from '../context/ResourceContext';

/** Supplies a Scene resource selection without changing the enclosing Vault. */
export function SceneContext({ scene, children }: { scene: string; children: ReactNode }) {
  return <ResourceProvider value={{ scene }}>{children}</ResourceProvider>;
}
