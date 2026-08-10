import type { CollectionNormalized } from '@iiif/parser/presentation-3-normalized/types';
import { ResourceRequestOptions, useExternalResource } from './useExternalResource';

export function useExternalCollection(
  idOrRef: string | { id: string; type: string },
  options?: ResourceRequestOptions
): {
  id: string;
  requestId: string;
  isLoaded: boolean;
  cached?: boolean;
  error: Error | undefined;
  collection?: CollectionNormalized;
} {
  const { id, isLoaded, error, resource, requestId, cached } = useExternalResource<CollectionNormalized>(
    idOrRef,
    options
  );

  return { id, isLoaded, error, collection: resource, requestId, cached };
}
