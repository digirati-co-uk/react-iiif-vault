import type { IIIFStore, Vault } from '@iiif/helpers/vault';
import { isVault4, type Vault4 } from '@iiif/helpers/vault-4';
import type { DependencyList } from 'react';
import { useExistingVault as useExistingVaultBase } from './useExistingVault';
import { useVault as useVaultBase, type ActiveVault } from './useVault';
import { useVaultEffect as useVaultEffectBase } from './useVaultEffect';
import { useVaultSelector as useVaultSelectorBase } from './useVaultSelector';

export type VaultHooks<TVault extends ActiveVault> = {
  useVault(): TVault;
  useExistingVault(vault?: TVault): TVault;
  useVaultEffect(callback: (vault: TVault) => void, deps?: DependencyList): void;
  useVaultSelector<T>(selector: (state: IIIFStore, vault: TVault) => T, deps?: DependencyList): T;
};

function expectVault3(vault: ActiveVault): Vault {
  if (isVault4(vault)) throw new Error('Expected a Presentation 3 Vault, but found a Vault4.');
  return vault;
}

function expectVault4(vault: ActiveVault): Vault4 {
  if (!isVault4(vault)) throw new Error('Expected a Vault4, but found a Presentation 3 Vault.');
  return vault;
}

function bindVaultHooks<TVault extends ActiveVault>(expectVault: (vault: ActiveVault) => TVault): VaultHooks<TVault> {
  return {
    useVault() {
      return expectVault(useVaultBase<ActiveVault>());
    },
    useExistingVault(vault?: TVault) {
      return expectVault(useExistingVaultBase(vault));
    },
    useVaultEffect(callback, deps) {
      useVaultEffectBase<ActiveVault>((vault) => callback(expectVault(vault)), deps);
    },
    useVaultSelector(selector, deps) {
      return useVaultSelectorBase((state, vault) => selector(state, expectVault(vault)), deps);
    },
  };
}

const vault3Hooks = bindVaultHooks(expectVault3);
const vault4Hooks = bindVaultHooks(expectVault4);

/** Creates Vault hooks bound to one Presentation version and rejects a mismatched provider at runtime. */
export function createVaultHooks(): VaultHooks<Vault>;
export function createVaultHooks(version: 3): VaultHooks<Vault>;
export function createVaultHooks(version: 4): VaultHooks<Vault4>;
export function createVaultHooks(version: 3 | 4 = 3): VaultHooks<Vault> | VaultHooks<Vault4> {
  return version === 4 ? vault4Hooks : vault3Hooks;
}
