import { useResourceContext } from '../context/ResourceContext';
import { CollectionNormalized } from '@iiif/presentation-3';
import { useVaultSelector } from "./useVaultSelector";
import { useMemo } from 'react';
import { IIIFStore } from '@iiif/vault';

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

  const collection = collectionId
    ? useVaultSelector((s: IIIFStore) => s.iiif.entities.Collection[collectionId])
    : undefined;

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
