import { ManifestNormalized } from '@iiif/presentation-3-normalized';
import { ResourceRequestOptions, useExternalResource } from './useExternalResource';

export function useExternalManifest(
  idOrRef: string | { id: string; type: string },
  options?: ResourceRequestOptions
): {
  id: string;
  requestId: string;
  isLoaded: boolean;
  cached?: boolean;
  error: any;
  manifest?: ManifestNormalized;
} {
  const { id, isLoaded, error, resource, requestId, cached } = useExternalResource<ManifestNormalized>(
    idOrRef,
    options
  );

  return { id, isLoaded, error, manifest: resource, requestId, cached };
}
