import { useMemo, useState } from 'react';
import { QueryOptions, useQuery } from 'react-query';
import { useVault } from './useVault';
import { CollectionNormalized } from '@iiif/presentation-3';

export const useExternalCollection = (
  id: string,
  config: QueryOptions<CollectionNormalized> = {}
): { id: string; isLoaded: boolean; collection?: CollectionNormalized } => {
  const vault = useVault();
  const [realId, setRealId] = useState(id);

  const initialData = useMemo(() => vault.get<CollectionNormalized>(id), [id, vault]);

  const { data: collection, isFetching } = useQuery(
    `collection:${id}`,
    async () => {
      const fetchedCollection = initialData ? initialData : await vault.loadCollection(id);
      if (fetchedCollection) {
        setRealId(fetchedCollection.id);
      }
      return fetchedCollection;
    },
    {
      refetchIntervalInBackground: false,
      refetchOnMount: false,
      refetchOnWindowFocus: false,
      refetchInterval: false,
      initialData,
      ...(config as any),
    }
  );

  return { isLoaded: !isFetching, id: realId, collection };
};
