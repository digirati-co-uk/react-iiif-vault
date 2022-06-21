import React, { ReactElement, ReactNode, useState } from 'react';
import { Vault, VaultOptions, globalVault } from '@iiif/vault';
import { ResourceContextType, ResourceProvider } from './ResourceContext';

export const ReactVaultContext = React.createContext<{
  vault: Vault | null;
  setVaultInstance: (vault: Vault) => void;
}>({
  vault: null,
  setVaultInstance: (vault: Vault) => {
    // Do nothing.
  },
});

export function VaultProvider({
  vault,
  vaultOptions,
  useGlobal,
  resources,
  children,
}: {
  vault?: Vault;
  useGlobal?: boolean;
  vaultOptions?: VaultOptions;
  resources?: ResourceContextType;
  children: ReactNode;
}) {
  const [vaultInstance, setVaultInstance] = useState<Vault>(() => {
    if (vault) {
      return vault;
    }
    if (useGlobal) {
      return globalVault(vaultOptions);
    }
    if (vaultOptions) {
      return new Vault(vaultOptions);
    }
    return new Vault();
  });

  return (
    <ReactVaultContext.Provider value={{ vault: vaultInstance, setVaultInstance }}>
      <ResourceProvider value={resources || {}}>{children}</ResourceProvider>
    </ReactVaultContext.Provider>
  );
}
