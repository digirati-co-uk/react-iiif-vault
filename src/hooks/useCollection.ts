import { useResourceContext } from '../context/ResourceContext';
import { CollectionNormalized } from '@iiif/presentation-3-normalized';
import { useMemo } from 'react';
import { useVaultSelector } from './useVaultSelector';

export function useCollection(options: { id: string }): CollectionNormalized | undefined;
export function useCollection<T>(
  options: { id: string; selector: (collection: CollectionNormalized) => T },
  deps?: any[]
): T | undefined;
export function useCollection<T = CollectionNormalized>(
  options: {
    id?: string;
    selector?: (collection: CollectionNormalized) => T;
  },
  deps: any[] = []
): CollectionNormalized | T | undefined {
  const { id, selector } = options;
  const ctx = useResourceContext();
  const collectionId = id ? id : ctx.collection;

  const collection = useVaultSelector(
    (s) => (collectionId ? s.iiif.entities.Collection[collectionId] : undefined),
    [collectionId]
  );

  return useMemo(() => {
    if (!collection) {
      return undefined;
    }
    if (selector) {
      return selector(collection);
    }
    return collection;
  }, [collection, selector, ...deps]);
}
