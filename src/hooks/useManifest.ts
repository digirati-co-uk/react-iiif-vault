import { useResourceContext } from '../context/ResourceContext';
import { ManifestNormalized } from '@iiif/presentation-3-normalized';
import { useVault } from './useVault';
import { useMemo } from 'react';
import { useVaultSelector } from './useVaultSelector';

export function useManifest(options?: { id: string }): ManifestNormalized | undefined;
export function useManifest<T>(
  options?: { id: string; selector: (manifest: ManifestNormalized) => T },
  deps?: any[]
): T | undefined;
export function useManifest<T = ManifestNormalized>(
  options: {
    id?: string;
    selector?: (manifest: ManifestNormalized) => T;
  } = {},
  deps: any[] = []
): ManifestNormalized | T | undefined {
  const { id, selector } = options;
  const ctx = useResourceContext();
  const vault = useVault();
  const manifestId = id ? id : ctx.manifest;

  const manifest = useVaultSelector(
    (s) => (manifestId ? s.iiif.entities.Manifest[manifestId] : undefined),
    [manifestId]
  );

  return useMemo(() => {
    if (!manifest) {
      return undefined;
    }
    if (selector) {
      return selector(manifest);
    }
    return manifest;
  }, [manifest, selector, ...deps]);
}
