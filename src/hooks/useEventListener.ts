import { Reference } from '@iiif/presentation-3';
import { useVault } from './useVault';
import { useEffect, useMemo } from 'react';
import { createEventsHelper } from '@iiif/vault-helpers/events';

type SupportedEvents = 'onClick';

export function useEventListener<T>(
  resource: Reference,
  name: SupportedEvents,
  listener: (e: any, resource: T) => void,
  scope?: string[],
  deps: any[] = []
) {
  const vault = useVault();
  const helper = useMemo(() => createEventsHelper(vault), [vault]);

  useEffect(() => {
    const currentResource = resource;
    if (!currentResource) {
      return () => {
        //
      };
    }
    helper.addEventListener(currentResource, name, listener, scope);
    return () => {
      helper.removeEventListener(currentResource, name, listener);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [helper, resource, name, ...deps]);
}
