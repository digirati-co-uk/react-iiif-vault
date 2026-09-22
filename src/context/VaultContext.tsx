import React, { ReactNode, useMemo, useState } from 'react';
import { Vault, VaultOptions, globalVault } from '@iiif/helpers/vault';
import { Vault4 } from '@iiif/helpers/vault-4';
import { ResourceContextType, ResourceProvider } from './ResourceContext';

export const ReactVaultContext = React.createContext<{
  vault: Vault | Vault4 | null;
  setVaultInstance: (vault: Vault | Vault4) => void;
}>({
  vault: null,
  setVaultInstance: (_vault: Vault | Vault4) => {
    // Do nothing.
  },
});

export function VaultProvider({
  vault,
  vaultOptions,
  useGlobal,
  resources,
  version = 3,
  children,
}: {
  vault?: Vault | Vault4;
  version?: 3 | 4;
  useGlobal?: boolean;
  vaultOptions?: VaultOptions;
  resources?: ResourceContextType;
  children: ReactNode;
}) {
  const generatedVault = useMemo(() => {
    if (vault) {
      return vault;
    }
    if (version === 4) {
      return new Vault4(vaultOptions);
    }
    if (useGlobal) {
      return globalVault(vaultOptions);
    }
    if (vaultOptions) {
      return new Vault(vaultOptions);
    }
    return new Vault();
  }, [useGlobal, vault, vaultOptions, version]);
  const [override, setOverride] = useState<{ generated: Vault | Vault4; vault: Vault | Vault4 }>();
  const setVaultInstance = (next: Vault | Vault4) => setOverride({ generated: generatedVault, vault: next });
  const vaultInstance = vault || (override && override.generated === generatedVault ? override.vault : generatedVault);

  return (
    <ReactVaultContext.Provider value={{ vault: vaultInstance, setVaultInstance }}>
      <ResourceProvider value={resources || {}}>{children}</ResourceProvider>
    </ReactVaultContext.Provider>
  );
}
