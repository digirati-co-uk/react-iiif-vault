import { useVault } from './useVault';
import { IIIFStore, Vault } from '@iiif/vault';
import { useEffect, useState } from 'react';

export function useVaultSelector<T>(selector: (state: IIIFStore, vault: Vault) => T, deps: any[] = []) {
  const vault = useVault();
  const [selectedState, setSelectedState] = useState<T>(() => selector(vault.getState(), vault));

  useEffect(() => {
    return vault.subscribe(
      (s) => selector(s, vault),
      (state: T) => {
        setSelectedState(state);
      },
      false
    );
  }, deps);

  return selectedState as T;
}
