import { useVault } from './useVault';
import { useMemo } from 'react';
import { VaultZustandStore } from '@iiif/helpers/vault/store';

export function useDispatch(): VaultZustandStore['dispatch'] {
  const vault = useVault();
  const store = vault.getStore();

  return useMemo(() => {
    return (action: any) => store.dispatch(action);
  }, [store]);
}
