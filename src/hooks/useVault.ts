import { ReactVaultContext } from '../context/VaultContext';
import { useContext } from 'react';
import { Vault } from '@iiif/helpers/vault';
import { Vault4 } from '@iiif/helpers/vault-4';

export type ActiveVault = Vault | Vault4;

export const useVault = <TVault extends ActiveVault = Vault>(): TVault => {
  const { vault } = useContext(ReactVaultContext);

  if (vault === null) {
    throw new Error('Vault not found. Ensure you have your provider set up correctly.');
  }

  return vault as TVault;
};
