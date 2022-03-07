import { CollectionNormalized } from '@iiif/presentation-3';
import { ResourceRequestOptions, useExternalResource } from './useExternalResource';

export function useExternalCollection(
  idOrRef: string | { id: string; type: string },
  options?: ResourceRequestOptions
): {
  id: string;
  requestId: string;
  isLoaded: boolean;
  cached?: boolean;
  error: any;
  manifest?: CollectionNormalized;
} {
  const { id, isLoaded, error, resource, requestId, cached } = useExternalResource<CollectionNormalized>(
    idOrRef,
    options
  );

  return { id, isLoaded, error, manifest: resource, requestId, cached };
}
