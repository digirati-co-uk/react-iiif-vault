import { globalVault } from '@iiif/vault';
import { useContext } from 'react';
import { ReactVaultContext } from '../context/VaultContext';

export function useExistingVault() {
  const oldContext: any = useContext(ReactVaultContext);

  return oldContext && oldContext.vault ? (oldContext.vault as any) : globalVault();
}
