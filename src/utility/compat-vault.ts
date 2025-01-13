export type CompatVault = {
  get: import('@iiif/helpers/vault').Vault['get'];
  setMetaValue: import('@iiif/helpers/vault').Vault['setMetaValue'];
  getResourceMeta: import('@iiif/helpers/vault').Vault['getResourceMeta'];
  load: import('@iiif/helpers/vault').Vault['load'];
  requestStatus: import('@iiif/helpers/vault').Vault['requestStatus'];
};

const metaState: any = {};
export const compatVault: CompatVault = {
  get(nonRef: any) {
    return nonRef;
  },
  setMetaValue([id, meta, key], value) {
    const oldValue = compatVault.getResourceMeta(id, meta);
    const oldValueItem = oldValue ? oldValue[key] : undefined;
    const newValue = typeof value === 'function' ? (value as any)(oldValueItem) : value;
    metaState[id] = {
      ...(metaState[id] || {}),
      [meta]: {
        ...((metaState[id] || {})[meta] || {}),
        [key]: newValue,
      },
    };
  },
  getResourceMeta: ((resource: any, metaKey?: any) => {
    const resourceMeta = metaState[resource as any] as any;

    if (!resourceMeta) {
      return undefined;
    }
    if (!metaKey) {
      return resourceMeta;
    }

    return resourceMeta[metaKey];
  }) as any,
  async load(id: string | { type: any; id: string }) {
    const idToLoad = typeof id === 'string' ? id : id.id;

    // @todo this could do an upgrade..
    return fetch(idToLoad).then((response) => response.json());
  },
  requestStatus(id: string) {
    // Never any request status in this context.
    return undefined;
  },
};
