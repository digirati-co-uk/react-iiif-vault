import { useVault, type ActiveVault } from './useVault';
import { IIIFStore } from '@iiif/helpers/vault';
import { useEffect, useState } from 'react';

export function useVaultSelector<T, TVault extends ActiveVault = import('@iiif/helpers/vault').Vault>(
  selector: (state: IIIFStore, vault: TVault) => T,
  deps: any[] = []
) {
  const vault = useVault<TVault>();
  const [selectedState, setSelectedState] = useState<T>(() => selector(vault.getState(), vault));

  useEffect(() => {
    return (vault as any).subscribe(
      (s: IIIFStore) => selector(s, vault),
      (s: T) => {
        setSelectedState(s);
      },
      false
    );
  }, [vault, ...deps]);

  return selectedState as T;
}
