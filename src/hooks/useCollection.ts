import { useResourceContext } from '../context/ResourceContext';
import type { CollectionNormalized } from '@iiif/parser/presentation-3-normalized/types';
import { type DependencyList, useMemo } from 'react';
import { useVaultSelector } from './useVaultSelector';

export function useCollection(options: { id: string; selector?: undefined }): CollectionNormalized | undefined;
export function useCollection<T>(
  options: { id: string; selector: (collection: CollectionNormalized) => T },
  deps?: DependencyList
): T | undefined;
export function useCollection<T = CollectionNormalized>(
  options: {
    id?: string;
    selector?: (collection: CollectionNormalized) => T;
  },
  deps: DependencyList = []
): CollectionNormalized | T | undefined {
  const { id, selector } = options;
  const ctx = useResourceContext();
  const collectionId = id ? id : ctx.collection;

  const collection = useVaultSelector(
    (s) => (collectionId ? s.iiif.entities.Collection[collectionId] : undefined),
    [collectionId]
  ) as CollectionNormalized | undefined;

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
