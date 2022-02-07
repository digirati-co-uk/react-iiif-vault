import { VaultProvider } from './src';
import { Vault } from '@iiif/vault';
import React from 'react';

export const createVaultWrapper = (vault: Vault) => {
  return (props: any) => <VaultProvider vault={vault} {...props} />;
};
