import { useResourceContext } from '../context/ResourceContext';
import type { Reference } from '@iiif/parser/presentation-3/types';
import { useVaultSelector } from './useVaultSelector';
import { IIIFStore } from '@iiif/helpers/vault';

export function useCanvasSubset(idsOrRefs?: Array<string | Reference>): Reference<'Canvas'>[] {
  const ctx = useResourceContext();
  const manifestId = ctx.manifest;
  const refs = idsOrRefs ? idsOrRefs.map((item) => (typeof item === 'string' ? item : item?.id)) : [];
  return useVaultSelector(
    (s: IIIFStore) => {
      const manifest = manifestId ? s.iiif.entities.Manifest[manifestId] : undefined;
      const items = manifest?.items || [];

      if (typeof idsOrRefs === 'undefined') {
        return items;
      }

      const newItems = [];
      for (const item of manifest?.items || []) {
        if (refs.indexOf(item.id) !== -1) {
          newItems.push(item);
        }
      }

      return newItems;
    },
    [refs.join('/')]
  );
}
