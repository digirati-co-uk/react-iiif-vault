import { useVault, type ActiveVault } from './useVault';
import { useEffect } from 'react';

export const useVaultEffect = <TVault extends ActiveVault = import('@iiif/helpers/vault').Vault>(
  callback: (vault: TVault) => void,
  deps: any[] = []
): void => {
  const vault = useVault<TVault>();

  useEffect(() => {
    callback(vault);
  }, [vault, ...deps]);
};
