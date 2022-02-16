import { useResourceContext } from '../context/ResourceContext';
import { ManifestNormalized } from '@iiif/presentation-3';
import { useVaultSelector } from "./useVaultSelector";
import { useMemo } from 'react';
import { IIIFStore } from '@iiif/vault';

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
  const manifestId = id ? id : ctx.manifest;

  const manifest = manifestId
    ? useVaultSelector((s: IIIFStore) =>
      manifestId ? s.iiif.entities.Manifest[manifestId] : undefined
    )
    : undefined;

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
