import type { ManifestNormalized } from '@iiif/parser/presentation-3-normalized/types';
import { ResourceRequestOptions, useExternalResource } from './useExternalResource';

export function useExternalManifest(
  idOrRef: string | { id: string; type: string },
  options?: ResourceRequestOptions
): {
  id: string;
  requestId: string;
  isLoaded: boolean;
  cached?: boolean;
  error: Error | undefined;
  manifest?: ManifestNormalized;
} {
  const { id, isLoaded, error, resource, requestId, cached } = useExternalResource<ManifestNormalized>(
    idOrRef,
    options
  );

  return { id, isLoaded, error, manifest: resource, requestId, cached };
}
