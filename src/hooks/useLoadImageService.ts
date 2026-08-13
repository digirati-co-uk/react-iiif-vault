import type { ImageService } from '@iiif/presentation-3';
import { useCallback } from 'react';
import { useAllImageServices, useLoadImageServiceFn, useLoadImageServiceFnSync } from '../context/ImageServicesContext';

export type ImageServiceLoaderType = (
  imageService: any | undefined,
  { height, width }: { height: number; width: number }
) => ImageService | undefined;

export function useLoadImageService() {
  const loadSync = useLoadImageServiceFnSync();
  const load = useLoadImageServiceFn();
  const allServices = useAllImageServices();

  const loadImageService = useCallback<ImageServiceLoaderType>(
    (imageService, { height, width }) => {
      if (!imageService) return imageService;
      if (imageService.width && imageService.height && imageService.tiles?.length) return imageService;

      const loaded = loadSync(imageService, { height, width });
      if (!loaded) void load(imageService, { height, width });
      return loaded || undefined;
    },
    [load, loadSync]
  );

  return [loadImageService, allServices] as const;
}
