import React, { useContext } from 'react';
import { createImageServiceStore, imageServices } from '@iiif/helpers/image-service';
import { useStore } from 'zustand';

type ImageServiceStore = ReturnType<typeof createImageServiceStore>['store'];

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
  return useStore(store, ({ loadService }) => loadService);
}
