import { ReactVaultContext } from '../context/VaultContext';
import { useContext } from 'react';
import type { Vault } from '@iiif/helpers/vault';
import type { Vault4 } from '@iiif/helpers/vault-4';

export type ActiveVault = Vault | Vault4;

export function useActiveVault(): ActiveVault {
  const { vault } = useContext(ReactVaultContext);
  if (!vault) throw new Error('Vault not found. Ensure you have your provider set up correctly.');
  return vault;
}

// The root API retains Presentation 3 types; use bound hooks for Presentation 4.
export function useVault(): Vault;
export function useVault(): ActiveVault {
  return useActiveVault();
}
