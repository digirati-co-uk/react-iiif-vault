import { useVault } from './useVault';
import { createStylesHelper } from '@iiif/helpers/styles';
import { useMemo } from 'react';

export function useStyleHelper() {
  const vault = useVault();
  return useMemo(() => createStylesHelper(vault), [vault]);
}
