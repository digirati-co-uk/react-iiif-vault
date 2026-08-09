import { globalVault, Vault } from '@iiif/helpers/vault';
import { Vault4 } from '@iiif/helpers/vault-4';
import { useContext } from 'react';
import { ReactVaultContext } from '../context/VaultContext';

export function useExistingVault(): Vault;
export function useExistingVault<TVault extends Vault | Vault4>(vault: TVault): TVault;
export function useExistingVault(vault: Vault | Vault4 | undefined): Vault | Vault4;
export function useExistingVault(vault?: Vault | Vault4): Vault | Vault4 {
  const context = useContext(ReactVaultContext);

  if (vault) {
    return vault;
  }

  return (context.vault || globalVault()) as Vault | Vault4;
}
