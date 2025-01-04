import { canonicalServiceUrl } from '@iiif/parser/image-3';
import type { ImageService } from '@iiif/presentation-3';
import mitt from 'mitt';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useImageServiceLoader } from '../context/ImageServiceLoaderContext';
import { createStore } from 'zustand';
import { useStore } from 'zustand';

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
  const loader = useImageServiceLoader();
  const { loaded, setLoaded } = useStore(serviceStore);
  const didUnmount = useRef(false);

  useEffect(() => {
    return () => {
      didUnmount.current = true;
    };
  }, []);

  const loadImageService = useCallback<ImageServiceLoaderType>(
    (imageService, { height, width }) => {
      if (imageService) {
        const imageServiceId = imageService.id || (imageService['@id'] as string);
        // We want to kick this off.
        const syncLoaded = loader.loadServiceSync({
          id: imageServiceId,
          width: imageService.width || width,
          height: imageService.height || height,
          source: imageService,
        });

        if (syncLoaded) {
          imageService = syncLoaded;
        } else if (!loaded[imageServiceId]) {
          if (!didUnmount.current) {
            setLoaded(imageServiceId, 'loading');
          }
          loader
            .loadService({
              id: imageServiceId,
              width: imageService.width || width,
              height: imageService.height || height,
            })
            .then(() => {
              loadedEmitter.emit('loaded', { imageServiceId });
            });
        }
      }
      return imageService;
    },
    [loader, loaded]
  );

  return [loadImageService, loaded] as const;
}
