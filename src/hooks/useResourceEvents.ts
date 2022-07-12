import { useVault } from './useVault';
import { useVaultSelector } from './useVaultSelector';
import { useMemo } from 'react';
import { NormalizedEntity } from '@iiif/vault';
import { Reference } from '@iiif/presentation-3';
import { createEventsHelper } from '@iiif/vault-helpers/events';

export function useResourceEvents<T extends NormalizedEntity>(resource?: Reference, scope?: string[]) {
  const vault = useVault();
  const helper = useMemo(() => createEventsHelper(vault), [vault]);

  const hooks = useVaultSelector(() => {
    if (resource && resource.id) {
      return vault.getResourceMeta(resource.id, 'eventManager');
    }
    return null;
  }, [resource]);

  return useMemo(() => {
    return resource ? helper.getListenersAsProps(resource, scope) : {};
  }, [hooks, resource, vault, scope]);
}
