import type { ImageService } from '@iiif/presentation-3';
import React, { useCallback, useContext } from 'react';
import { createImageServiceStore, imageServices } from '@iiif/helpers/image-service';
import { useStore } from 'zustand';

type ImageServiceStore = ReturnType<typeof createImageServiceStore>['store'];
const pendingLoads = new WeakMap<ImageServiceStore, Map<string, Promise<ImageService | null>>>();

const ImageServicesReactContext = React.createContext<ImageServiceStore>(imageServices.store);
ImageServicesReactContext.displayName = 'ImageServicesHelper';

function useImageServiceStore() {
  return useContext(ImageServicesReactContext);
}

export function useImageServiceId(id: string) {
  const store = useImageServiceStore();
  return useStore(store, ({ loaded }) => loaded[id]);
}

export function useLoadImageServiceFnSync() {
  const store = useImageServiceStore();
  return useStore(store, ({ loadServiceSync }) => loadServiceSync);
}

export function useAllImageServices() {
  const store = useImageServiceStore();
  return useStore(store, ({ loaded }) => loaded);
}

export function useLoadImageServiceFn() {
  const store = useImageServiceStore();
  const loadService = useStore(store, (state) => state.loadService);

  return useCallback(
    (service: ImageService, detail?: { width: number; height: number; force?: boolean }) => {
      const id = service.id || (service as any)['@id'];
      if (!id) return loadService(service, detail);

      let loads = pendingLoads.get(store);
      if (!loads) {
        loads = new Map();
        pendingLoads.set(store, loads);
      }

      const existing = loads.get(id);
      if (existing) return existing;

      const pending = loadService(service, detail).finally(() => loads.delete(id));
      loads.set(id, pending);
      return pending;
    },
    [loadService, store]
  );
}
