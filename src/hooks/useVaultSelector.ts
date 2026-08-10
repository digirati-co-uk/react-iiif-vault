import { useVault, type ActiveVault } from './useVault';
import { IIIFStore } from '@iiif/helpers/vault';
import { isVault4 } from '@iiif/helpers/vault-4';
import { type DependencyList, useEffect, useState } from 'react';

export function useVaultSelector<T, TVault extends ActiveVault = import('@iiif/helpers/vault').Vault>(
  selector: (state: IIIFStore, vault: TVault) => T,
  deps: DependencyList = []
) {
  const vault = useVault<TVault>();
  const [selectedState, setSelectedState] = useState<T>(() => selector(vault.getState(), vault));

  useEffect(() => {
    const select = (state: IIIFStore) => selector(state, vault);
    if (isVault4(vault)) {
      return vault.subscribe(select, setSelectedState, false);
    }
    return vault.subscribe(select, setSelectedState, false);
  }, [vault, ...deps]);

  return selectedState;
}
