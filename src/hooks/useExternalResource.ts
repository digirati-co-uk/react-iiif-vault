import { useExistingVault } from './useExistingVault';
import { useEffect, useMemo, useState } from 'react';

export type ResourceRequestOptions = { noCache?: boolean };

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
  const request = useMemo(() => {
    const initialData: T | undefined = noCache ? undefined : vault.get(id, { skipSelfReturn: true }) || undefined;
    return {
      id,
      vault,
      noCache,
      initialData,
    };
  }, [id, vault, noCache]);
  const [result, setResult] = useState<{
    request: typeof request;
    resource?: T;
    error?: Error;
  }>();

  useEffect(() => {
    let active = true;
    if (!request.initialData) {
      vault.load<T>(id).then(
        (resource) => {
          if (active) setResult({ request, resource });
        },
        (error: unknown) => {
          if (active) setResult({ request, error: error instanceof Error ? error : new Error(String(error)) });
        }
      );
    }
    return () => {
      active = false;
    };
  }, [request]);

  const current = result?.request === request ? result : undefined;
  const resource = current?.resource || request.initialData;
  return {
    id: resource?.id || id,
    requestId: id,
    isLoaded: !!resource,
    error: current?.error,
    cached: !!resource && resource === request.initialData,
    resource,
  };
}
