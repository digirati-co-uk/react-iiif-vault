import { ImageService } from '@iiif/presentation-3';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useImageServiceLoader } from '../context/ImageServiceLoaderContext';

export function useLoadImageService() {
  const loader = useImageServiceLoader();
  const [imageServiceStatus, setImageServiceStatus] = useState<Record<string, string>>({});
  const didUnmount = useRef(false);
  useEffect(() => {
    return () => {
      didUnmount.current = true;
    };
  }, []);
  const loadImageService = useCallback(
    (imageService: any | undefined, { height, width }: { height: number; width: number }): ImageService | undefined => {
      if (imageService) {
        const imageServiceId = imageService.id || (imageService['@id'] as string);

        // We want to kick this off.
        const syncLoaded = loader.loadServiceSync({
          id: imageServiceId,
          width: imageService.width || width,
          height: imageService.height || height,
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
              if (!didUnmount.current) {
                setImageServiceStatus((r) => {
                  return {
                    ...r,
                    [imageServiceId]: 'done',
                  };
                });
              }
            });
        }
      }
      return imageService;
    },
    [loader, imageServiceStatus]
  );

  return [loadImageService, imageServiceStatus] as const;
}
