import { IIIFStore, Vault } from '@iiif/vault';
export declare function useVaultSelector<T>(selector: (state: IIIFStore, vault: Vault) => T, deps?: any[]): T;
