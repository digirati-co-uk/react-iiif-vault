import { useVault } from './useVault';
import { useMemo } from 'react';
import { ReduxStore } from '@iiif/vault';

export function useDispatch(): ReduxStore['dispatch'] {
  const vault = useVault();
  const store = vault.getStore();

  return useMemo(() => {
    return (action: any) => store.dispatch(action);
  }, [store]);
}
