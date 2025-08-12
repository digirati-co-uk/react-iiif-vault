import { ModeContext } from '@atlas-viewer/atlas';
import { createContext, useContext, useEffect, useMemo } from 'react';
import type { StoreApi } from 'zustand';
import { useStore } from 'zustand';
import { useEmitter } from '../../hooks/useEvent';
import { type AtlasStore, type AtlasStoreEvents, createAtlasStore, CreateAtlasStoreProps } from './atlas-store';

export const AtlasStoreReactContext = createContext<StoreApi<AtlasStore> | null>(null);

export function useAtlasStore() {
  return useContext(AtlasStoreReactContext) as StoreApi<AtlasStore>;
}

const globalAtlasStores: Record<string, StoreApi<AtlasStore>> = {};

export function getAtlasStoreByName(name = 'atlas') {
  return globalAtlasStores[name]?.getState();
}

export function AtlasStoreProvider({
  children,
  name = 'atlas',
  existing,
  atlasStoreConfig,
}: {
  name?: string;
  children: React.ReactNode;
  existing?: StoreApi<AtlasStore>;
  atlasStoreConfig?: Partial<CreateAtlasStoreProps>;
}) {
  const emitter = useEmitter<AtlasStoreEvents>();
  const existingValue = useContext(AtlasStoreReactContext);

  const value = useMemo(() => {
    return existing || existingValue || createAtlasStore({ events: emitter, ...(atlasStoreConfig || {}) });
  }, [emitter, existing, existingValue]);

  const mode = useStore(value, (v) => v.mode);

  useEffect(() => {
    const nameToCheck = name;
    if (nameToCheck) {
      globalAtlasStores[nameToCheck] = value;
    }
    return () => {
      if (nameToCheck) {
        delete globalAtlasStores[nameToCheck];
      }
    };
  }, [value, name]);

  return (
    <AtlasStoreReactContext.Provider value={value}>
      <ModeContext.Provider value={mode || 'explore'}>{children}</ModeContext.Provider>
    </AtlasStoreReactContext.Provider>
  );
}
