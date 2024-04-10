import {
  RegionParameter,
  RotationParameter,
  createImageServiceRequest,
  imageServiceRequestToString,
} from '@atlas-viewer/iiif-image-api';
import { ImageService, ImageSize } from '@iiif/presentation-3';
import { useMemo } from 'react';

export function useImage(
  service: ImageService | undefined,
  data: {
    size?: Partial<ImageSize>;
    selector?: RegionParameter;
    rotation?: number | RotationParameter;
    format?: string;
    region?: RegionParameter;
    quality?: string;
  } = {},
  deps: any[] = []
) {
  return useMemo(() => {
    if (!service) {
      return null;
    }

    let quality = data.quality;

    if (service && service.extraQualities && data.quality) {
      if (!service.extraQualities.includes(data.quality)) {
        quality = 'default';
      }
    }

    // @todo other validation.

    const request = createImageServiceRequest(service);
    const imageId = imageServiceRequestToString({
      identifier: request.identifier,
      server: request.server,
      scheme: request.scheme,
      type: 'image',
      size: {
        max: !data.size?.width && !data.size?.height,
        confined: false,
        upscaled: false,
        ...(data.size || {}),
      },
      format: data.format || 'jpg',
      // This isn't how it should be modelled, always full,
      // region: data.selector ? data.selector : { full: true },
      region: data.region || { full: true },
      rotation: data?.rotation
        ? Number.isInteger(data.rotation)
          ? { angle: data.rotation }
          : (data.rotation as any)
        : { angle: 0 },
      quality: quality || 'default',
      prefix: request.prefix,
      originalPath: (request as any).originalPath,
    });

    return imageId;
  }, [...deps]);
}
