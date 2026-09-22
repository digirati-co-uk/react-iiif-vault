import { useCompatiblePaintingAnnotations } from './useCompatiblePaintingAnnotations';
import { isImageService } from '@iiif/parser/image-3';
import { useCanvasContainer } from './useCanvasContainer';
import { useVault } from './useVault';
import type { ImageService } from '@iiif/parser/presentation-3/types';
import { useEffect, useMemo, useState } from 'react';
import { useLoadImageServiceFn, useLoadImageServiceFnSync } from '../context/ImageServicesContext';
import { getCanvasContainerSize } from '../utility/canvas-compat';

export interface ImageServiceRequestOptions {
  cacheKey?: string;
}

/** Returns the first painting image service on the current Canvas. */
export function useImageService({ cacheKey }: ImageServiceRequestOptions = {}): {
  data: ImageService | undefined;
  isFetching: boolean;
  status: 'error' | 'success' | 'loading' | 'idle';
  error?: Error;
} {
  const canvas = useCanvasContainer();
  const annotations = useCompatiblePaintingAnnotations();
  const vault = useVault();
  const loadSync = useLoadImageServiceFnSync();
  const load = useLoadImageServiceFn();
  const request = useMemo(() => {
    const annotationBody = annotations[0]?.body;
    const body = Array.isArray(annotationBody) ? annotationBody[0] : annotationBody;
    const resource = body ? vault.get(body) : undefined;
    const service = resource && 'service' in resource ? resource.service?.find(isImageService) : undefined;
    const size = canvas ? getCanvasContainerSize(canvas) : { width: 1, height: 1 };
    return { service, size, initial: service ? loadSync(service, size) || undefined : undefined };
  }, [vault, canvas, cacheKey, annotations, loadSync]);
  const [result, setResult] = useState<{ request: typeof request; data?: ImageService; error?: Error }>();

  useEffect(() => {
    let active = true;
    if (request.service && !request.initial) {
      load(request.service, request.size).then(
        (data) => {
          if (active) setResult({ request, data: data || undefined });
        },
        (error: unknown) => {
          if (active) setResult({ request, error: error instanceof Error ? error : new Error(String(error)) });
        }
      );
    }
    return () => {
      active = false;
    };
  }, [request, load]);

  const current = result?.request === request ? result : undefined;
  const data = current?.data || request.initial;
  const error = current?.error;
  const status = error ? 'error' : data ? 'success' : request.service && !current ? 'loading' : 'idle';
  return { data, isFetching: status === 'loading', status, error };
}
