import { usePaintingAnnotations } from './usePaintingAnnotations';
import { getImageServices } from '@iiif/parser/image-3';
import { useCanvas } from './useCanvas';
import { useVault } from './useVault';
import { ImageService } from '@iiif/presentation-3';
import { useEffect, useMemo, useState } from 'react';
import { useLoadImageServiceFn, useLoadImageServiceFnSync } from '../context/ImageServicesContext';

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
  const loadImageServiceSync = useLoadImageServiceFnSync();
  const loadImageServiceAsync = useLoadImageServiceFn();
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
          loadImageServiceSync(
            firstImageService,
            {
              width: firstImageService.width || canvas.width,
              height: firstImageService.height || canvas.height,
            },
            true
          ) || undefined
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
              (await loadImageServiceAsync(firstImageService, {
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
