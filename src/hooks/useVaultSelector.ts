import { useVault, type ActiveVault } from './useVault';
import { isVault4 } from '@iiif/helpers/vault-4';
import type { IIIFStore, Vault } from '@iiif/helpers/vault';
import { useMemo, useSyncExternalStore, type DependencyList } from 'react';

export function useSelectorForVault<T, TVault extends ActiveVault>(
  vault: TVault,
  selector: (state: IIIFStore, vault: TVault) => T,
  deps: DependencyList = []
): T {
  const subscription = useMemo(() => {
    let state = vault.getState();
    let selected = selector(state, vault);
    return {
      snapshot() {
        const nextState = vault.getState();
        if (nextState !== state) {
          selected = selector(nextState, vault);
          state = nextState;
        }
        return selected;
      },
      subscribe(notify: () => void) {
        if (isVault4(vault)) return vault.subscribe(() => notify(), true);
        return vault.subscribe(() => notify(), true);
      },
    };
  }, [vault, ...deps]);
  return useSyncExternalStore(subscription.subscribe, subscription.snapshot, subscription.snapshot);
}

export function useVaultSelector<T>(selector: (state: IIIFStore, vault: Vault) => T, deps: DependencyList = []): T {
  return useSelectorForVault(useVault(), selector, deps);
}
