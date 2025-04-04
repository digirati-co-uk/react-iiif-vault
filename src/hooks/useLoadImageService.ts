import type { ImageService } from '@iiif/presentation-3';
import mitt from 'mitt';
import { useCallback, useEffect, useRef } from 'react';
import { useImageServiceLoader } from '../context/ImageServiceLoaderContext';
import { createStore } from 'zustand';
import { useStore } from 'zustand';
import { useAllImageServices, useLoadImageServiceFn, useLoadImageServiceFnSync } from '../context/ImageServicesContext';

const serviceStore = createStore<{
  loaded: { [key: string]: string };
  setLoaded: (id: string, status?: string) => void;
}>((set, get) => ({
  loaded: {},
  setLoaded: (id: string, status = 'done') => {
    set((state) => {
      return {
        loaded: {
          ...state.loaded,
          [id]: status,
        },
      };
    });
  },
}));

export type ImageServiceLoaderType = (
  imageService: any | undefined,
  { height, width }: { height: number; width: number }
) => ImageService | undefined;

const loadedEmitter = mitt<{
  loaded: { imageServiceId: string };
}>();

loadedEmitter.on('loaded', (e) => {
  serviceStore.getState().setLoaded(e.imageServiceId);
});

export function useLoadImageService() {
  const loadSync = useLoadImageServiceFnSync();
  const allServices = useAllImageServices();

  const loadImageService = useCallback<ImageServiceLoaderType>((imageService, { height, width }) => {
    if (imageService) {
      return loadSync(imageService, { height, width }, true);
    }
    return imageService;
  }, [loadSync]);

  return [loadImageService, allServices] as const;
}
