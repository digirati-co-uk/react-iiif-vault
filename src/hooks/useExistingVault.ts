import { globalVault, Vault } from '@iiif/helpers/vault';
import { useContext } from 'react';
import { ReactVaultContext } from '../context/VaultContext';

export function useExistingVault(vault?: Vault): Vault {
  const oldContext: any = useContext(ReactVaultContext);

  if (vault) {
    return vault;
  }

  return oldContext && oldContext.vault ? (oldContext.vault as any) : globalVault();
}
