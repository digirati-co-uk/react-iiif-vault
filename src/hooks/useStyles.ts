import { useVault } from './useVault';
import { useMemo } from 'react';
import { Reference } from '@iiif/presentation-3';
import { createStylesHelper } from '@iiif/vault-helpers/styles';
import { useVaultSelector } from './useVaultSelector';

export function useStyles<Style extends Record<string, Record<string, any>>>(
  resource: undefined | Reference<any>
): Style;
export function useStyles<Style extends Record<string, any>>(
  resource: undefined | Reference<any>,
  scope: string
): Style;
export function useStyles<Style>(resource?: Reference, scope?: string): Style {
  const vault = useVault();
  const helper = useMemo(() => createStylesHelper(vault), [vault]);

  return useVaultSelector(() => {
    if (!resource) {
      return null;
    }

    const styles = helper.getAppliedStyles(resource.id);
    return styles ? (scope ? styles[scope] : styles) : undefined;
  }, [resource, scope]) as Style;
}
