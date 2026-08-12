import { useVault, type ActiveVault } from './useVault';
import { type DependencyList, useEffect } from 'react';

export const useVaultEffect = <TVault extends ActiveVault = import('@iiif/helpers/vault').Vault>(
  callback: (vault: TVault) => void,
  deps: DependencyList = []
): void => {
  const vault = useVault<TVault>();

  useEffect(() => {
    callback(vault);
  }, [vault, ...deps]);
};
