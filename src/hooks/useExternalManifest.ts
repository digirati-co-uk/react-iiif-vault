import { useMemo, useState } from 'react';
import { QueryOptions, useQuery } from 'react-query';
import { useVault } from './useVault';
import { ManifestNormalized } from '@iiif/presentation-3';

export const useExternalManifest = (
  id: string,
  config: QueryOptions<ManifestNormalized> = {}
): { id: string; isLoaded: boolean; error: any; manifest?: ManifestNormalized } => {
  const vault = useVault();
  const [realId, setRealId] = useState(id);

  const initialData = useMemo(() => {
    return vault.get<ManifestNormalized>(id) || undefined;
  }, [id, vault]);

  const { data: manifest, error } = useQuery(
    [`manifest`, id],
    async () => {
      const fetchedManifest = initialData ? initialData : await vault.load<ManifestNormalized>(id);
      if (fetchedManifest && realId !== fetchedManifest.id) {
        setRealId(fetchedManifest.id);
      }
      return fetchedManifest;
    },
    {
      refetchIntervalInBackground: false,
      refetchOnMount: false,
      refetchOnWindowFocus: false,
      refetchInterval: false,
      retry: false,

      initialData,
      ...(config as any),
    }
  );

  return { isLoaded: !!manifest, id: realId, error, manifest };
};
