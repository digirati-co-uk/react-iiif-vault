import { useVault } from './useVault';
import { createStylesHelper } from '@iiif/vault-helpers';
import { useMemo } from 'react';

export function useStyleHelper() {
  const vault = useVault();
  return useMemo(() => createStylesHelper(vault), [vault]);
}
