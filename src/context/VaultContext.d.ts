import React from 'react';
import { Vault, VaultOptions } from '@iiif/vault';
import { ResourceContextType } from './ResourceContext';
export declare const ReactVaultContext: React.Context<{
    vault: Vault | null;
    setVaultInstance: (vault: Vault) => void;
}>;
export declare const VaultProvider: React.FC<{
    vault?: Vault;
    vaultOptions?: VaultOptions;
    resources?: ResourceContextType;
}>;
