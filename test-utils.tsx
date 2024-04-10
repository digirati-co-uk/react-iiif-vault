import { VaultProvider } from './src';
import { Vault } from '@iiif/helpers/vault';

export const createVaultWrapper = (vault: Vault) => {
  return (props: any) => <VaultProvider vault={vault} {...props} />;
};
