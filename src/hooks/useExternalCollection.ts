import { CollectionNormalized } from '@iiif/parser/presentation-3-normalized/types';
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
  /** @deprecated Use collection. Retained for existing consumers. */
  manifest?: CollectionNormalized;
  collection?: CollectionNormalized;
} {
  const { id, isLoaded, error, resource, requestId, cached } = useExternalResource<CollectionNormalized>(
    idOrRef,
    options
  );

  return { id, isLoaded, error, manifest: resource, collection: resource, requestId, cached };
}
