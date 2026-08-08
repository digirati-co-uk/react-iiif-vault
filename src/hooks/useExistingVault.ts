import { globalVault, Vault } from '@iiif/helpers/vault';
import { Vault4 } from '@iiif/helpers/vault-4';
import { useContext } from 'react';
import { ReactVaultContext } from '../context/VaultContext';

export function useExistingVault(): Vault;
export function useExistingVault(vault: Vault4): Vault4;
export function useExistingVault(vault: Vault): Vault;
export function useExistingVault(vault: Vault | Vault4): Vault | Vault4;
export function useExistingVault(vault?: Vault | Vault4): Vault | Vault4;
export function useExistingVault(vault?: Vault | Vault4): Vault | Vault4 {
  const context = useContext(ReactVaultContext);

  if (vault) {
    return vault;
  }

  return context.vault || globalVault();
}
