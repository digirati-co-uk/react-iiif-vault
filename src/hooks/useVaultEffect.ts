import { useVault } from './useVault';
import type { Vault } from '@iiif/helpers/vault';
import { useEffect, type DependencyList } from 'react';

export function useVaultEffect(callback: (vault: Vault) => void, deps: DependencyList = []): void {
  const vault = useVault();
  useEffect(() => {
    const cleanup: unknown = callback(vault);
    return typeof cleanup === 'function' ? () => cleanup() : undefined;
  }, [vault, ...deps]);
}
