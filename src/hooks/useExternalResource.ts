import { useExistingVault } from './useExistingVault';
import { useEffect, useMemo, useState } from 'react';

export type ResourceRequestOptions = {
  noCache?: boolean;
};

export function useExternalResource<T extends { id: string }>(
  idOrRef: string | { id: string; type: string },
  { noCache = false }: ResourceRequestOptions = {}
): {
  id: string;
  requestId: string;
  isLoaded: boolean;
  error: Error | undefined;
  cached: boolean;
  resource?: T;
} {
  const id = typeof idOrRef === 'string' ? idOrRef : idOrRef.id;
  const vault = useExistingVault();
  const [realId, setRealId] = useState(id);
  const [error, setError] = useState<Error | undefined>(undefined);
  const initialData = useMemo(() => {
    return vault.get(id, { skipSelfReturn: true }) || undefined;
  }, [id, vault]);
  const [resource, setResource] = useState<T | undefined>(initialData);

  useEffect(() => {
    (async () => {
      try {
        const fetchedResource = initialData && !noCache ? initialData : await vault.load<T>(id);
        if (fetchedResource) {
          setRealId(fetchedResource.id);
        }

        setResource(fetchedResource);
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
      }
    })();
  }, [id, initialData, noCache, vault]);

  return {
    isLoaded: !!resource,
    id: realId,
    requestId: id,
    error,
    resource,
    cached: !!(resource && resource === initialData),
  };
}
