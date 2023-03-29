import { useVaultSelector } from './useVaultSelector';

export function useResources<Type>(ids: string[], type: string): Type[] {
  return useVaultSelector((state, vault) => vault.get(ids.map((id) => ({ id, type }))) as any, [ids, type]);
}
