import { usePaintingAnnotations } from './usePaintingAnnotations';
import { getImageServices } from '@atlas-viewer/iiif-image-api';
import { useCanvas } from './useCanvas';
import { useVault } from './useVault';
import { IIIFExternalWebResource, ImageService } from '@iiif/presentation-3';
import { useImageServiceLoader } from '../context/ImageServiceLoaderContext';
import { useEffect, useMemo, useState } from 'react';

export interface ImageServiceRequestOptions {
  cacheKey?: string;
}

/**
 * Returns the First image service on the current canvas.
 *
 * @note It is better to use the hook useRenderingStrategy for rendering.
 */
export function useImageService({ cacheKey }: ImageServiceRequestOptions = {}): {
  data: ImageService | undefined;
  isFetching: boolean;
  status: 'error' | 'success' | 'loading' | 'idle';
} {
  const canvas = useCanvas();
  const annotations = usePaintingAnnotations();
  const vault = useVault();
  const imageService = useImageServiceLoader();
  const [_data, setData] = useState<ImageService | undefined>(undefined);
  const [isFetching, setIsFetching] = useState(false);
  const [status, setStatus] = useState<'error' | 'success' | 'loading' | 'idle'>('idle');
  const [error, setError] = useState<Error | undefined>(undefined);
  const key = canvas ? canvas.id : 'undefined';
  const initialData = useMemo(() => {
    try {
      if (canvas && annotations.length) {
        const annotation = annotations[0];
        const resource = vault.get(annotation.body[0]);
        const imageServices = getImageServices(resource as any);
        const firstImageService = imageServices[0];

        if (!firstImageService) {
          return undefined;
        }

        return (
          imageService.loadServiceSync({
            id: firstImageService.id || (firstImageService['@id'] as string),
            width: firstImageService.width || canvas.width,
            height: firstImageService.height || canvas.height,
          }) || undefined
        );
      }
    } catch (e) {
      console.error(e);
      // silent error.
    }

    return undefined;

    // This is specifically not exhaustive. We only want to try to loadSync initially or when the canvas changes.
  }, [key, cacheKey, canvas]);

  const data = status === 'success' && _data ? _data : initialData;

  useEffect(() => {
    (async () => {
      try {
        if (canvas && annotations.length) {
          const annotation = annotations[0];
          const resource = vault.get(annotation.body[0]);
          const imageServices = getImageServices(resource as any) as any[];
          const firstImageService = imageServices[0] as any;

          if (!firstImageService) {
            return;
          }

          setIsFetching(true);
          setStatus('loading');

          try {
            const loadedService =
              (await imageService.loadService({
                id: firstImageService.id || firstImageService['@id'],
                width: firstImageService.width || canvas.width,
                height: firstImageService.height || canvas.height,
              })) || undefined;

            setData(loadedService as any);
            setStatus('success');
            setIsFetching(false);
          } catch (err) {
            setStatus('error');
            setError(err as Error);
          }
        }
      } catch (err) {
        setStatus('error');
        setError(err as Error);
      }
    })();

    // It's important that this DOESN'T refresh every time there is a new canvas change.
    // In an editing situation, the cache key should be used.
  }, [key, cacheKey]);

  return useMemo(() => {
    return {
      data,
      isFetching,
      status,
      error,
    } as any;
  }, [data, isFetching, status, error]);
}
