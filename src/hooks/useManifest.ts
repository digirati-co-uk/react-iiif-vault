import { useResourceContext } from '../context/ResourceContext';
import type { ManifestNormalized } from '@iiif/parser/presentation-3-normalized/types';
import { type DependencyList, useMemo } from 'react';
import { useVaultSelector } from './useVaultSelector';

export function useManifest(options?: { id?: string; selector?: undefined }): ManifestNormalized | undefined;
export function useManifest<T>(
  options?: { id: string; selector: (manifest: ManifestNormalized) => T },
  deps?: DependencyList
): T | undefined;
export function useManifest<T = ManifestNormalized>(
  options: {
    id?: string;
    selector?: (manifest: ManifestNormalized) => T;
  } = {},
  deps: DependencyList = []
): ManifestNormalized | T | undefined {
  const { id, selector } = options;
  const ctx = useResourceContext();
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
