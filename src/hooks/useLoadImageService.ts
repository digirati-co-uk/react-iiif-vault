import { canonicalServiceUrl } from '@iiif/parser/image-3';
import type { ImageService } from '@iiif/presentation-3';
import mitt from 'mitt';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useImageServiceLoader } from '../context/ImageServiceLoaderContext';

export type ImageServiceLoaderType = (
  imageService: any | undefined,
  { height, width }: { height: number; width: number }
) => ImageService | undefined;

const loadedEmitter = mitt<{
  loaded: { imageServiceId: string };
}>();

export function useLoadImageService() {
  const loader = useImageServiceLoader();
  const [imageServiceStatus, setImageServiceStatus] = useState<Record<string, string>>({});
  const didUnmount = useRef(false);

  useEffect(() => {
    const handler = (e: { imageServiceId: string }) => {
      setImageServiceStatus((r) => {
        return {
          ...r,
          [e.imageServiceId]: 'done',
        };
      });
    };
    loadedEmitter.on('loaded', handler);
    return () => {
      loadedEmitter.off('loaded', handler);
    };
  }, []);

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
        } else if (!imageServiceStatus[imageServiceId]) {
          if (!didUnmount.current) {
            setImageServiceStatus((r) => {
              return {
                ...r,
                [imageServiceId]: 'loading',
              };
            });
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
    [loader, imageServiceStatus]
  );

  return [loadImageService, imageServiceStatus] as const;
}
